import { NextApiRequest, NextApiResponse } from "next";

const CUSTOMIZE_BASE_URL = "https://customize.idreamshirt.com/uploads/customize";

const normalizeCustomizeImagePath = (imagePath?: string): string => {
  if (!imagePath) return "";

  try {
    const url = new URL(imagePath);
    const marker = "/uploads/customize/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex !== -1) {
      return decodeURIComponent(url.pathname.slice(markerIndex + marker.length)).replace(/^\/+/, "");
    }
  } catch {
    // Not a full URL.
  }

  return imagePath
    .replace(/^https?:\/\/[^/]+\/uploads\/customize\//, "")
    .replace(/^\/?uploads\/customize\//, "")
    .replace(/^customize\//, "")
    .replace(/^\/+/, "");
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const imagePath = normalizeCustomizeImagePath(typeof req.query.path === "string" ? req.query.path : "");
  if (!imagePath || imagePath.includes("..") || imagePath.includes("//")) {
    return res.status(400).json({ error: "Invalid image path" });
  }

  try {
    const url = `${CUSTOMIZE_BASE_URL}/${imagePath}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to download image" });
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileName = imagePath.split("/").pop() || "customize-artwork";
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Customize upload download error:", error);
    return res.status(500).json({
      error: "Failed to download image",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
