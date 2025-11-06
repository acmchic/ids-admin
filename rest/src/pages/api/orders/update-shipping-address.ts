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
    const { order_id, shipping_address } = req.body;

    if (!order_id || !shipping_address) {
      return res.status(400).json({ error: 'order_id and shipping_address are required' });
    }

    // Validate shipping_address structure
    const requiredFields = ['shipping_name', 'shipping_address1', 'shipping_city', 'shipping_zipcode'];
    for (const field of requiredFields) {
      if (!shipping_address[field]) {
        return res.status(400).json({ error: `${field} is required in shipping_address` });
      }
    }

    await db.execute(
      'UPDATE orders SET shipping_address = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(shipping_address), order_id]
    );

    return res.status(200).json({ success: true, message: 'Shipping address updated' });
  } catch (error: any) {
    console.error('Error updating shipping address:', error);
    return res.status(500).json({ error: 'Failed to update shipping address', details: error.message });
  }
}

