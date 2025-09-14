import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface FailedOrder {
  order_id: string;
  timestamp: string;
  error: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Path to Laravel log file
    const logPath = '/Users/ac/workspace/ids/orders/storage/logs/laravel.log';
    
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    // Read log file
    const logContent = fs.readFileSync(logPath, 'utf-8');
    const lines = logContent.split('\n');
    
    const failedOrders: FailedOrder[] = [];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Parse log lines for failed fulfill attempts
    for (const line of lines) {
      if (line.includes('❌ Tất cả factory đều thất bại') && line.includes(today)) {
        try {
          // Extract timestamp
          const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
          const timestamp = timestampMatch ? timestampMatch[1] : '';
          
          // Extract order_id from JSON part
          const jsonMatch = line.match(/\{.*\}/);
          if (jsonMatch) {
            const jsonData = JSON.parse(jsonMatch[0]);
            if (jsonData.order_id) {
              failedOrders.push({
                order_id: jsonData.order_id,
                timestamp: timestamp,
                error: jsonData.last_error
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
