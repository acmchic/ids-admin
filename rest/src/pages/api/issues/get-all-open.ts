import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../config/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Disable caching - always fetch fresh data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const [issues]: any = await db.execute(
      `SELECT * FROM issues WHERE status = 'open' ORDER BY created_at DESC`
    );

    const parsedIssues = issues.map((issue: any) => ({
      ...issue,
      old_data: issue.old_data ? JSON.parse(issue.old_data) : null,
      new_data: issue.new_data ? JSON.parse(issue.new_data) : null,
    }));

    return res.status(200).json({
      success: true,
      issues: parsedIssues,
    });
  } catch (error: any) {
    console.error('❌ Error fetching all open issues:', error);
    return res.status(500).json({
      error: 'Failed to fetch all open issues',
      details: error.message,
    });
  }
}

