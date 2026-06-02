import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../config/database";

type ActivityRow = {
  id: number;
  ip: string | null;
  url: string | null;
  source: string | null;
  cart: any;
  device: any;
  location: any;
  created_at: string;
  updated_at: string;
};

const safeJsonParse = (value: any, fallback: any) => {
  if (!value) return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseProductUrl = (rawUrl: string | null) => {
  if (!rawUrl) {
    return { productSlug: "", catalogSlug: "", cleanUrl: "" };
  }

  try {
    const parsed = new URL(rawUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const productIndex = parts.indexOf("products");
    const productSlug = productIndex >= 0 ? parts[productIndex + 1] || "" : "";
    const catalogSlug = productIndex >= 0 ? parts[productIndex + 2] || "" : "";

    return {
      productSlug,
      catalogSlug,
      cleanUrl: `${parsed.origin}${parsed.pathname}`,
    };
  } catch {
    return { productSlug: "", catalogSlug: "", cleanUrl: rawUrl };
  }
};

const normalizeCartItems = (cart: any): any[] => {
  const parsedCart = safeJsonParse(cart, []);

  if (Array.isArray(parsedCart)) return parsedCart;
  if (Array.isArray(parsedCart?.items)) return parsedCart.items;

  return [];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const limit = Math.min(parseInt(String(req.query.limit || "200"), 10) || 200, 1000);
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const offset = (page - 1) * limit;
    const text = String(req.query.text || "").trim();
    const added = String(req.query.added || "all");
    const date = String(req.query.date || "").trim();

    const conditions = ["url LIKE ?"];
    const params: any[] = ["%/products/%"];

    if (text) {
      conditions.push("(url LIKE ? OR source LIKE ? OR ip LIKE ?)");
      params.push(`%${text}%`, `%${text}%`, `%${text}%`);
    }

    if (date) {
      conditions.push("DATE(created_at) = ?");
      params.push(date);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const [[{ total }]]: any = await db.execute(
      `SELECT COUNT(*) as total FROM address ${whereClause}`,
      params
    );

    const rawLimit = Math.min(limit * 5, 5000);
    const [rows]: any = await db.execute(
      `SELECT id, ip, url, source, cart, device, location, created_at, updated_at
       FROM address
       ${whereClause}
       ORDER BY id DESC
       LIMIT ${rawLimit} OFFSET ${offset}`,
      params
    );

    const grouped = new Map<string, any>();

    (rows as ActivityRow[]).forEach((row) => {
      const cartItems = normalizeCartItems(row.cart);
      const addedToCart = cartItems.length > 0;
      const device = safeJsonParse(row.device, {});
      const location = safeJsonParse(row.location, {});
      const productUrl = parseProductUrl(row.url);
      const groupKey = `${row.ip || "unknown"}|${productUrl.cleanUrl}`;
      const existing = grouped.get(groupKey);

      if (existing) {
        existing.view_count += 1;
        existing.added_to_cart = existing.added_to_cart || addedToCart;
        if (addedToCart) {
          existing.cart_items = cartItems;
          existing.cart_item_count = cartItems.length;
        }
        return;
      }

      grouped.set(groupKey, {
        id: row.id,
        ip: row.ip,
        source: row.source || "--",
        url: productUrl.cleanUrl,
        product_slug: productUrl.productSlug,
        catalog_slug: productUrl.catalogSlug,
        added_to_cart: addedToCart,
        cart_items: cartItems,
        cart_item_count: cartItems.length,
        device,
        location,
        created_at: row.created_at,
        updated_at: row.updated_at,
        view_count: 1,
      });
    });

    let data = Array.from(grouped.values());
    if (added === "yes") {
      data = data.filter((item) => item.added_to_cart);
    } else if (added === "no") {
      data = data.filter((item) => !item.added_to_cart);
    }
    data = data.slice(0, limit);

    return res.status(200).json({
      data,
      current_page: page,
      per_page: limit,
      total,
    });
  } catch (error: any) {
    console.error("❌ Error fetching product views:", error);
    return res.status(500).json({
      error: "Failed to fetch product views",
      details: error?.message,
    });
  }
}
