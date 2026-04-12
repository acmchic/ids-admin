import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const search = (req.query.search as string) || "";
      const source = (req.query.source as string) || "";
      const offset = (page - 1) * limit;

      let whereClause = "WHERE is_active = 1";
      if (search) {
        whereClause += ` AND (email LIKE '%${search}%' OR name LIKE '%${search}%')`;
      }
      if (source) {
        whereClause += ` AND source = '${source}'`;
      }

      // Total count
      const countResult: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as total FROM email_contacts ${whereClause}`
      );

      // Contacts list
      const contacts: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, email, name, source, source_detail, is_active, orders_count, total_spent, first_order_at, last_order_at, tags, created_at
         FROM email_contacts
         ${whereClause}
         ORDER BY orders_count DESC, total_spent DESC
         LIMIT ${limit} OFFSET ${offset}`
      );

      // Stats
      const stats: any[] = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN source = 'order' THEN 1 ELSE 0 END) as from_orders,
          SUM(CASE WHEN source = 'csv' THEN 1 ELSE 0 END) as from_csv,
          SUM(CASE WHEN source = 'manual' THEN 1 ELSE 0 END) as from_manual,
          SUM(CASE WHEN orders_count > 1 THEN 1 ELSE 0 END) as repeat_buyers,
          SUM(CASE WHEN total_spent >= 100 THEN 1 ELSE 0 END) as vip_count
        FROM email_contacts
      `;

      const safeContacts = contacts.map((c: any) => ({
        ...c,
        id: Number(c.id),
        is_active: Boolean(c.is_active),
        orders_count: Number(c.orders_count),
        total_spent: Number(c.total_spent),
        tags: typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags,
      }));

      const safeStats = {
        total: Number(stats[0]?.total || 0),
        active_count: Number(stats[0]?.active_count || 0),
        from_orders: Number(stats[0]?.from_orders || 0),
        from_csv: Number(stats[0]?.from_csv || 0),
        from_manual: Number(stats[0]?.from_manual || 0),
        repeat_buyers: Number(stats[0]?.repeat_buyers || 0),
        vip_count: Number(stats[0]?.vip_count || 0),
      };

      return res.status(200).json({
        contacts: safeContacts,
        stats: safeStats,
        pagination: {
          page,
          limit,
          total: Number(countResult[0]?.total || 0),
          totalPages: Math.ceil(Number(countResult[0]?.total || 0) / limit),
        },
      });
    } catch (error: any) {
      console.error("Contacts API error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
