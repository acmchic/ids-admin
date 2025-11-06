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
    const { order_id, email_send } = req.body;

    if (!order_id || email_send === undefined) {
      return res.status(400).json({ error: 'order_id and email_send are required' });
    }

    await db.execute(
      'UPDATE orders SET email_send = ?, updated_at = NOW() WHERE id = ?',
      [parseInt(email_send), order_id]
    );

    return res.status(200).json({ success: true, message: 'Email send status updated' });
  } catch (error: any) {
    console.error('Error updating email_send:', error);
    return res.status(500).json({ error: 'Failed to update email_send', details: error.message });
  }
}

