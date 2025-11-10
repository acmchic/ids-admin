import Card from "@components/common/card";
import Layout from "@components/layouts/admin";
import Search from "@components/common/search";
import OrderList from "@components/order/order-list";
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { DollarSign, PackageCheck, ClipboardCopy, TrendingUp } from "lucide-react";
import { toast } from "react-toastify";
import StickerCard from "@components/widgets/sticker-card";

const ORDERS_API_BASE = (process.env.NEXT_PUBLIC_REST_API_ENDPOINT || "/api").replace(/\/+$/, "");

export default function Orders() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [orderBy, setOrder] = useState("created_vn_time");
  const [sortedBy, setColumn] = useState<SortOrder>(SortOrder.Desc);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [onlyStatusOne, setOnlyStatusOne] = useState(false);
  const [onlyStatus78, setOnlyStatus78] = useState(false);
  const [inProductionProcessing, setInProductionProcessing] = useState(false);
  const [limit, setLimit] = useState(200);
  const [filters, setFilters] = useState({ text: "", date: undefined, status: undefined, status_in: undefined });
  const [isTodayFilter, setIsTodayFilter] = useState(false);
  const [isYesterdayFilter, setIsYesterdayFilter] = useState(false);

  // Stats for cards
  const [todayStats, setTodayStats] = useState({ count: 0, total: 0 });
  const [yesterdayStats, setYesterdayStats] = useState({ count: 0, total: 0 });

  const { data, isLoading, error, isFetching } = useOrdersQuery({
    limit,
    page,
    orderBy,
    sortedBy,
    ...(filters as any),
  });

  const IN_PRODUCTION_STATUS_IDS = useMemo(() => [2, 8, 9, 11, 12, 68, 77, 78], []);

  const todayOrders = data?.orders?.data || [];
  const totalTodayCount = todayOrders.length;
  const totalTodayAmount = todayOrders.reduce((sum, order) => sum + (Number(order.paid_total) || 0), 0);
  const statusOneCount = useMemo(
    () => todayOrders.filter((order) => Number(order.status?.id) === 1).length,
    [todayOrders]
  );
  const statusSeventyEightCount = useMemo(
    () => todayOrders.filter((order) => Number(order.status?.id) === 78).length,
    [todayOrders]
  );
  const inProductionCount = useMemo(
    () =>
      todayOrders.filter((order) => IN_PRODUCTION_STATUS_IDS.includes(Number(order.status?.id))).length,
    [todayOrders, IN_PRODUCTION_STATUS_IDS]
  );

  // Load stats for today and yesterday - OPTIMIZED
  useEffect(() => {
    const fetchDailyStats = async (date: string) => {
      const restUrl = `${ORDERS_API_BASE}/orders/stats/daily?date=${date}`;
      try {
        const restResponse = await fetch(restUrl);
        if (restResponse.ok) {
          const restData = await restResponse.json();
          if (restData?.success) {
            return restData;
          }
        } else {
          throw new Error(`REST stats failed with ${restResponse.status}`);
        }
      } catch (error) {
        try {
          const fallbackResponse = await fetch(`/api/orders/stats?date=${date}`);
          if (!fallbackResponse.ok) {
            throw new Error(`Fallback stats failed with ${fallbackResponse.status}`);
          }
          return await fallbackResponse.json();
        } catch (fallbackError) {
          console.error("❌ Failed to fetch stats (fallback):", fallbackError);
          return null;
        }
      }

      return null;
    };

    const loadStats = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

      try {
        const [todayData, yesterdayData] = await Promise.all([
          fetchDailyStats(today),
          fetchDailyStats(yesterday),
        ]);

        if (todayData?.success) {
          setTodayStats({ count: todayData.count, total: todayData.total });
        }

        if (yesterdayData?.success) {
          setYesterdayStats({ count: yesterdayData.count, total: yesterdayData.total });
        }
      } catch (error) {
        console.error("❌ Failed to load stats:", error);
      }
    };

    loadStats();
  }, []);

  // Define callbacks BEFORE early returns (hooks must be called in same order every render)
  const handleSearch = useCallback(({ searchText }: { searchText: string }) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, text: searchText }));
  }, []);

  const handlePagination = useCallback((current: number) => {
    setPage(current);
  }, []);

  const applyStatusFilters = useCallback(
    (
      statusOne: boolean,
      statusSeventyEight: boolean,
      production: boolean,
      dateOverride?: string | null
    ) => {
      let dateValue: string | undefined;

      if (dateOverride !== undefined) {
        dateValue = dateOverride ?? undefined;
      } else if (isTodayFilter) {
        dateValue = format(new Date(), "yyyy-MM-dd");
      } else if (isYesterdayFilter) {
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        dateValue = format(yesterdayDate, "yyyy-MM-dd");
      } else if (selectedDate) {
        dateValue = format(selectedDate, "yyyy-MM-dd");
      }

      setPage(1);
      setFilters((prev) => {
        const next = {
          ...prev,
          date: dateValue,
          status: undefined as number | undefined,
          status_in: undefined as string | undefined,
        };

        if (production) {
          next.status_in = IN_PRODUCTION_STATUS_IDS.join(",");
        } else if (statusOne) {
          next.status = 1;
        } else if (statusSeventyEight) {
          next.status = 78;
        }

        return next;
      });
    },
    [IN_PRODUCTION_STATUS_IDS, isTodayFilter, isYesterdayFilter, selectedDate]
  );

  // Early returns AFTER all hooks
  if (isLoading && !data) return <Loader text={t("common:text-loading")} />;
  if (error) return <ErrorMessage message={error.message} />;

  const handleToggleStatusOne = () => {
    const nextStatusOne = !onlyStatusOne;
    const nextStatus78 = nextStatusOne ? false : onlyStatus78;
    const nextProduction = nextStatusOne ? false : inProductionProcessing;

    setOnlyStatusOne(nextStatusOne);
    setOnlyStatus78(nextStatus78);
    setInProductionProcessing(nextProduction);
    applyStatusFilters(nextStatusOne, nextStatus78, nextProduction);
  };

  const handleToggleStatusSeventyEight = () => {
    const nextStatus78 = !onlyStatus78;
    const nextStatusOne = nextStatus78 ? false : onlyStatusOne;
    const nextProduction = nextStatus78 ? false : inProductionProcessing;

    setOnlyStatus78(nextStatus78);
    setOnlyStatusOne(nextStatusOne);
    setInProductionProcessing(nextProduction);
    applyStatusFilters(nextStatusOne, nextStatus78, nextProduction);
  };

  const handleToggleInProduction = () => {
    const nextProduction = !inProductionProcessing;
    const nextStatusOne = nextProduction ? false : onlyStatusOne;
    const nextStatus78 = nextProduction ? false : onlyStatus78;

    setInProductionProcessing(nextProduction);
    setOnlyStatusOne(nextStatusOne);
    setOnlyStatus78(nextStatus78);
    applyStatusFilters(nextStatusOne, nextStatus78, nextProduction);
  };

  const handleExportImageList = () => {
    const imageList = [];

    for (const order of todayOrders) {
      for (const product of order.products || []) {
        if (product.img_url) {
          imageList.push({
            order_id: order.id,
            product_id: product.id,
            img_url: product.img_url
          });
        }
      }
    }

    const blob = new Blob([JSON.stringify(imageList, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "image_urls.json";
    link.click();
  };

  const handleTodayFilter = () => {
    const today = new Date();
    setSelectedDate(today);
    setIsTodayFilter(true);
    setIsYesterdayFilter(false);
    const todayString = format(today, "yyyy-MM-dd");
    applyStatusFilters(onlyStatusOne, onlyStatus78, inProductionProcessing, todayString);
  };

  const handleYesterdayFilter = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    setSelectedDate(yesterday);
    setIsTodayFilter(false);
    setIsYesterdayFilter(true);
    const yesterdayString = format(yesterday, "yyyy-MM-dd");
    applyStatusFilters(onlyStatusOne, onlyStatus78, inProductionProcessing, yesterdayString);
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
      {/* Stats Cards */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        <StickerCard
          titleTransKey="Today's Orders"
          subtitleTransKey="Orders placed today"
          icon={<PackageCheck className="w-7 h-7" color="#047857" />}
          iconBgStyle={{ backgroundColor: "#A7F3D0" }}
          price={`${todayStats.count} orders - $${todayStats.total.toFixed(2)}`}
        />
        <StickerCard
          titleTransKey="Yesterday's Orders"
          subtitleTransKey="Orders placed yesterday"
          icon={<DollarSign className="w-7 h-7" color="#DC2626" />}
          iconBgStyle={{ backgroundColor: "#FEE2E2" }}
          price={`${yesterdayStats.count} orders - $${yesterdayStats.total.toFixed(2)}`}
        />
        <StickerCard
          titleTransKey="Total Revenue"
          subtitleTransKey="Combined"
          icon={<TrendingUp className="w-7 h-7" color="#2563EB" />}
          iconBgStyle={{ backgroundColor: "#DBEAFE" }}
          price={`$${(todayStats.total + yesterdayStats.total).toFixed(2)}`}
        />
      </div>

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

  <button
    onClick={handleYesterdayFilter}
    className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
  >
    Yesterday
  </button>

  {(isTodayFilter || isYesterdayFilter) && (
    <>
      <button
        onClick={handleCopyAllNames}
        className="flex items-center gap-1 text-sm text-gray-700 hover:text-black"
        title="Copy all customer names"
      >
        <ClipboardCopy className="w-4 h-4" />
        Copy All Names
      </button>
      <button
        onClick={handleExportImageList}
        className="flex items-center gap-1 text-sm text-gray-700 hover:text-black"
        title="Generate List IMG"
      >
        <ClipboardCopy className="w-4 h-4 rotate-180" />
        Generate List IMG
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

          <div className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="checkbox"
                id="status-1"
                checked={onlyStatusOne}
                onChange={handleToggleStatusOne}
                className="sr-only"
              />
              <div
                className={`flex h-5 w-5 items-center justify-center rounded border-2 cursor-pointer transition-colors ${
                  onlyStatusOne
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-white border-gray-300 hover:border-gray-400'
                }`}
                onClick={handleToggleStatusOne}
              >
                {onlyStatusOne && (
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
            <label
              htmlFor="status-1"
              className="text-sm font-medium cursor-pointer select-none"
            >
              Status = 1 (Order Received)
              <span className="ml-2 text-xs text-gray-500">({statusOneCount})</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="checkbox"
                id="status-78"
                checked={onlyStatus78}
                onChange={handleToggleStatusSeventyEight}
                className="sr-only"
              />
              <div
                className={`flex h-5 w-5 items-center justify-center rounded border-2 cursor-pointer transition-colors ${
                  onlyStatus78
                    ? 'bg-red-500 border-red-500'
                    : 'bg-white border-gray-300 hover:border-gray-400'
                }`}
                onClick={handleToggleStatusSeventyEight}
              >
                {onlyStatus78 && (
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
            <label
              htmlFor="status-78"
              className="text-sm font-medium cursor-pointer select-none"
            >
              Status = 78 (Fulfill Failed)
              <span className="ml-2 text-xs text-gray-500">({statusSeventyEightCount})</span>
            </label>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50">
            <input
              type="checkbox"
              id="in-production-processing"
              checked={inProductionProcessing}
              onChange={handleToggleInProduction}
              className="w-4 h-4 text-orange-600 bg-white border-gray-300 rounded focus:ring-orange-500 focus:ring-2 cursor-pointer"
            />
            <label
              htmlFor="in-production-processing"
              className="text-sm font-medium cursor-pointer select-none"
            >
              In-Production & Processing
              <span className="ml-2 text-xs text-gray-500">({inProductionCount})</span>
            </label>
          </div>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border px-2 py-1 rounded text-sm"
          >
            <option value={200}>200 / page</option>
            <option value={500}>500 / page</option>
          </select>

          {isFetching && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <span className="inline-block h-4 w-4 border-b-2 border-blue-600 rounded-full animate-spin" />
              <span>Đang tải...</span>
            </div>
          )}

          <button
            onClick={() => {
              setSelectedDate(null);
              setOnlyStatusOne(false);
              setOnlyStatus78(false);
              setInProductionProcessing(false);
              setIsTodayFilter(false);
              setIsYesterdayFilter(false);
              setFilters({ text: "", date: undefined, status: undefined, status_in: undefined });
              setPage(1);
            }}
            className="px-4 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear All
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
