import { NextApiRequest, NextApiResponse } from "next";
import { execFile } from "child_process";
import { campaignArtisanCommand } from "../../../utils/campaign-artisan";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const campaignId = Number(req.body?.id);
  const customerEmail = String(req.body?.customerEmail || "").trim().toLowerCase();
  if (!Number.isInteger(campaignId) || campaignId <= 0) return res.status(400).json({ error: "Invalid campaign ID" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return res.status(400).json({ error: "Enter a valid customer email" });

  let command;
  try {
    command = campaignArtisanCommand(["campaign:preview", String(campaignId), customerEmail, "--json"]);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to locate Laravel artisan",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  execFile(
    command.file,
    command.args,
    { timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: "Could not render campaign preview", details: stderr || error?.message || stdout });
      }

      try {
        return res.status(200).json(JSON.parse(stdout));
      } catch {
        return res.status(500).json({ error: "Campaign preview returned invalid data" });
      }
    }
  );
}
