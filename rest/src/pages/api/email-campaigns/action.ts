import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

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

  let artisanPath = "";
  try {
    artisanPath = resolveArtisanPath();
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to locate Laravel artisan",
      details: error.message,
    });
  }

  let command = "";
  if (action === "extract") {
    const limitArg = safeLimit ? `--limit=${safeLimit}` : "";
    command = `php \"${artisanPath}\" campaign:extract-emails ${campaignId} ${limitArg}`;
  } else if (action === "send") {
    const batchArg = safeBatchSize ? `--batch-size=${safeBatchSize}` : "";
    command = `php \"${artisanPath}\" campaign:send-batch ${campaignId} ${batchArg}`;
  } else if (action === "test") {
    const testEmail = req.body.email || "acmchic88@gmail.com";
    command = `php \"${artisanPath}\" campaign:test ${campaignId} ${testEmail}`;
  } else if (action === "dry-run") {
    const batchArg = safeBatchSize ? `--batch-size=${safeBatchSize}` : "";
    command = `php \"${artisanPath}\" campaign:send-batch ${campaignId} ${batchArg} --dry-run`;
  } else {
    return res.status(400).json({ error: "Invalid action" });
  }

  console.log(`Executing campaign action: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Action error: ${error.message}`);
      return res.status(500).json({
        error: "Failed to execute command",
        details: error.message,
        stderr
      });
    }

    return res.status(200).json({
      message: `Action ${action} executed successfully`,
      output: stdout
    });
  });
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
