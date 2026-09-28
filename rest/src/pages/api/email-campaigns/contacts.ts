import { NextApiRequest, NextApiResponse } from "next";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
      const search = String(req.query.search || "").trim();
      const source = String(req.query.source || "").trim();
      const offset = (page - 1) * limit;

      // Parameterized filters (the old string concatenation allowed SQL injection).
      const conditions: Prisma.Sql[] = [Prisma.sql`is_active = 1`];
      if (search) {
        const like = `%${search}%`;
        conditions.push(Prisma.sql`(email LIKE ${like} OR name LIKE ${like})`);
      }
      if (source) {
        conditions.push(Prisma.sql`source = ${source}`);
      }
      const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

      // Total count
      const countResult: any[] = await prisma.$queryRaw`
        SELECT COUNT(*) as total FROM email_contacts ${whereClause}
      `;

      // Contacts list
      const contacts: any[] = await prisma.$queryRaw`
        SELECT id, email, name, country_code, source, source_detail, is_active, orders_count, total_spent, first_order_at, last_order_at, tags, sent_count, last_sent_at, created_at
        FROM email_contacts
        ${whereClause}
        ORDER BY orders_count DESC, total_spent DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      // Stats
      const stats: any[] = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN source = 'order' THEN 1 ELSE 0 END) as from_orders,
          SUM(CASE WHEN source = 'csv' THEN 1 ELSE 0 END) as from_csv,
          SUM(CASE WHEN source = 'manual' THEN 1 ELSE 0 END) as from_manual,
          SUM(CASE WHEN orders_count > 1 THEN 1 ELSE 0 END) as repeat_buyers,
          SUM(CASE WHEN total_spent >= 100 THEN 1 ELSE 0 END) as vip_count,
          SUM(CASE WHEN is_active = 1 AND country_code = 'US' THEN 1 ELSE 0 END) as us_active
        FROM email_contacts
      `;

      const safeContacts = contacts.map((c: any) => ({
        ...c,
        id: Number(c.id),
        is_active: Boolean(c.is_active),
        orders_count: Number(c.orders_count),
        total_spent: Number(c.total_spent),
        sent_count: Number(c.sent_count || 0),
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
        us_active: Number(stats[0]?.us_active || 0),
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
