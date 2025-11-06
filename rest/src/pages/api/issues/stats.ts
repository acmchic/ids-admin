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
    // Get count of open issues
    const t1 = Date.now();
    const [openCountResult]: any = await db.execute(
      `SELECT COUNT(*) as count FROM issues WHERE status = 'open'`
    );
    console.log(`⏱️ Issue count query: ${Date.now() - t1}ms`);
    
    const openCount = openCountResult[0]?.count || 0;

    // Get order IDs with open issues
    const t2 = Date.now();
    const [openIssues]: any = await db.execute(
      `SELECT DISTINCT order_id FROM issues WHERE status = 'open'`
    );
    console.log(`⏱️ Issue orderIds query: ${Date.now() - t2}ms`);
    
    const orderIds = openIssues.map((issue: any) => String(issue.order_id));

    console.log(`⏱️ TOTAL /api/issues/stats: ${Date.now() - startTime}ms\n`);

    return res.status(200).json({
      success: true,
      openCount,
      orderIds,
    });
  } catch (error: any) {
    console.error('❌ Error fetching issue stats:', error);
    return res.status(500).json({
      error: 'Failed to fetch issue stats',
      details: error.message,
    });
  }
}

