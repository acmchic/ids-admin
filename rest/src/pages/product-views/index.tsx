import Card from "@components/common/card";
import Layout from "@components/layouts/admin";
import ErrorMessage from "@components/ui/error-message";
import Loader from "@components/ui/loader/loader";
import { adminOnly } from "@utils/auth-utils";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useEffect, useMemo, useState } from "react";

type ActivityItem = {
  id: number;
  ip: string;
  source: string;
  url: string;
  product_slug: string;
  catalog_slug: string;
  product_image?: string;
  added_to_cart: boolean;
  cart_item_count: number;
  view_count: number;
  cart_items: Array<{ id?: string; date?: string; button?: string }>;
  device?: {
    os?: string;
    browser?: string;
    device?: string;
    isBot?: boolean;
  };
  location?: {
    country?: string;
    region?: string;
    city?: string;
    map_link?: string;
  };
  created_at: string;
};

type ActivityResponse = {
  data: ActivityItem[];
  current_page: number;
  per_page: number;
  total: number;
};

const formatDateTime = (value: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTodayDateValue = () => {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;

  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

const getDeviceLabel = (item: ActivityItem) => {
  const parts = [
    item.device?.device || "desktop",
    item.device?.browser,
    item.device?.os,
  ].filter(Boolean);

  return parts.join(" / ") || "--";
};

const getVisitorIpLabel = (ip?: string) => {
  if (!ip) return "--";
  if (ip.includes(":")) return "--";

  return ip;
};

export default function ProductViewsPage() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [added, setAdded] = useState("all");
  const [hideHanoi, setHideHanoi] = useState(true);
  const [limit, setLimit] = useState(200);

  const loadActivity = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        page: "1",
        added,
        hide_hanoi: hideHanoi ? "1" : "0",
      });

      if (text.trim()) params.set("text", text.trim());
      if (date) params.set("date", date);

      const response = await fetch(`/api/product-views?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to fetch product views");
      }

      setData(payload);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch product views");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [added, date, hideHanoi, limit]);

  const rows = data?.data || [];
  const addedCount = useMemo(() => rows.filter((item) => item.added_to_cart).length, [rows]);
  const viewedOnlyCount = rows.length - addedCount;

  return (
    <>
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-heading">Product Views</h1>
            <p className="mt-1 text-sm text-gray-500">
              Product pages viewed by visitors and whether they added an item to cart.
            </p>
          </div>

          <button
            onClick={loadActivity}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase text-gray-500">Rows</div>
            <div className="mt-1 text-xl font-semibold text-gray-900">{rows.length}</div>
          </div>
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs uppercase text-emerald-700">Added Cart</div>
            <div className="mt-1 text-xl font-semibold text-emerald-700">{addedCount}</div>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs uppercase text-amber-700">Viewed Only</div>
            <div className="mt-1 text-xl font-semibold text-amber-700">{viewedOnlyCount}</div>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3">
            <div className="text-xs uppercase text-gray-500">Total Logs</div>
            <div className="mt-1 text-xl font-semibold text-gray-900">{data?.total ?? 0}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadActivity();
            }}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm md:w-80"
            placeholder="Search product URL, source, IP"
          />

          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />

          <button
            onClick={() => setDate(getTodayDateValue())}
            className={`rounded border px-4 py-2 text-sm font-medium ${
              date === getTodayDateValue()
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Today
          </button>

          <select
            value={added}
            onChange={(event) => setAdded(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All activity</option>
            <option value="yes">Added to cart</option>
            <option value="no">Viewed only</option>
          </select>

          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={100}>100 rows</option>
            <option value={200}>200 rows</option>
            <option value={500}>500 rows</option>
          </select>

          <label className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hideHanoi}
              onChange={(event) => setHideHanoi(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Hide Hanoi test
          </label>

          <button
            onClick={loadActivity}
            className="rounded bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            Apply
          </button>
        </div>
      </Card>

      {loading ? (
        <Loader text="Loading activity" />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Catalog</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Cart</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Visitor</th>
                  <th className="px-4 py-3">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="min-w-[360px] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_slug || "Product"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                              No img
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-words font-medium text-blue-600 hover:underline"
                          >
                            {item.product_slug || item.url}
                          </a>
                          <div className="mt-1 break-all text-xs text-gray-400">{item.url}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {item.catalog_slug || "--"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {item.view_count || 1}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {item.added_to_cart ? (
                        <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Added ({item.cart_item_count})
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                          Viewed only
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {item.source}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      <div>{getVisitorIpLabel(item.ip)}</div>
                      {item.location?.map_link ? (
                        <a
                          href={item.location.map_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {item.location.city || item.location.region || item.location.country || "Map"}
                        </a>
                      ) : (
                        <div className="text-xs text-gray-400">
                          {item.location?.city || item.location?.region || item.location?.country || "--"}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {getDeviceLabel(item)}
                    </td>
                  </tr>
                ))}

                {!rows.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={8}>
                      No product views found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

ProductViewsPage.authenticate = {
  permissions: adminOnly,
};

ProductViewsPage.Layout = Layout;

export const getServerSideProps: GetServerSideProps = async ({ locale, res }) => {
  res.setHeader("Cache-Control", "no-store");

  return {
    props: {
      ...(await serverSideTranslations(locale!, ["table", "common", "form"])),
    },
  };
};
