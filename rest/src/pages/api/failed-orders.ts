import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import os from 'os';

interface FailedOrder {
  order_id: string;
  customer_name: string;
  timestamp: string;
  error: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    // Skip on Windows - Laravel log path is macOS specific
    if (os.platform() === 'win32') {
      console.log(`⏱️ /api/failed-orders: ${Date.now() - startTime}ms (Windows - skipped)`);
      return res.status(200).json({ 
        success: true,
        failed_orders: [],
        count: 0,
        message: 'Skipped on Windows'
      });
    }

    // Path to Laravel log file (local development - macOS)
    const logPath = '/Users/ac/workspace/ids/orders/storage/logs/laravel.log';
    
    // Quick check - return immediately if file doesn't exist
    if (!fs.existsSync(logPath)) {
      console.log(`⏱️ /api/failed-orders: ${Date.now() - startTime}ms (no file)`);
      return res.status(200).json({ 
        success: true,
        failed_orders: [],
        count: 0,
        message: 'No log file found'
      });
    }

    // Read only last 1000 lines for performance
    const logContent = fs.readFileSync(logPath, 'utf-8');
    const allLines = logContent.split('\n').filter(line => line.trim());
    const lines = allLines.slice(-1000); // Only read last 1000 lines
    
    const failedOrders: FailedOrder[] = [];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Parse log lines for failed fulfill attempts
    for (const line of lines) {
      if (line.includes('❌ Tất cả factory đều thất bại') || line.includes('❌ Fulfillment failed with Merchize')) {
        try {
          // Only process today's logs
          if (!line.includes(today)) continue;
          
          // Extract timestamp
          const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
          const timestamp = timestampMatch ? timestampMatch[1] : '';
          
          // Extract order_id and customer_name from JSON part
          const jsonMatch = line.match(/\{.*\}/);
          if (jsonMatch) {
            const jsonData = JSON.parse(jsonMatch[0]);
            if (jsonData.order_id && jsonData.customer_name) {
              failedOrders.push({
                order_id: jsonData.order_id,
                customer_name: jsonData.customer_name,
                timestamp: timestamp,
                error: jsonData.last_error || jsonData.response
              });
            }
          }
        } catch (parseError) {
          console.error('Error parsing log line:', parseError);
          continue;
        }
      }
    }

    // Remove duplicates and get only recent failures (last 24 hours)
    const uniqueFailedOrders = failedOrders
      .filter((order, index, self) => 
        index === self.findIndex(o => o.order_id === order.order_id)
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10); // Limit to 10 most recent

    console.log(`⏱️ /api/failed-orders: ${Date.now() - startTime}ms (${uniqueFailedOrders.length} failures)`);

    res.status(200).json({
      success: true,
      failed_orders: uniqueFailedOrders,
      count: uniqueFailedOrders.length
    });

  } catch (error) {
    console.error('Failed orders API error:', error);
    res.status(500).json({ 
      error: 'Failed to read failed orders',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


