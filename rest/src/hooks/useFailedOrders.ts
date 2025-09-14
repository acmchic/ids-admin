import { useState, useEffect } from 'react';

interface FailedOrder {
  order_id: string;
  timestamp: string;
  error: any;
}

interface FailedOrdersResponse {
  success: boolean;
  failed_orders: FailedOrder[];
  count: number;
}

export const useFailedOrders = (refreshInterval: number = 30000) => {
  const [failedOrders, setFailedOrders] = useState<FailedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFailedOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/failed-orders');
      const data: FailedOrdersResponse = await response.json();
      
      if (data.success) {
        setFailedOrders(data.failed_orders);
      } else {
        setError('Failed to fetch failed orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch failed orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately
    fetchFailedOrders();
    
    // Set up interval for periodic refresh
    const interval = setInterval(fetchFailedOrders, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return {
    failedOrders,
    loading,
    error,
    refetch: fetchFailedOrders
  };
};
