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
    const { order_id_1, order_id_2 } = req.body;

    if (!order_id_1 || !order_id_2) {
      return res.status(400).json({ error: 'Both order IDs are required' });
    }

    if (order_id_1 === order_id_2) {
      return res.status(400).json({ 
        canMerge: false,
        reason: 'Cannot merge the same order with itself' 
      });
    }

    // Get both orders
    const [orders]: any = await db.execute(
      `SELECT id, shipping_address, paid_total, total 
       FROM orders 
       WHERE id IN (?, ?)`,
      [order_id_1, order_id_2]
    );

    if (orders.length !== 2) {
      return res.status(404).json({ 
        canMerge: false,
        reason: 'One or both orders not found' 
      });
    }

    const order1 = orders.find((o: any) => String(o.id) === String(order_id_1));
    const order2 = orders.find((o: any) => String(o.id) === String(order_id_2));

    // Parse shipping addresses
    let addr1, addr2;
    try {
      addr1 = typeof order1.shipping_address === 'string' 
        ? JSON.parse(order1.shipping_address) 
        : order1.shipping_address;
      addr2 = typeof order2.shipping_address === 'string' 
        ? JSON.parse(order2.shipping_address) 
        : order2.shipping_address;
    } catch (e) {
      return res.status(400).json({ 
        canMerge: false,
        reason: 'Failed to parse shipping addresses' 
      });
    }

    // Check email from shipping_address JSON
    const email1 = addr1?.shipping_email;
    const email2 = addr2?.shipping_email;

    if (!email1 || !email2 || email1.toLowerCase() !== email2.toLowerCase()) {
      return res.status(200).json({
        canMerge: false,
        reason: 'Email addresses do not match',
        email1,
        email2,
      });
    }

    // Check shipping address
    const addressFields = [
      'shipping_name',
      'shipping_address1',
      'shipping_city',
      'shipping_province_code',
      'shipping_zipcode',
    ];

    for (const field of addressFields) {
      const val1 = String(addr1?.[field] || '').toLowerCase().trim();
      const val2 = String(addr2?.[field] || '').toLowerCase().trim();
      
      if (val1 !== val2) {
        return res.status(200).json({
          canMerge: false,
          reason: `Shipping address mismatch: ${field}`,
          field,
          value1: addr1?.[field],
          value2: addr2?.[field],
        });
      }
    }

    // All checks passed
    return res.status(200).json({
      canMerge: true,
      order1: {
        id: order1.id,
        email: email1,
        total: order1.paid_total || order1.total,
      },
      order2: {
        id: order2.id,
        email: email2,
        total: order2.paid_total || order2.total,
      },
      newTotal: (parseFloat(order1.paid_total || order1.total || 0) + 
                 parseFloat(order2.paid_total || order2.total || 0)).toFixed(2),
    });
  } catch (error: any) {
    console.error('❌ Error validating merge:', error);
    return res.status(500).json({
      error: 'Failed to validate merge',
      details: error.message,
    });
  }
}

