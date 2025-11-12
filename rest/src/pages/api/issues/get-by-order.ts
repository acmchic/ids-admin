import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../config/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    // Get issues for this order
    const [issues]: any = await db.execute(
      `SELECT * FROM issues WHERE order_id = ? ORDER BY created_at DESC`,
      [order_id]
    );

    // Parse JSON fields
    const parsedIssues = issues.map((issue: any) => {
      try {
        if (issue.old_data && typeof issue.old_data === 'string') {
          issue.old_data = JSON.parse(issue.old_data);
        }
      } catch (e) {
        console.error('Failed to parse old_data:', e);
      }

      try {
        if (issue.new_data && typeof issue.new_data === 'string') {
          issue.new_data = JSON.parse(issue.new_data);
        }
      } catch (e) {
        console.error('Failed to parse new_data:', e);
      }

      return {
        ...issue,
        id: String(issue.id),
        order_id: String(issue.order_id),
      };
    });

    return res.status(200).json({
      success: true,
      issues: parsedIssues,
    });
  } catch (error: any) {
    console.error('❌ Error fetching issues:', error);
    return res.status(500).json({
      error: 'Failed to fetch issues',
      details: error.message,
    });
  }
}





