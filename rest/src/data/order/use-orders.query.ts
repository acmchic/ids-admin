import { QueryParamsType, QueryOptionsType } from "@ts-types/custom.types";
import { mapPaginatorData } from "@utils/data-mappers";
import { useQuery } from "react-query";
import { API_ENDPOINTS } from "@utils/api/endpoints";
import Order from "@repositories/order";

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

  // Call external API (orders.idreamshirt.com)
  const url = `${API_ENDPOINTS.ORDERS}?${urlParams.toString()}`;

  const { data } = await Order.all(url);

  return {
    orders: {
      data: data.data,
      paginatorInfo: mapPaginatorData(data),
    },
  };
};

const useOrdersQuery = (params: QueryOptionsType = {}, options: any = {}) => {
  return useQuery<any, Error>([API_ENDPOINTS.ORDERS, params], fetchOrders, {
    ...options,
    keepPreviousData: true,
    // Optimized cache settings - balance between fresh data and server load
    staleTime: 60 * 1000, // Cache for 60 seconds - reduces unnecessary requests
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes for quick navigation
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Refetch on component mount
    // refetchInterval: REMOVED - don't poll server continuously to reduce load
  });
};

export { useOrdersQuery, fetchOrders };
