import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../config/database";

const CUSTOMIZE_BASE_URL = `${(
  process.env.NEXT_PUBLIC_CUSTOMIZE_API ||
  process.env.CUSTOMIZE_API_URL ||
  "https://customize.idreamshirt.com"
).replace(/\/$/, "")}/uploads/customize`;

const ensureLeadTable = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customize_upload_leads (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_customize_id BIGINT UNSIGNED NULL,
      customize_slug VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL,
      artwork_original VARCHAR(255) NULL,
      artwork_processed VARCHAR(255) NULL,
      artwork_original_file_name VARCHAR(255) NULL,
      artwork_display_file_name VARCHAR(255) NULL,
      catalog VARCHAR(120) NULL,
      color VARCHAR(120) NULL,
      source VARCHAR(120) NULL,
      landing_url TEXT NULL,
      attribution LONGTEXT NULL,
      user_agent TEXT NULL,
      ip VARCHAR(64) NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY customize_upload_leads_slug_email_unique (customize_slug, email),
      KEY customize_upload_leads_email_index (email),
      KEY customize_upload_leads_product_index (product_customize_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const toNumber = (value: unknown) => Number(value || 0);

const hasOrderProductColumn = async (column: string) => {
  const [rows]: any = await db.execute(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'order_product'
       AND COLUMN_NAME = ?`,
    [column]
  );

  return Number(rows?.[0]?.count || 0) > 0;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const date = typeof req.query.date === "string" ? req.query.date.trim() : "";

  const where: string[] = [];
  const params: any[] = [];

  if (search) {
    where.push("(cul.email LIKE ? OR cul.customize_slug LIKE ? OR cul.artwork_display_file_name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (date) {
    where.push("DATE(cul.created_at) = ?");
    params.push(date);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    await ensureLeadTable();
    const canJoinByCustomizeSlug = await hasOrderProductColumn("customize_slug");
    const orderProductJoin = canJoinByCustomizeSlug
      ? "LEFT JOIN order_product op ON op.is_customize = 1 AND (op.product_id = cul.product_customize_id OR op.customize_slug = cul.customize_slug)"
      : "LEFT JOIN order_product op ON op.product_id = cul.product_customize_id AND op.is_customize = 1";

    const [countRows]: any = await db.execute(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT email) AS unique_emails
       FROM customize_upload_leads cul
       ${whereSql}`,
      params
    );

    const [rows]: any = await db.execute(
      `SELECT
        cul.*,
        pc.name AS product_name,
        COUNT(DISTINCT o.id) AS order_count,
        MAX(o.id) AS latest_order_id,
        MAX(o.order_num) AS latest_order_num
      FROM customize_upload_leads cul
      LEFT JOIN products_customize pc ON pc.id = cul.product_customize_id
      ${orderProductJoin}
      LEFT JOIN orders o ON o.id = op.order_id
      ${whereSql}
      GROUP BY cul.id, pc.name
      ORDER BY cul.updated_at DESC, cul.id DESC
      LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const data = rows.map((row: any) => {
      const imagePath = row.artwork_original || row.artwork_processed || "";
      return {
        id: Number(row.id),
        productCustomizeId: row.product_customize_id ? Number(row.product_customize_id) : null,
        slug: row.customize_slug,
        email: row.email,
        productName: row.product_name || "Customize",
        catalog: row.catalog,
        color: row.color,
        source: row.source,
        landingUrl: row.landing_url,
        artworkOriginal: row.artwork_original,
        artworkProcessed: row.artwork_processed,
        artworkFileName: row.artwork_display_file_name || row.artwork_original_file_name,
        artworkUrl: imagePath ? `${CUSTOMIZE_BASE_URL}/${imagePath}` : null,
        orderCount: toNumber(row.order_count),
        latestOrderId: row.latest_order_id ? String(row.latest_order_id) : null,
        latestOrderNum: row.latest_order_num ? String(row.latest_order_num) : null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      };
    });

    const total = toNumber(countRows[0]?.total);
    return res.status(200).json({
      data,
      stats: {
        total,
        uniqueEmails: toNumber(countRows[0]?.unique_emails),
      },
      paginatorInfo: {
        total,
        currentPage: page,
        perPage: limit,
        lastPage: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error("Customize leads list error:", error);
    return res.status(500).json({
      error: "Failed to load customize leads",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
