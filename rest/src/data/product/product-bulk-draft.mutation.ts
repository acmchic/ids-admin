import { API_ENDPOINTS } from "@utils/api/endpoints";
import Product from "@repositories/product";
import { useMutation, useQueryClient } from "react-query";
import { toast } from "react-toastify";

type BulkDraftInput = {
  slugs: string[];
};

const bulkDraftProducts = async (input: BulkDraftInput) => {
  const { data } = await Product.create(API_ENDPOINTS.PRODUCTS_BULK_DRAFT, input as any);
  return data;
};

export const useBulkDraftProductsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(bulkDraftProducts, {
    onSuccess: (data: any) => {
      const updatedCount = data?.updatedCount ?? 0;
      const notFoundCount = data?.notFoundSlugs?.length ?? 0;

      if (data?.cacheWarning) {
        toast.warning(data.cacheWarning);
      } else {
        toast.success(`Moved ${updatedCount} product${updatedCount === 1 ? "" : "s"} to draft.`);
      }

      if (notFoundCount > 0) {
        toast.warning(`${notFoundCount} slug${notFoundCount === 1 ? "" : "s"} not found.`);
      }

      queryClient.invalidateQueries(API_ENDPOINTS.PRODUCTS);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to move products to draft.");
    },
  });
};
