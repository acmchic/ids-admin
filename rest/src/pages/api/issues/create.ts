import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../config/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { order_id, issue_type, notes, old_data, new_data, created_by } = req.body;

    if (!order_id || !issue_type) {
      return res.status(400).json({ error: 'order_id and issue_type are required' });
    }

    const [result]: any = await db.execute(
      `INSERT INTO issues (order_id, issue_type, status, notes, old_data, new_data, created_by, created_at, updated_at) 
       VALUES (?, ?, 'open', ?, ?, ?, ?, NOW(), NOW())`,
      [
        order_id,
        issue_type,
        notes || null,
        old_data ? JSON.stringify(old_data) : null,
        new_data ? JSON.stringify(new_data) : null,
        created_by || null
      ]
    );

    return res.status(201).json({ 
      success: true, 
      issue: { 
        id: result.insertId.toString(), 
        order_id: order_id.toString() 
      } 
    });
  } catch (error: any) {
    console.error('Error creating issue:', error);
    return res.status(500).json({ error: 'Failed to create issue', details: error.message });
  }
}

