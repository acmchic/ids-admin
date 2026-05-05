import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
        SELECT id, email, name, status, error_message, sent_at
        FROM email_campaign_recipients 
        WHERE campaign_id = ${campaignId}
        ORDER BY 
          CASE status 
            WHEN 'failed' THEN 0 
            WHEN 'sent' THEN 1 
            WHEN 'pending' THEN 2 
          END,
          updated_at DESC
        LIMIT 100
      `;

      // Get failed recipients
      const failedRecipients: any[] = await prisma.$queryRaw`
        SELECT id, email, name, error_message, updated_at
        FROM email_campaign_recipients 
        WHERE campaign_id = ${campaignId} AND status = 'failed'
        ORDER BY updated_at DESC
        LIMIT 50
      `;

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

      return res.status(200).json({
        campaign: {
          ...campaign,
          id: Number(campaign.id),
          total_recipients: Number(campaign.total_recipients),
          sent_count: Number(campaign.sent_count),
          failed_count: Number(campaign.failed_count),
          opened_count: Number(campaign.opened_count),
          batch_size: Number(campaign.batch_size),
        },
        stats: safeStats,
        recentRecipients: safeRecipients,
        failedRecipients: safeFailedRecipients,
      });
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
