import { QueryParamsType, QueryOptionsType } from "@ts-types/custom.types";
import { mapPaginatorData } from "@utils/data-mappers";
import { useQuery } from "react-query";
import Orders from "@repositories/type";
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
  } = params as QueryOptionsType;

  const urlParams = new URLSearchParams();

  if (text) urlParams.append("text", text);
  if (date) urlParams.append("date", date);
  if (status !== undefined) urlParams.append("status", String(status));

  urlParams.append("page", String(page));
  urlParams.append("limit", String(limit));
  urlParams.append("orderBy", orderBy);
  urlParams.append("sortedBy", sortedBy);

  const url = `${API_ENDPOINTS.ORDERS}?${urlParams.toString()}`;

  const {
    data: { data, ...rest },
  } = await Orders.all(url);

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
  });
};

export { useOrdersQuery, fetchOrders };
