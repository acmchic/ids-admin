import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * The exact email a recipient was sent (HTML snapshot + link check results).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const recipientId = Number(req.query.id);
  if (!Number.isInteger(recipientId) || recipientId <= 0) {
    return res.status(400).json({ error: "Invalid recipient ID" });
  }

  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT id, campaign_id, email, name, status, error_message, sent_at, rendered_html, links
      FROM email_campaign_recipients
      WHERE id = ${recipientId}
    `;

    if (!rows.length) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    const row = rows[0];
    let links = row.links;
    if (typeof links === "string") {
      try {
        links = JSON.parse(links);
      } catch {
        links = null;
      }
    }

    return res.status(200).json({
      id: Number(row.id),
      campaign_id: Number(row.campaign_id),
      email: row.email,
      name: row.name,
      status: row.status,
      error_message: row.error_message,
      sent_at: row.sent_at,
      html: row.rendered_html,
      links: Array.isArray(links) ? links : [],
    });
  } catch (error: any) {
    console.error("Recipient snapshot API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
