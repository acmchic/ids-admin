import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      // Get all campaigns with stats
      const campaigns: any[] = await prisma.$queryRaw`
        SELECT 
          ec.*,
          (SELECT COUNT(*) FROM email_campaign_recipients WHERE campaign_id = ec.id) as total_recipients,
          (SELECT COUNT(*) FROM email_campaign_recipients WHERE campaign_id = ec.id AND status = 'sent') as sent_count,
          (SELECT COUNT(*) FROM email_campaign_recipients WHERE campaign_id = ec.id AND status = 'pending') as pending_count,
          (SELECT COUNT(*) FROM email_campaign_recipients WHERE campaign_id = ec.id AND status = 'failed') as failed_count
        FROM email_campaigns ec
        ORDER BY ec.created_at DESC
      `;

      // Get unsubscribe count
      const unsubscribeResult: any[] = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM email_unsubscribes
      `;

      // Get total unique emails from orders
      const emailCountResult: any[] = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.shipping_email'))) as count
        FROM orders
        WHERE payment_status = 'COMPLETED'
        AND JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.shipping_email')) IS NOT NULL
        AND JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.shipping_email')) != ''
      `;

      // Convert BigInt to number for JSON serialization
      const safeCampaigns = campaigns.map((c: any) => ({
        ...c,
        id: Number(c.id),
        total_recipients: Number(c.total_recipients),
        sent_count: Number(c.sent_count),
        pending_count: Number(c.pending_count),
        failed_count: Number(c.failed_count),
        batch_size: Number(c.batch_size),
        opened_count: Number(c.opened_count),
      }));

      return res.status(200).json({
        campaigns: safeCampaigns,
        unsubscribeCount: Number(unsubscribeResult[0]?.count || 0),
        totalOrderEmails: Number(emailCountResult[0]?.count || 0),
      });
    } catch (error: any) {
      console.error("Campaign API error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
