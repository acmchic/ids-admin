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

    // Get current order
    const [currentOrders]: any = await db.execute(
      `SELECT id, shipping_address FROM orders WHERE id = ?`,
      [order_id]
    );

    if (currentOrders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentOrder = currentOrders[0];
    let currentAddr;
    try {
      currentAddr = typeof currentOrder.shipping_address === 'string'
        ? JSON.parse(currentOrder.shipping_address)
        : currentOrder.shipping_address;
    } catch (e) {
      return res.status(400).json({ error: 'Failed to parse shipping address' });
    }

    // Get all orders with status = 1 (except current order)
    const [candidateOrders]: any = await db.execute(
      `SELECT id, order_num, tracking_number, shipping_address, paid_total, total, created_vn_time
       FROM orders 
       WHERE status = 1 AND id != ?
       ORDER BY created_vn_time DESC`,
      [order_id]
    );

    // Filter orders with matching address
    const mergeableOrders = [];
    const currentEmail = currentAddr?.shipping_email;

    for (const order of candidateOrders) {
      let orderAddr;
      try {
        orderAddr = typeof order.shipping_address === 'string'
          ? JSON.parse(order.shipping_address)
          : order.shipping_address;
      } catch (e) {
        continue;
      }

      const orderEmail = orderAddr?.shipping_email;

      // Check email match
      if (!orderEmail || !currentEmail || 
          orderEmail.toLowerCase() !== currentEmail.toLowerCase()) {
        continue;
      }

      // Check address match
      const addressFields = [
        'shipping_name',
        'shipping_address1',
        'shipping_city',
        'shipping_province_code',
        'shipping_zipcode',
      ];

      let addressMatches = true;
      for (const field of addressFields) {
        const val1 = String(currentAddr?.[field] || '').toLowerCase().trim();
        const val2 = String(orderAddr?.[field] || '').toLowerCase().trim();
        
        if (val1 !== val2) {
          addressMatches = false;
          break;
        }
      }

      if (addressMatches) {
        mergeableOrders.push({
          id: String(order.id),
          order_num: order.order_num || order.tracking_number || order.id,
          email: orderEmail,
          total: parseFloat(order.paid_total || order.total || 0).toFixed(2),
          created_at: order.created_vn_time || order.created_at,
        });
      }
    }

    return res.status(200).json({
      success: true,
      orders: mergeableOrders,
      count: mergeableOrders.length,
    });
  } catch (error: any) {
    console.error('❌ Error fetching mergeable orders:', error);
    return res.status(500).json({
      error: 'Failed to fetch mergeable orders',
      details: error.message,
    });
  }
}

