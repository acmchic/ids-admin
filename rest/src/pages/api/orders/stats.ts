import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../config/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    // Simple count and sum query - very fast, no joins
    const [result]: any = await db.execute(
      `SELECT 
        COUNT(*) as count,
        COALESCE(SUM(paid_total), 0) as total
       FROM orders 
       WHERE payment_status = 'COMPLETED' 
       AND DATE(created_vn_time) = ?`,
      [date]
    );

    const stats = result[0] || { count: 0, total: 0 };

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ /api/orders/stats (${date}): ${totalTime}ms - Count: ${stats.count}`);

    return res.status(200).json({
      success: true,
      count: parseInt(stats.count),
      total: parseFloat(stats.total),
    });
  } catch (error: any) {
    console.error('❌ Error fetching order stats:', error);
    return res.status(500).json({
      error: 'Failed to fetch order stats',
      details: error.message,
    });
  }
}

