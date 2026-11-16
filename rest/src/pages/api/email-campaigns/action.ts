import { NextApiRequest, NextApiResponse } from "next";
import { execFile } from "child_process";
import { campaignArtisanCommand } from "../../../utils/campaign-artisan";

const testMode = process.env.EMAIL_CAMPAIGN_TEST_MODE !== "false";
const allowedRecipients = (process.env.EMAIL_CAMPAIGN_TEST_RECIPIENTS || "acmchic88@gmail.com")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const allowedDomains = (process.env.EMAIL_CAMPAIGN_TEST_DOMAINS || "idreamshirt.com")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

function isAllowedTestRecipient(value: string) {
  const email = value.trim().toLowerCase();
  const domain = email.split("@")[1] || "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && (allowedRecipients.includes(email) || allowedDomains.includes(domain));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, action, limit, batchSize } = req.body;
  if (!id || !action) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const campaignId = Number(id);
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  const safeLimit = limit ? Number(limit) : undefined;
  if (safeLimit !== undefined && (!Number.isInteger(safeLimit) || safeLimit <= 0 || safeLimit > 10000)) {
    return res.status(400).json({ error: "Invalid limit" });
  }

  const safeBatchSize = batchSize ? Number(batchSize) : undefined;
  if (safeBatchSize !== undefined && (!Number.isInteger(safeBatchSize) || safeBatchSize <= 0 || safeBatchSize > 10000)) {
    return res.status(400).json({ error: "Invalid batch size" });
  }

  const args: string[] = [];
  if (action === "extract") {
    args.push("campaign:extract-emails", String(campaignId), "--completed");
    if (safeLimit) args.push(`--limit=${safeLimit}`);
  } else if (action === "send") {
    if (testMode) {
      return res.status(403).json({
        error: "Real campaign sending is locked in test mode",
        details: "Set EMAIL_CAMPAIGN_TEST_MODE=false only after production approval.",
      });
    }
    args.push("campaign:send-batch", String(campaignId));
    if (safeBatchSize) args.push(`--batch-size=${safeBatchSize}`);
  } else if (action === "test") {
    const testEmail = String(req.body.email || "acmchic88@gmail.com").trim().toLowerCase();
    if (!isAllowedTestRecipient(testEmail)) {
      return res.status(400).json({
        error: "Test destination is not allowed",
        details: `Allowed: ${allowedRecipients.join(", ")}, ${allowedDomains.map((domain) => `*@${domain}`).join(", ")}`,
      });
    }

    args.push("campaign:test", String(campaignId), testEmail);
    const previewAs = String(req.body.previewAs || "").trim().toLowerCase();
    if (previewAs) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(previewAs)) {
        return res.status(400).json({ error: "Invalid preview customer email" });
      }
      args.push(`--preview-as=${previewAs}`);
    }
  } else if (action === "dry-run") {
    args.push("campaign:send-batch", String(campaignId), "--dry-run");
    if (safeBatchSize) args.push(`--batch-size=${safeBatchSize}`);
  } else if (action === "repeat-preview") {
    args.push(
      "campaign:extract-emails", String(campaignId), "--completed",
      "--limit=300",
      "--dry-run"
    );
  } else {
    return res.status(400).json({ error: "Invalid action" });
  }

  let command;
  try {
    command = campaignArtisanCommand(args);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to locate Laravel artisan",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  console.log("Executing campaign action", { action, campaignId, testMode });

  execFile(command.file, command.args, { timeout: 120000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.error("Campaign action failed", { action, campaignId, message: error.message });
      return res.status(500).json({
        error: "Failed to execute command",
        details: error.message,
        stderr,
      });
    }

    return res.status(200).json({
      message: `Action ${action} executed successfully`,
      output: stdout,
      testMode,
    });
  });
}
