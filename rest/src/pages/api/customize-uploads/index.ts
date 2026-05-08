import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../config/database";

const CUSTOMIZE_BASE_URL = "https://customize.idreamshirt.com/uploads/customize";

type UploadItem = {
  id: string;
  productId: number;
  slug: string;
  productName: string;
  imagePath: string;
  fileName: string;
  folder: string;
  uploadDate: string | null;
  url: string;
  createdAt: string | null;
  updatedAt: string | null;
  orderCount: number;
  latestOrderId: string | null;
  latestOrderNum: string | null;
  latestCustomerName: string | null;
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

const extractUploadDate = (imagePath: string): string | null => {
  const match = imagePath.match(/^(\d{4})_(\d{2})\/(\d{2})_/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 60), 1), 200);
  const date = typeof req.query.date === "string" ? req.query.date : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";

  try {
    const [rows]: any = await db.execute(`
      SELECT
        pc.id,
        pc.slug,
        pc.name,
        pc.image,
        pc.created_at,
        pc.updated_at,
        COUNT(DISTINCT o.id) AS order_count,
        MAX(o.id) AS latest_order_id,
        MAX(o.order_num) AS latest_order_num,
        SUBSTRING_INDEX(
          GROUP_CONCAT(
            JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.shipping_name'))
            ORDER BY o.id DESC SEPARATOR '|||'
          ),
          '|||',
          1
        ) AS latest_customer_name
      FROM products_customize pc
      LEFT JOIN order_product op
        ON op.product_id = pc.id
        AND op.is_customize = 1
      LEFT JOIN orders o
        ON o.id = op.order_id
      WHERE pc.image IS NOT NULL
        AND pc.image != ''
        AND pc.image != '[]'
      GROUP BY pc.id, pc.slug, pc.name, pc.image, pc.created_at, pc.updated_at
      ORDER BY pc.id DESC
    `);

    const uploads: UploadItem[] = [];

    rows.forEach((row: any) => {
      safeJsonParse(row.image).forEach((image: any, index: number) => {
        const imagePath = normalizeCustomizeImagePath(image?.original);
        if (!imagePath) return;

        const parts = imagePath.split("/").filter(Boolean);
        const fileName = parts[parts.length - 1] || imagePath;
        const folder = parts.slice(0, -1).join("/");
        const uploadDate = extractUploadDate(imagePath);

        uploads.push({
          id: `${row.id}-${index}-${imagePath}`,
          productId: Number(row.id),
          slug: row.slug,
          productName: row.name || "Customize",
          imagePath,
          fileName,
          folder,
          uploadDate,
          url: `${CUSTOMIZE_BASE_URL}/${imagePath}`,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
          orderCount: Number(row.order_count || 0),
          latestOrderId: row.latest_order_id ? String(row.latest_order_id) : null,
          latestOrderNum: row.latest_order_num ? String(row.latest_order_num) : null,
          latestCustomerName: row.latest_customer_name || null,
        });
      });
    });

    const filtered = uploads.filter((item) => {
      if (date && item.uploadDate !== date) return false;
      if (!search) return true;

      return [
        item.fileName,
        item.folder,
        item.slug,
        item.latestOrderNum,
        item.latestCustomerName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return res.status(200).json({
      data: paginated,
      paginatorInfo: {
        total: filtered.length,
        currentPage: page,
        perPage: limit,
        lastPage: Math.max(Math.ceil(filtered.length / limit), 1),
      },
    });
  } catch (error) {
    console.error("Customize uploads list error:", error);
    return res.status(500).json({
      error: "Failed to load customize uploads",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
