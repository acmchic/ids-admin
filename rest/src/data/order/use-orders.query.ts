import { QueryParamsType, QueryOptionsType } from "@ts-types/custom.types";
import { mapPaginatorData } from "@utils/data-mappers";
import { useQuery } from "react-query";
import { API_ENDPOINTS } from "@utils/api/endpoints";

const fetchOrders = async ({ queryKey }: QueryParamsType) => {
  const [_key, params] = queryKey;
  const {
    text,
    page = 1,
    limit = 20,
    orderBy = "updated_at",
    sortedBy = "DESC",
    date,
    status,
    status_in,
    shop_id,
  } = params as QueryOptionsType;

  const urlParams = new URLSearchParams();

  if (text) urlParams.append("text", text);
  if (date) urlParams.append("date", date);
  if (status !== undefined) urlParams.append("status", String(status));
  if (status_in !== undefined) urlParams.append("status_in", String(status_in));
  if (shop_id !== undefined) urlParams.append("shop_id", String(shop_id));

  urlParams.append("page", String(page));
  urlParams.append("limit", String(limit));
  urlParams.append("orderBy", orderBy);
  urlParams.append("sortedBy", sortedBy);

  // Call internal Next.js API instead of external API
  const url = `/api/orders/list?${urlParams.toString()}`;

  const response = await fetch(url);
  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData.error || 'Failed to fetch orders');
  }

  const { data, ...rest } = responseData;

  return {
    orders: {
      data,
      paginatorInfo: mapPaginatorData({ ...rest }),
    },
  };
};

const useOrdersQuery = (params: QueryOptionsType = {}, options: any = {}) => {
  return useQuery<any, Error>([API_ENDPOINTS.ORDERS, params], fetchOrders, {
    ...options,
    keepPreviousData: true,
    // Override default cache settings for orders - always fetch fresh data
    staleTime: 0, // Data is immediately stale, will refetch on mount/focus
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes for quick navigation
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Always refetch on component mount
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds when component is mounted
  });
};

export { useOrdersQuery, fetchOrders };
