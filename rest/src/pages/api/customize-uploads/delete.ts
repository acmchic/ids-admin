import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import path from "path";
import { promisify } from "util";
import { db } from "../../../config/database";

const execAsync = promisify(exec);

type DeleteItem = {
  productId: number;
  imagePath: string;
};

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

const safeJsonParse = (value: any): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeRemoteFolder = () => {
  // Keep this in sync with image-server's IMAGE_BASE_PATH=customize,
  // which resolves to /home/production/customize on the production host.
  let remoteFolder = process.env.SCP_CUSTOMIZE_REMOTE_FOLDER || "/home/production/customize";
  if (!remoteFolder.startsWith("/")) remoteFolder = `/${remoteFolder}`;
  return remoteFolder.replace(/\/$/, "");
};

const validateImagePath = (imagePath: string) => {
  return /^[a-zA-Z0-9/_.-]+$/.test(imagePath)
    && !imagePath.includes("..")
    && !imagePath.includes("//")
    && imagePath.split("/").length >= 2;
};

const deleteRemoteFile = async (imagePath: string) => {
  const remoteFolder = normalizeRemoteFolder();
  const serverPath = path.normalize(`${remoteFolder}/${imagePath}`);

  if (!serverPath.startsWith(remoteFolder) || serverPath.includes("..") || serverPath.includes("//")) {
    throw new Error("Invalid remote file path");
  }

  const remoteUser = process.env.SCP_USER || "root";
  const remoteHost = process.env.SCP_HOST || "vmi2327956.contaboserver.net";
  const sshKeyPath = process.env.SSH_PRIVATE_KEY_PATH || "/root/.ssh/id_rsa";
  const sshPrefix = `${remoteUser}@${remoteHost}`;

  await execAsync(`ssh -i '${sshKeyPath}' ${sshPrefix} 'rm -f "${serverPath}"'`);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const items: DeleteItem[] = rawItems
    .map((item: any) => ({
      productId: Number(item.productId),
      imagePath: normalizeCustomizeImagePath(item.imagePath),
    }))
    .filter((item: DeleteItem) => item.productId > 0 && item.imagePath && validateImagePath(item.imagePath));

  if (!items.length) {
    return res.status(400).json({ error: "No valid images selected" });
  }

  const connection = await db.getConnection();
  const remoteDeleteWarnings: string[] = [];
  let deletedCount = 0;

  try {
    await connection.beginTransaction();

    const grouped = new Map<number, Set<string>>();
    items.forEach((item) => {
      if (!grouped.has(item.productId)) grouped.set(item.productId, new Set());
      grouped.get(item.productId)!.add(item.imagePath);
    });

    for (const [productId, imagePaths] of grouped.entries()) {
      const [rows]: any = await connection.execute(
        "SELECT image FROM products_customize WHERE id = ? LIMIT 1",
        [productId]
      );

      if (!rows.length) continue;

      const currentImages = safeJsonParse(rows[0].image);
      const remainingImages = currentImages.filter((image: any) => {
        const normalized = normalizeCustomizeImagePath(image?.original);
        return !imagePaths.has(normalized);
      });

      const removedCount = currentImages.length - remainingImages.length;
      if (removedCount <= 0) continue;

      await connection.execute(
        "UPDATE products_customize SET image = ?, updated_at = NOW() WHERE id = ?",
        [JSON.stringify(remainingImages), productId]
      );

      deletedCount += removedCount;
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Customize upload DB delete error:", error);
    return res.status(500).json({
      error: "Failed to delete customize uploads",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    connection.release();
  }

  for (const item of items) {
    try {
      await deleteRemoteFile(item.imagePath);
    } catch (error) {
      remoteDeleteWarnings.push(`${item.imagePath}: ${error instanceof Error ? error.message : "Remote delete failed"}`);
    }
  }

  return res.status(200).json({
    success: true,
    deletedCount,
    warnings: remoteDeleteWarnings,
  });
}
