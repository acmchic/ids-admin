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

    // Get order
    const [orderRows]: any = await db.execute(
      'SELECT * FROM orders WHERE id = ?',
      [order_id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];

    // Get order products
    const [productRows]: any = await db.execute(
      'SELECT * FROM order_product WHERE order_id = ?',
      [order_id]
    );

    // Parse JSON fields
    if (order.shipping_address && typeof order.shipping_address === 'string') {
      order.shipping_address = JSON.parse(order.shipping_address);
    }
    if (order.billing_address && typeof order.billing_address === 'string') {
      order.billing_address = JSON.parse(order.billing_address);
    }

    // Parse variation JSON for each product
    const order_product = productRows.map((product: any) => {
      if (product.variation && typeof product.variation === 'string') {
        product.variation = JSON.parse(product.variation);
      }
      return product;
    });

    const result = {
      ...order,
      id: order.id.toString(),
      customer_id: order.customer_id?.toString(),
      status: order.status.toString(),
      order_product: order_product.map((op: any) => ({
        ...op,
        id: op.id.toString(),
        order_id: op.order_id.toString(),
        product_id: op.product_id?.toString(),
        variation_option_id: op.variation_option_id?.toString(),
      })),
    };

    return res.status(200).json({ success: true, order: result });
  } catch (error: any) {
    console.error('Error fetching order details:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch order details', 
      details: error?.message || String(error),
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
}

