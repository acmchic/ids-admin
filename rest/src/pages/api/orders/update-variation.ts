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
    const { order_product_id, variation } = req.body;

    if (!order_product_id || !variation) {
      return res.status(400).json({ error: 'order_product_id and variation are required' });
    }

    // Validate variation structure (only validate essential fields)
    const requiredFields = ['name', 'size', 'color', 'side'];
    for (const field of requiredFields) {
      if (!variation[field]) {
        return res.status(400).json({ error: `${field} is required in variation` });
      }
    }

    await db.execute(
      'UPDATE order_product SET variation = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(variation), order_product_id]
    );

    return res.status(200).json({ success: true, message: 'Variation updated' });
  } catch (error: any) {
    console.error('Error updating variation:', error);
    return res.status(500).json({ error: 'Failed to update variation', details: error.message });
  }
}

