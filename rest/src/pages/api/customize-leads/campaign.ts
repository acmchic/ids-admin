import { NextApiRequest, NextApiResponse } from "next";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { db } from "../../../config/database";

type CampaignInput = {
  action?: "create" | "test" | "send" | "dry-run";
  leadIds?: number[];
  testEmail?: string;
  name?: string;
  subject?: string;
  previewText?: string;
  heading?: string;
  discountCode?: string;
  discountPercent?: number;
  ctaText?: string;
  ctaUrl?: string;
};

const resolveArtisanPath = () => {
  const candidates = [
    process.env.CAMPAIGN_ARTISAN_PATH,
    path.resolve(process.cwd(), "..", "..", "order", "artisan"),
    path.resolve(process.cwd(), "..", "..", "orders", "artisan"),
    "/home/production/order/artisan",
    "/home/production/orders/artisan",
  ].filter(Boolean) as string[];

  const artisanPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!artisanPath) {
    throw new Error(`Unable to locate Laravel artisan. Tried: ${candidates.join(", ")}`);
  }

  return artisanPath;
};

const runArtisan = (args: string[]) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile("php", [resolveArtisanPath(), ...args], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const safePercent = (value: unknown) => {
  const percent = Number(value || 0);
  return Number.isFinite(percent) && percent > 0 ? Math.min(Math.round(percent), 95) : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const input = req.body as CampaignInput;
  const action = input.action || "create";
  const leadIds = Array.isArray(input.leadIds)
    ? input.leadIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : [];

  if (!["create", "test", "send", "dry-run"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  if (action !== "test" && leadIds.length === 0) {
    return res.status(400).json({ error: "Select at least one lead" });
  }

  if (action === "test" && (!input.testEmail || !input.testEmail.includes("@"))) {
    return res.status(400).json({ error: "Valid test email is required" });
  }

  try {
    const placeholders = leadIds.map(() => "?").join(",");
    const [leadRows]: any = leadIds.length
      ? await db.execute(
          `SELECT id, email, customize_slug, artwork_display_file_name
           FROM customize_upload_leads
           WHERE id IN (${placeholders})
           ORDER BY updated_at DESC`,
          leadIds
        )
      : [[]];

    if (action !== "test" && leadRows.length === 0) {
      return res.status(404).json({ error: "Selected leads were not found" });
    }

    const now = new Date();
    const name = input.name?.trim() || `Customize leads ${now.toISOString().slice(0, 10)}`;
    const subject = input.subject?.trim() || "Your custom shirt design is waiting";
    const previewText = input.previewText?.trim() || "We saved your uploaded artwork so you can finish your custom shirt.";
    const heading = input.heading?.trim() || "Your custom design is ready";
    const ctaText = input.ctaText?.trim() || "Finish Your Custom Shirt";
    const ctaUrl = input.ctaUrl?.trim() || "https://idreamshirt.com/products/customize/premium-t-shirt";
    const discountPercent = safePercent(input.discountPercent);
    const discountCode = input.discountCode?.trim() || null;

    const [campaignResult]: any = await db.execute(
      `INSERT INTO email_campaigns
        (name, subject, preview_text, heading, discount_code, discount_percent, cta_text, cta_url, status, total_recipients, batch_size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 50, NOW(), NOW())`,
      [name, subject, previewText, heading, discountCode, discountPercent, ctaText, ctaUrl, leadRows.length]
    );

    const campaignId = Number(campaignResult.insertId);

    if (leadRows.length) {
      const values: any[][] = leadRows.map((lead: any) => [
        campaignId,
        String(lead.email).toLowerCase(),
        lead.artwork_display_file_name || lead.customize_slug || null,
      ]);

      await db.query(
        `INSERT INTO email_campaign_recipients (campaign_id, email, name, status, created_at, updated_at)
         VALUES ?`,
        [values.map((value) => [...value, "pending", now, now])]
      );
    }

    if (action === "test") {
      const result = await runArtisan(["campaign:test", String(campaignId), String(input.testEmail)]);
      return res.status(200).json({ campaignId, message: "Test email sent", output: result.stdout });
    }

    if (action === "dry-run" || action === "send") {
      const args = ["campaign:send-batch", String(campaignId), `--batch-size=${Math.max(leadRows.length, 1)}`];
      if (action === "dry-run") args.push("--dry-run");
      const result = await runArtisan(args);
      return res.status(200).json({
        campaignId,
        message: action === "send" ? "Campaign sent" : "Dry run complete",
        output: result.stdout,
      });
    }

    return res.status(201).json({
      campaignId,
      message: "Campaign created",
      totalRecipients: leadRows.length,
    });
  } catch (error) {
    console.error("Customize lead campaign error:", error);
    return res.status(500).json({
      error: "Failed to prepare customize lead campaign",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
