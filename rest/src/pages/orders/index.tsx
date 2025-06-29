import Card from "@components/common/card";
import Layout from "@components/layouts/admin";
import Search from "@components/common/search";
import OrderList from "@components/order/order-list";
import { useState } from "react";
import ErrorMessage from "@components/ui/error-message";
import Loader from "@components/ui/loader/loader";
import { useOrdersQuery } from "@data/order/use-orders.query";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { SortOrder } from "@ts-types/generated";
import { adminOnly } from "@utils/auth-utils";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { DollarSign, PackageCheck, ClipboardCopy } from "lucide-react";
import { toast } from "react-toastify";

export default function Orders() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [orderBy, setOrder] = useState("created_vn_time");
  const [sortedBy, setColumn] = useState<SortOrder>(SortOrder.Desc);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [onlyStatusOne, setOnlyStatusOne] = useState(false);
  const [limit, setLimit] = useState(200);
  const [filters, setFilters] = useState({ text: "", date: undefined, status: undefined });
  const [isTodayFilter, setIsTodayFilter] = useState(false);

  const { data, isLoading, error } = useOrdersQuery({
    limit,
    page,
    orderBy,
    sortedBy,
    ...(filters as any),
  });

  const todayOrders = data?.orders?.data || [];
  const totalTodayCount = todayOrders.length;
  const totalTodayAmount = todayOrders.reduce((sum, order) => sum + (Number(order.paid_total) || 0), 0);

  if (isLoading) return <Loader text={t("common:text-loading")} />;
  if (error) return <ErrorMessage message={error.message} />;

  const handleSearch = ({ searchText }: { searchText: string }) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, text: searchText }));
  };

  const handlePagination = (current: number) => {
    setPage(current);
  };

  const handleTodayFilter = () => {
    const today = new Date();
    setSelectedDate(today);
    setIsTodayFilter(true);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      date: format(today, "yyyy-MM-dd"),
      status: onlyStatusOne ? 1 : undefined,
    }));
  };

  const handleApplyFilter = () => {
    setPage(1);
    setIsTodayFilter(false);
    setFilters((prev) => ({
      ...prev,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined,
      status: onlyStatusOne ? 1 : undefined,
    }));
  };

  const handleCopyAllNames = () => {
    const names = todayOrders
      .map((order) => order.shipping_address?.shipping_name)
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(names);
    toast.success("All names copied!");
  };

  return (
    <>
      <Card className="flex flex-col gap-4 mb-8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-heading">{t("form:input-label-orders")}</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleTodayFilter}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Today
            </button>

            {isTodayFilter && (
              <>
                <button
                  onClick={handleCopyAllNames}
                  className="flex items-center gap-1 text-sm text-gray-700 hover:text-black"
                  title="Copy all customer names"
                >
                  <ClipboardCopy className="w-4 h-4" />
                  Copy All Names
                </button>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <PackageCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">{totalTodayCount} orders</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-medium">
                    ${totalTodayAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center justify-between">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            className="border px-2 py-1 rounded"
            placeholderText="Select date"
            dateFormat="yyyy-MM-dd"
          />

          <label className="flex items-center text-sm gap-2">
            <input
              type="checkbox"
              checked={onlyStatusOne}
              onChange={(e) => setOnlyStatusOne(e.target.checked)}
              className="accent-blue-500"
            />
            Status = 1
          </label>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border px-2 py-1 rounded text-sm"
          >
            <option value={200}>200 / page</option>
            <option value={500}>500 / page</option>
          </select>

          <button
            onClick={handleApplyFilter}
            className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Apply Filter
          </button>

          <div className="ml-auto w-full md:w-auto">
            <Search onSearch={handleSearch} />
          </div>

          {todayOrders.some((o) => o.status?.id === 77) && (
          <div className="w-full text-sm text-red-700 bg-red-100 border border-red-300 rounded p-3">
            <strong>Errors:</strong>
            <ul className="list-disc list-inside mt-1">
              {todayOrders
                .filter((o) => o.status?.id === 77)
                .map((o) => (
                  <li key={o.id}>
                    {o.shipping_address?.shipping_name || "Unknown Customer"}
                  </li>
                ))}
            </ul>
          </div>
        )}
        </div>
      </Card>

      <OrderList
        orders={data?.orders}
        onPagination={handlePagination}
        onOrder={setOrder}
        onSort={setColumn}
      />
    </>
  );
}

Orders.authenticate = {
  permissions: adminOnly,
};

Orders.Layout = Layout;

export const getStaticProps = async ({ locale }: any) => ({
  props: {
    ...(await serverSideTranslations(locale, ["table", "common", "form"])),
  },
});
