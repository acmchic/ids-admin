import { NextApiRequest, NextApiResponse } from "next";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const completedPurchases = Prisma.sql`
  SELECT LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.shipping_email')))) AS email,
         MAX(created_at) AS last_order_at
  FROM orders
  WHERE payment_status = 'COMPLETED' AND deleted_at IS NULL
  GROUP BY LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.shipping_email'))))
`;

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(
    value,
    (_key, item) => typeof item === "bigint" ? Number(item) : item
  ));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const { id } = req.query;
  const campaignId = Number(id);

  if (isNaN(campaignId)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  if (req.method === "GET") {
    try {
      // Get campaign details
      const campaigns: any[] = await prisma.$queryRaw`
        SELECT * FROM email_campaigns WHERE id = ${campaignId}
      `;

      if (!campaigns.length) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const campaign = campaigns[0];

      // Season columns exist only after the additive orders migration; stay compatible without it.
      const seasonColumns: any[] = await prisma.$queryRaw`
        SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_campaign_recipients'
          AND COLUMN_NAME IN ('segment', 'priority', 'variant')
      `;
      const hasSeason = seasonColumns.length === 3;
      const seasonSelect = hasSeason ? Prisma.sql`, r.segment, r.priority, r.variant` : Prisma.empty;
      const seasonOrder = hasSeason ? Prisma.sql`r.priority ASC,` : Prisma.empty;

      // Get recipient breakdown
      const stats: any[] = await prisma.$queryRaw`
        SELECT 
          status,
          COUNT(*) as count
        FROM email_campaign_recipients 
        WHERE campaign_id = ${campaignId}
        GROUP BY status
      `;

      // Get recent recipients (last 50)
      const recentRecipients: any[] = await prisma.$queryRaw`
        SELECT r.id, r.email, r.name, r.status, r.error_message, r.sent_at, r.opened_at, r.clicked_at, r.click_count${seasonSelect},
               (r.rendered_html IS NOT NULL OR r.links IS NOT NULL) AS has_snapshot,
               c.last_order_at,
               CASE WHEN c.last_order_at IS NULL THEN NULL ELSE DATEDIFF(CURRENT_DATE, DATE(c.last_order_at)) END AS days_since_last_order
        FROM email_campaign_recipients r
        LEFT JOIN (${completedPurchases}) c ON c.email = LOWER(TRIM(r.email))
        WHERE r.campaign_id = ${campaignId}
        ORDER BY 
          CASE r.status
            WHEN 'pending' THEN 0
            WHEN 'failed' THEN 1
            WHEN 'sent' THEN 2
          END,
          ${seasonOrder}
          c.last_order_at DESC, r.email ASC, r.id ASC
        LIMIT 100
      `;

      const nextRecipients: any[] = await prisma.$queryRaw`
        SELECT r.id, r.email, r.name, c.last_order_at${seasonSelect}
        FROM email_campaign_recipients r
        LEFT JOIN (${completedPurchases}) c ON c.email = LOWER(TRIM(r.email))
        WHERE r.campaign_id = ${campaignId} AND r.status = 'pending'
        ORDER BY ${seasonOrder} c.last_order_at DESC, r.email ASC, r.id ASC
        LIMIT 50
      `;

      // Get failed recipients
      const failedRecipients: any[] = await prisma.$queryRaw`
        SELECT id, email, name, error_message, updated_at,
               (rendered_html IS NOT NULL OR links IS NOT NULL) AS has_snapshot
        FROM email_campaign_recipients 
        WHERE campaign_id = ${campaignId} AND status = 'failed'
        ORDER BY updated_at DESC
        LIMIT 50
      `;

      const engagement: any[] = await prisma.$queryRaw`
        SELECT
          COUNT(DISTINCT CASE WHEN opened_at IS NOT NULL THEN id END) as unique_opens,
          COUNT(DISTINCT CASE WHEN clicked_at IS NOT NULL THEN id END) as unique_clicks,
          COALESCE(SUM(click_count), 0) as total_clicks
        FROM email_campaign_recipients
        WHERE campaign_id = ${campaignId}
      `;

      const attribution: any[] = await prisma.$queryRaw`
        SELECT
          COUNT(*) as orders,
          COALESCE(SUM(paid_total), 0) as revenue,
          COALESCE(AVG(paid_total), 0) as aov
        FROM orders
        WHERE email_campaign_id = ${campaignId}
          AND payment_status = 'COMPLETED'
          AND deleted_at IS NULL
      `;

      const links: any[] = await prisma.$queryRaw`
        SELECT link_key, COUNT(*) as clicks, COUNT(DISTINCT recipient_id) as unique_clicks
        FROM email_campaign_clicks
        WHERE campaign_id = ${campaignId}
        GROUP BY link_key
        ORDER BY clicks DESC
      `;

      // Segment funnel, subject A/B arms and coupon redemptions (season campaigns).
      let segments: any[] = [];
      let variants: any[] = [];
      if (hasSeason) {
        segments = await prisma.$queryRaw`
          SELECT COALESCE(r.segment, '-') AS segment,
                 CAST(COUNT(*) AS UNSIGNED) AS total,
                 CAST(SUM(r.status = 'pending') AS UNSIGNED) AS pending,
                 CAST(SUM(r.status IN ('sent', 'opened')) AS UNSIGNED) AS sent,
                 CAST(SUM(r.opened_at IS NOT NULL) AS UNSIGNED) AS opened,
                 CAST(SUM(r.clicked_at IS NOT NULL) AS UNSIGNED) AS clicked,
                 CAST(COUNT(DISTINCT o.id) AS UNSIGNED) AS orders
          FROM email_campaign_recipients r
          LEFT JOIN orders o ON o.email_recipient_id = r.id AND o.payment_status = 'COMPLETED' AND o.deleted_at IS NULL
          WHERE r.campaign_id = ${campaignId}
          GROUP BY COALESCE(r.segment, '-')
          ORDER BY MIN(r.priority) ASC
        `;
        variants = await prisma.$queryRaw`
          SELECT r.variant AS variant,
                 CAST(COUNT(*) AS UNSIGNED) AS sent,
                 CAST(SUM(r.opened_at IS NOT NULL) AS UNSIGNED) AS opened,
                 CAST(SUM(r.clicked_at IS NOT NULL) AS UNSIGNED) AS clicked,
                 CAST(COUNT(DISTINCT o.id) AS UNSIGNED) AS orders
          FROM email_campaign_recipients r
          LEFT JOIN orders o ON o.email_recipient_id = r.id AND o.payment_status = 'COMPLETED' AND o.deleted_at IS NULL
          WHERE r.campaign_id = ${campaignId} AND r.variant IS NOT NULL
          GROUP BY r.variant
          ORDER BY r.variant ASC
        `;
      }
      // Orders that used the campaign coupon since it started: a second signal when click
      // attribution misses (other device, link opened from a forwarded email).
      let couponOrders = { orders: 0, revenue: 0 };
      if (campaign.discount_code) {
        try {
          const rows: any[] = await prisma.$queryRaw`
            SELECT COUNT(*) AS orders, COALESCE(SUM(paid_total), 0) AS revenue
            FROM orders
            WHERE payment_status = 'COMPLETED' AND deleted_at IS NULL
              AND LOWER(coupon_code) = LOWER(${campaign.discount_code})
              AND created_at >= ${campaign.started_at || campaign.created_at}
          `;
          couponOrders = { orders: Number(rows[0]?.orders || 0), revenue: Number(rows[0]?.revenue || 0) };
        } catch (couponError: any) {
          console.warn("Coupon order lookup unavailable:", couponError.message);
        }
      }

      const safeStats = stats.map((s: any) => ({
        status: s.status,
        count: Number(s.count),
      }));

      const safeRecipients = recentRecipients.map((r: any) => ({
        ...r,
        id: Number(r.id),
      }));

      const safeFailedRecipients = failedRecipients.map((r: any) => ({
        ...r,
        id: Number(r.id),
      }));

      return res.status(200).json(jsonSafe({
        campaign: {
          ...campaign,
          id: Number(campaign.id),
          total_recipients: Number(campaign.total_recipients),
          sent_count: Number(campaign.sent_count),
          failed_count: Number(campaign.failed_count),
          opened_count: Number(campaign.opened_count),
          clicked_count: Number(campaign.clicked_count),
          batch_size: Number(campaign.batch_size),
        },
        stats: safeStats,
        segments,
        variants,
        couponOrders,
        recentRecipients: safeRecipients,
        nextRecipients,
        failedRecipients: safeFailedRecipients,
        engagement: {
          uniqueOpens: Number(engagement[0]?.unique_opens || 0),
          uniqueClicks: Number(engagement[0]?.unique_clicks || 0),
          totalClicks: Number(engagement[0]?.total_clicks || 0),
        },
        attribution: {
          orders: Number(attribution[0]?.orders || 0),
          revenue: Number(attribution[0]?.revenue || 0),
          aov: Number(attribution[0]?.aov || 0),
        },
        links: links.map((link: any) => ({
          linkKey: link.link_key,
          clicks: Number(link.clicks),
          uniqueClicks: Number(link.unique_clicks),
        })),
      }));
    } catch (error: any) {
      console.error("Campaign detail API error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === "DELETE") {
    try {
      await prisma.$executeRaw`
        DELETE FROM email_campaigns WHERE id = ${campaignId}
      `;
      return res.status(200).json({ message: "Campaign deleted successfully" });
    } catch (error: any) {
      console.error("Campaign delete API error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
