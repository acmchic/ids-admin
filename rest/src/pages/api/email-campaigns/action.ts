import { NextApiRequest, NextApiResponse } from "next";
import { execFile, spawn } from "child_process";
import os from "os";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // The US comeback campaign enrolls and sends automatically every day
  // (US buyers only, newest first, warm-up); manual extract/dispatch would bypass that.
  if (["extract", "send", "dry-run", "repeat-preview"].includes(action)) {
    const rows: any[] = await prisma.$queryRaw`SELECT template FROM email_campaigns WHERE id = ${campaignId}`;
    if (rows[0]?.template === "comeback") {
      return res.status(400).json({
        error: "This campaign sends automatically every day",
        details: "Use Preview email / Check next batch. Recipients are added by the daily campaign:comeback job.",
      });
    }
  }

  if (action === "pause" || action === "resume") {
    await prisma.$executeRaw`
      UPDATE email_campaigns
      SET status = ${action === "pause" ? "paused" : "sending"}, updated_at = NOW()
      WHERE id = ${campaignId}
    `;
    return res.status(200).json({ message: action === "pause" ? "Campaign paused" : "Campaign resumed" });
  }

  let artisanPath = "";
  try {
    artisanPath = resolveArtisanPath();
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to locate Laravel artisan", details: error.message });
  }

  // Read-only JSON actions used by the admin preview panel.
  if (action === "preview") {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "Enter a valid customer email to preview" });
    }
    return runJson(res, [artisanPath, "campaign:preview", String(campaignId), email, "--json"], 120000);
  }

  // Checking 300 emails takes minutes, longer than Cloudflare (100s) and nginx (60s)
  // allow for one request, so it runs in the background and the page polls for the result.
  if (action === "check-batch") {
    return res.status(202).json(startBatchCheck(artisanPath, campaignId, safeLimit ?? 300));
  }

  if (action === "check-batch-status") {
    return res.status(200).json(batchCheckStatus(campaignId));
  }

  const args = [artisanPath];
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
    // Never dispatch a batch that would send customers to a broken page.
    const check = await execJson([
      artisanPath, "campaign:check-batch", String(campaignId), `--limit=${Math.min(safeBatchSize ?? 300, 1000)}`, "--json",
    ], 600000).catch((error: Error) => ({ error: error.message }));
    if ((check as any).error) {
      return res.status(500).json({ error: "Link check failed, nothing was sent", details: (check as any).error });
    }
    if (!(check as any).safe_to_send) {
      return res.status(409).json({
        error: "Sending blocked: some emails have a broken customize link",
        details: `${(check as any).blocked} of ${(check as any).checked} emails blocked. Run "Check next batch" for details.`,
        check,
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

  console.log("Executing campaign action", { action, campaignId, testMode });

  execFile("php", args, { timeout: 120000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
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

function batchFiles(campaignId: number) {
  const base = path.join(os.tmpdir(), `campaign-check-${campaignId}`);
  return {
    result: `${base}.json`,
    partial: `${base}.partial`,
    error: `${base}.err`,
    pid: `${base}.pid`,
    progress: `${base}.progress`,
  };
}

function removeFile(file: string) {
  try {
    fs.unlinkSync(file);
  } catch {
    // already gone
  }
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readJson(file: string) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function startBatchCheck(artisanPath: string, campaignId: number, limit: number) {
  const files = batchFiles(campaignId);
  const running = Number(fs.existsSync(files.pid) ? fs.readFileSync(files.pid, "utf8") : 0);
  if (running && isAlive(running)) {
    return { status: "running" };
  }

  for (const file of Object.values(files)) {
    removeFile(file);
  }

  const out = fs.openSync(files.partial, "w");
  const err = fs.openSync(files.error, "w");
  const child = spawn(
    "php",
    [artisanPath, "campaign:check-batch", String(campaignId), `--limit=${limit}`, "--json", `--progress=${files.progress}`],
    { detached: true, stdio: ["ignore", out, err] }
  );
  fs.closeSync(out);
  fs.closeSync(err);
  fs.writeFileSync(files.pid, String(child.pid));
  child.on("exit", () => {
    if (fs.existsSync(files.partial)) fs.renameSync(files.partial, files.result);
    removeFile(files.pid);
  });
  child.unref();

  return { status: "running" };
}

function batchCheckStatus(campaignId: number) {
  const files = batchFiles(campaignId);
  const pid = Number(fs.existsSync(files.pid) ? fs.readFileSync(files.pid, "utf8") : 0);
  if (pid && isAlive(pid)) {
    return { status: "running", progress: readJson(files.progress) };
  }

  // Finished (the exit handler may not have run if the admin restarted meanwhile).
  const result = readJson(files.result) ?? readJson(files.partial);
  if (result && !result.error) {
    return { status: "done", ...result };
  }

  const stderr = fs.existsSync(files.error) ? fs.readFileSync(files.error, "utf8").slice(-500) : "";
  if (!result && !stderr && !pid) {
    return { status: "idle" };
  }
  return { status: "failed", error: result?.error || stderr || "Link check stopped without a result" };
}

function execJson(args: string[], timeout: number): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile("php", args, { timeout, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      let parsed: any = null;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        parsed = null;
      }

      if (parsed && typeof parsed === "object") {
        return resolve(parsed);
      }

      reject(new Error(error?.message || stderr || "Command returned no JSON"));
    });
  });
}

async function runJson(res: NextApiResponse, args: string[], timeout: number) {
  try {
    const result = await execJson(args, timeout);
    if (result.error) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Campaign JSON action failed", { command: args[1], message: error.message });
    return res.status(500).json({ error: "Failed to execute command", details: error.message });
  }
}

function resolveArtisanPath() {
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
}
