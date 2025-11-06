import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../config/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const connection = await db.getConnection();

  try {
    const { order_id_from, order_id_to } = req.body;

    if (!order_id_from || !order_id_to) {
      return res.status(400).json({ error: 'Both order IDs are required' });
    }

    // Start transaction
    await connection.beginTransaction();

    // Get totals
    const [orders]: any = await connection.execute(
      `SELECT id, paid_total, total FROM orders WHERE id IN (?, ?)`,
      [order_id_from, order_id_to]
    );

    const orderFrom = orders.find((o: any) => String(o.id) === String(order_id_from));
    const orderTo = orders.find((o: any) => String(o.id) === String(order_id_to));

    if (!orderFrom || !orderTo) {
      await connection.rollback();
      return res.status(404).json({ error: 'One or both orders not found' });
    }

    // Calculate new total
    const totalFrom = parseFloat(orderFrom.paid_total || orderFrom.total || 0);
    const totalTo = parseFloat(orderTo.paid_total || orderTo.total || 0);
    const newTotal = totalFrom + totalTo;

    // Move all products from order_from to order_to
    await connection.execute(
      `UPDATE order_product SET order_id = ? WHERE order_id = ?`,
      [order_id_to, order_id_from]
    );

    // Update total price of order_to
    await connection.execute(
      `UPDATE orders 
       SET paid_total = ?, 
           total = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [newTotal, newTotal, order_id_to]
    );

    // Mark order_from as merged
    // Set status = 78 and payment_status = "MERGED"
    await connection.execute(
      `UPDATE orders 
       SET status = 78,
           payment_status = 'MERGED',
           updated_at = NOW()
       WHERE id = ?`,
      [order_id_from]
    );

    // Commit transaction
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Orders merged successfully',
      mergedTo: order_id_to,
      mergedFrom: order_id_from,
      newTotal: newTotal.toFixed(2),
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('❌ Error merging orders:', error);
    return res.status(500).json({
      error: 'Failed to merge orders',
      details: error.message,
    });
  } finally {
    connection.release();
  }
}

