import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../config/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Disable caching - always fetch fresh data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const startTime = Date.now();

  try {
    const {
      page = '1',
      limit = '20',
      text,
      date,
      status,
      status_in,
      orderBy = 'created_at',
      sortedBy = 'DESC',
      shop_id
    } = req.query;

    const currentPage = parseInt(page as string);
    const perPage = parseInt(limit as string);
    const offset = (currentPage - 1) * perPage;
    
    console.log(`⏱️ [${new Date().toISOString()}] GET /api/orders/list - Page: ${currentPage}, Limit: ${perPage}`);

    // Build WHERE conditions for COUNT query (no alias needed)
    const countConditions: string[] = [];
    const countParams: any[] = [];

    // Build WHERE conditions for main query (with alias o.)
    const conditions: string[] = [];
    const params: any[] = [];

    // Filter: Only show orders with payment_status = 'COMPLETED'
    countConditions.push(`payment_status = ?`);
    countParams.push('COMPLETED');
    
    conditions.push(`o.payment_status = ?`);
    params.push('COMPLETED');

    // Populate both COUNT and main query conditions
    if (text) {
      const searchTerm = `%${text}%`;
      
      countConditions.push(`(
        shipping_address->>'$.shipping_name' LIKE ? OR
        tracking_number LIKE ? OR
        id LIKE ?
      )`);
      countParams.push(searchTerm, searchTerm, searchTerm);
      
      conditions.push(`(
        o.shipping_address->>'$.shipping_name' LIKE ? OR
        o.tracking_number LIKE ? OR
        o.id LIKE ?
      )`);
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (date) {
      countConditions.push(`DATE(created_vn_time) = ?`);
      countParams.push(date);
      
      conditions.push(`DATE(o.created_vn_time) = ?`);
      params.push(date);
    }

    if (status) {
      countConditions.push(`status = ?`);
      countParams.push(status);
      
      conditions.push(`o.status = ?`);
      params.push(status);
    }

    if (status_in) {
      const statusList = (status_in as string).split(',');
      const placeholders = statusList.map(() => '?').join(',');
      
      countConditions.push(`status IN (${placeholders})`);
      countParams.push(...statusList);
      
      conditions.push(`o.status IN (${placeholders})`);
      params.push(...statusList);
    }

    if (shop_id) {
      countConditions.push(`shop_id = ?`);
      countParams.push(shop_id);
      
      conditions.push(`o.shop_id = ?`);
      params.push(shop_id);
    }

    const countWhereClause = countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : '';
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate and sanitize orderBy to prevent SQL injection
    const allowedOrderFields = [
      'id', 'created_at', 'updated_at', 'created_vn_time', 
      'tracking_number', 'paid_total', 'total', 'status'
    ];
    const safeOrderBy = allowedOrderFields.includes(orderBy as string) ? orderBy : 'created_vn_time';
    const safeSortedBy = (sortedBy as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count (no alias needed)
    const t1 = Date.now();
    const countQuery = `SELECT COUNT(*) as total FROM orders ${countWhereClause}`;
    const [[{ total }]]: any = await db.execute(countQuery, countParams);
    console.log(`⏱️ COUNT query: ${Date.now() - t1}ms`);

    // Get orders with relations
    // Note: Using inline LIMIT/OFFSET because mysql2 has issues with prepared statements for these
    const query = `
      SELECT 
        o.*,
        os.name as status_name,
        os.serial as status_serial,
        os.color as status_color
      FROM orders o
      LEFT JOIN order_status os ON o.status = os.id
      ${whereClause}
      ORDER BY o.${safeOrderBy} ${safeSortedBy}
      LIMIT ${perPage} OFFSET ${offset}
    `;
    
    const t2 = Date.now();
    const [orders]: any = await db.execute(query, params);
    console.log(`⏱️ Orders query: ${Date.now() - t2}ms (${orders.length} orders)`);

    // Parse JSON fields
    const parsedOrders = orders.map((order: any) => {
      try {
        if (order.shipping_address && typeof order.shipping_address === 'string') {
          order.shipping_address = JSON.parse(order.shipping_address);
        }
      } catch (e) {
        console.error('Failed to parse shipping_address:', e);
        order.shipping_address = null;
      }

      try {
        if (order.billing_address && typeof order.billing_address === 'string') {
          order.billing_address = JSON.parse(order.billing_address);
        }
      } catch (e) {
        console.error('Failed to parse billing_address:', e);
        order.billing_address = null;
      }

      // Construct status object
      if (order.status_name) {
        order.status = {
          id: parseInt(order.status),
          name: order.status_name,
          serial: order.status_serial,
          color: order.status_color
        };
        delete order.status_name;
        delete order.status_serial;
        delete order.status_color;
      }

      return order;
    });

    // Get order products for each order
    if (parsedOrders.length > 0) {
      const t3 = Date.now();
      const orderIds = parsedOrders.map((o: any) => String(o.id));
      const placeholders = orderIds.map(() => '?').join(',');
      
      const [products]: any = await db.execute(
        `SELECT 
          op.*,
          p.name as product_name,
          p.image as product_image,
          p.slug as product_slug
        FROM order_product op
        LEFT JOIN products p ON op.product_id = p.id
        WHERE op.order_id IN (${placeholders})`,
        orderIds
      );
      console.log(`⏱️ Products query: ${Date.now() - t3}ms (${products.length} products)`);

      // Parse variation JSON and map product fields
      const parsedProducts = products.map((p: any) => {
        let variation = {};
        if (p.variation && typeof p.variation === 'string') {
          try {
            variation = JSON.parse(p.variation);
          } catch (e) {
            console.error('Failed to parse variation JSON:', e);
            variation = {};
          }
        } else if (p.variation) {
          variation = p.variation;
        }
        
        // Map product fields from join or variation - always ensure name exists
        const productName = p.product_name || variation?.name || 'Unknown Product';
        const productImage = p.product_image || variation?.image || null;
        const productSlug = p.product_slug || '';
        
        // Return simplified structure with only needed fields
        return {
          id: String(p.id),
          order_id: String(p.order_id),
          product_id: p.product_id ? String(p.product_id) : null,
          name: productName, // Always has a value
          slug: productSlug,
          image: productImage,
          img_url: p.img_url,
          is_customize: p.is_customize || 0,
          impressions: p.impressions || 0,
          clicks: p.clicks || 0,
          // Keep pivot structure for compatibility
          pivot: {
            img_url: p.img_url,
            variation: variation,
            upscayl_image: p.upscayl_image || null
          }
        };
      });

      // Attach products to orders
      parsedOrders.forEach((order: any) => {
        order.products = parsedProducts.filter((p: any) => String(p.order_id) === String(order.id));
      });
    } else {
      // No orders, set empty products array
      parsedOrders.forEach((order: any) => {
        order.products = [];
      });
    }

    // Build paginator info
    const lastPage = Math.ceil(total / perPage);

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ TOTAL /api/orders/list: ${totalTime}ms\n`);

    // Return simplified order structure with only needed fields
    return res.status(200).json({
      data: parsedOrders.map((o: any) => ({
        id: String(o.id),
        tracking_number: o.tracking_number,
        order_num: o.order_num || o.tracking_number, // Use order_num field if exists
        customer_id: o.customer_id ? String(o.customer_id) : null,
        status: typeof o.status === 'object' ? o.status : { id: parseInt(o.status) },
        email_send: parseInt(o.email_send || 0),
        amount: parseFloat(o.amount || 0),
        paid_total: parseFloat(o.paid_total || 0),
        total: parseFloat(o.total || 0),
        shipping_address: o.shipping_address,
        billing_address: o.billing_address,
        created_at: o.created_at,
        updated_at: o.updated_at,
        created_vn_time: o.created_vn_time,
        products: o.products || [], // Always array, each product always has name
      })),
      current_page: currentPage,
      first_page_url: `/?page=1`,
      from: offset + 1,
      last_page: lastPage,
      last_page_url: `/?page=${lastPage}`,
      next_page_url: currentPage < lastPage ? `/?page=${currentPage + 1}` : null,
      path: `/`,
      per_page: perPage,
      prev_page_url: currentPage > 1 ? `/?page=${currentPage - 1}` : null,
      to: offset + parsedOrders.length,
      total,
    });
  } catch (error: any) {
    console.error('❌ Error fetching orders:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sql: error.sql
    });
    return res.status(500).json({ 
      error: 'Failed to fetch orders', 
      details: error.message,
      code: error.code
    });
  }
}

