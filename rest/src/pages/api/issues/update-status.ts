import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../config/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { issue_id, status, new_data, notes } = req.body;

    if (!issue_id || !status) {
      return res.status(400).json({ error: 'issue_id and status are required' });
    }

    // Build update query
    const updateFields: string[] = ['status = ?'];
    const params: any[] = [status];

    if (new_data !== undefined) {
      updateFields.push('new_data = ?');
      params.push(JSON.stringify(new_data));
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (status === 'resolved') {
      updateFields.push('resolved_at = NOW()');
    }

    updateFields.push('updated_at = NOW()');
    params.push(issue_id);

    const query = `UPDATE issues SET ${updateFields.join(', ')} WHERE id = ?`;

    await db.execute(query, params);

    return res.status(200).json({
      success: true,
      message: 'Issue status updated successfully',
    });
  } catch (error: any) {
    console.error('❌ Error updating issue status:', error);
    return res.status(500).json({
      error: 'Failed to update issue status',
      details: error.message,
    });
  }
}
