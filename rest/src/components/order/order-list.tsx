import { useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import Image from "next/dist/client/image";
import { BiSolidTShirt } from "react-icons/bi";
import { toast } from "react-toastify";
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { Table } from "@components/ui/table";
import Pagination from "@components/ui/pagination";
import ActionButtons from "@components/common/action-buttons";
import TitleWithSort from "@components/ui/title-with-sort";
import Link from "@components/ui/link";
import { PacmanLoader } from "react-spinners";

import { useIsRTL } from "@utils/locals";
import { UsState } from "../../utils/us-states";
import { AlertTriangle } from "lucide-react";

import {
  OrderPaginator,
  OrderStatus,
  SortOrder,
  UserAddress1,
} from "@ts-types/generated";

const logFulfilledOrders = async (orders: any[], statusCode: number) => {
  try {
    const now = new Date();
    const yyyyMM = now.toISOString().slice(0, 7); // e.g., "2025-06"
    const dd = now.toISOString().slice(8, 10); // e.g., "09"

    const ffName = statusCode === 68 ? "merchize" : statusCode === 9 ? "burger" : "gearment";
    const logFileName = `/logs/${yyyyMM}/${dd}/${ffName}.log`;

    const logLines = orders.map(order => {
      const customerName = order.shipping_address?.shipping_name || "Unknown";
      return `${customerName}`;
    });

    await fetch('/api/log-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: logFileName, lines: logLines })
    });
  } catch (err) {
    console.error("Log error:", err);
  }
};

const logFulfilledOrdersError = async (orders: any[], statusCode: number, errorMessage: string) => {
  try {
    const now = new Date();
    const yyyyMM = now.toISOString().slice(0, 7);
    const dd = now.toISOString().slice(8, 10);

    const ffName = statusCode === 68 ? "merchize" : statusCode === 9 ? "burger" : "gearment";
    const logFileName = `/logs/${yyyyMM}/${dd}/${ffName}.error.log`;

    const logLines = orders.map(order => {
      const customerName = order.shipping_address?.shipping_name || "Unknown";
      return `❌ ${customerName} | Order ID: ${order.id} | Error: ${errorMessage}`;
    });

    await fetch('/api/log-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: logFileName, lines: logLines })
    });
  } catch (err) {
    console.error("Log write error:", err);
  }
};


type IProps = {
  orders: OrderPaginator | null | undefined;
  onPagination: (current: number) => void;
  onSort: (current: any) => void;
  onOrder: (current: string) => void;
};

const nameToSlug = (name: string) =>
  name.replace(/T-Shirt/gi, "t-shirt")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();

const convertToAtworkUrl = (imgUrl: string): string =>
  imgUrl.replace(/\/media\/(\d+)\/[^/]+\//, "/media/$1/atwork/");


const OrderList = ({ orders, onPagination, onSort, onOrder }: IProps) => {
  const { data, paginatorInfo } = orders ?? {};
  const { t } = useTranslation();
  const router = useRouter();
  const { alignLeft } = useIsRTL();

  const [loading, setLoading] = useState(false);
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const [selectedOrders, setSelectedOrders] = useState<Record<string, number>>({});
  const [sortingObj, setSortingObj] = useState({ sort: SortOrder.Desc, column: null });

  const onHeaderClick = (column: string | null) => ({
    onClick: () => {
      onSort((cur: SortOrder) => (cur === SortOrder.Desc ? SortOrder.Asc : SortOrder.Desc));
      onOrder(column!);
      setSortingObj({
        sort: sortingObj.sort === SortOrder.Desc ? SortOrder.Asc : SortOrder.Desc,
        column,
      });
    },
  });

  const handleUnifiedFulfill = async () => {
    setLoading(true);
    toast.info("Processing fulfill...!!");
  
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
  
    try {
      const grouped: Record<number, any[]> = {};
      data?.forEach(order => {
        const status = selectedOrders[order.id];
        if (status) {
          if (!grouped[status]) grouped[status] = [];
          grouped[status].push(order);
        }
      });
  
      for (const status of Object.keys(grouped)) {
        const ordersForStatus = grouped[+status];
  
        for (const order of ordersForStatus) {
          try {
            await axios.put(`https://orders.idreamshirt.com/orders/${order.id}`, {
              status: +status,
            });
            await logFulfilledOrders([order], +status);
          } catch (err: any) {
            console.error(`❌ Failed to fulfill order ${order.id}`, err);
          
            const errMsg =
              err?.response?.data?.message ||
              err?.message ||
              "Unknown error";
          
            await logFulfilledOrdersError([order], +status, errMsg);
          }
  
          await sleep(500);
        }
      }
  
      toast.success("All selected orders fulfilled.");
      setSelectedOrders({});
      router.reload();
    } catch (e) {
      console.error(e);
      toast.error("Some fulfillments failed.");
    } finally {
      setLoading(false);
    }
  };
  

  const columns = [
    {
      title: "Fulfill",
      dataIndex: "id",
      key: "select",
      align: "center",
      width: 200,
      render: (_: any, row: any) => {
        const hasClassicTee = row.products?.some((product: any) => {
          const variant = product.pivot?.variation
            ? JSON.parse(product.pivot.variation)
            : null;
          const variantName = nameToSlug(variant?.name || "");
          return variantName.includes("classic-t-shirt");
        });
    
        const fulfillments = hasClassicTee
          ? [
            { label: "G", value: 2, color: "blue" },
              { label: "B_F", value: 12, color: "red" },
              { label: "B_G", value: 11, color: "red" },
            ]
          : [{ label: "G", value: 2, color: "blue" },{ label: "B", value: 9, color: "red" }];
    
        return (
          <div className="flex flex-row justify-center gap-3">
            {fulfillments.map(ff => (
              <button
                key={ff.value}
                onClick={() =>
                  setSelectedOrders(prev => ({ ...prev, [row.id]: ff.value }))
                }
                className={`px-3 py-2 rounded-md border text-white bg-${ff.color}-500 hover:bg-${ff.color}-600 text-sm ${
                  selectedOrders[row.id] === ff.value
                    ? 'ring-2 ring-offset-1 ring-' + ff.color + '-300'
                    : ''
                }`}
              >
                {ff.label}
              </button>
            ))}
          </div>
        );
      },
    }
    ,
    
    {
      title: "Customer",
      dataIndex: "shipping_address",
      key: "shipping_info",
      align: alignLeft,
      width: 150,
      render: (shipping_address: UserAddress1) => {
        const name = shipping_address.shipping_name || "";
        const street = shipping_address.shipping_address1 || "";
        const city = shipping_address.shipping_city || "";
        const provinceCode = shipping_address.shipping_province_code || "";
        const zipcode = shipping_address.shipping_zipcode || "";
        const shippingMethod = shipping_address.shipping_method || "standard";
    
        const stateNames = UsState();
        const stateFullName = stateNames[provinceCode as keyof typeof stateNames] || provinceCode;
    
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${street}, ${city}, ${zipcode}, ${stateFullName} (US)`
        )}`;
    
        const handleCopy = () => {
          navigator.clipboard.writeText(name);
          toast.success("COPIED");
        };
    
        return (
          <div className="text-sm text-blue-600 flex flex-col gap-8">
            <div>
              <p
                className="cursor-pointer hover:underline text-blue-500"
                onClick={handleCopy}
                title="Click to copy"
              >
                {name}
              </p>
              {shippingMethod === "express" && (
                <p className="text-xs text-red-600 pt-6 font-semibold uppercase">Express Shipping</p>
              )}
            </div>
    
            <Link
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-xs  text-black"
            >
              {stateFullName}
            </Link>
          </div>
        );
      },
    },
    {
      title: "ID",
      dataIndex: "products",
      key: "products",
      align: "center",
      width: 100,
      render: (products: any[]) => (
        <div className="flex flex-col gap-2">
          {products.map((product, index) => (
            <div key={`${product.id}-${index}`} className="mb-2 text-center">
             <p>{product.id}</p>
              {product.image?.original && (
                <p
                className={`mt-1 text-md ${product.id > 104585 ? "text-red-500" : ""
                  }`}
              >
                  {product.image.original.split("/").slice(0, 2).join("/")}
                </p>
              )}
            </div>
          ))}
        </div>
      ),
    },
    

    {
      title: "Name",
      dataIndex: "products",
      key: "products",
      align: "center",
      width: 200,
      render: (products: any[]) => (
        <div className="flex flex-col gap-2">
          {products.map((product, index) => {
            const variant = product.pivot?.variation
              ? JSON.parse(product.pivot.variation)
              : null;
    
            const variantName = nameToSlug(variant?.name ?? "");
            const color = nameToSlug(variant?.color ?? "");
            const size = nameToSlug(variant?.size ?? "");
            const side = variant?.side ?? "";
    
            return (
              <div key={`${product.id}-${index}`} className="mb-2 text-center">
                {/* Hiển thị impress & click */}
                <p className="text-xs text-gray-700">
                  Imp: {product.impressions ?? 0} | Click: {product.clicks ?? 0}
                </p>
    
                {/* Tên sản phẩm (có link) */}
                <p
                  className="mt-1 text-sm cursor-pointer text-blue-500 hover:underline"
                  onClick={() =>
                    window.open(
                      `https://idreamshirt.com/products/${product.slug}/${variantName}-${color}-size_${size}`,
                      "_blank"
                    )
                  }
                >
                  {product.name.length > 20
                    ? `${product.name.slice(0, 20)}...`
                    : product.name}
                </p>
    
                {/* Hiển thị side nếu có */}
                {side && (
                  <p className="text-xs text-gray-500 pt-2">{side}</p>
                )}
              </div>
            );
          })}
        </div>
      ),
    }
    ,
    {
      title: "Image",
      dataIndex: "products",
      key: "products",
      align: "center",
      width: 200,
      render: (products: any[]) => (
        <div className="flex flex-col">
          {products.map((product, index) => {
            const imgUrl = product.pivot?.img_url || "";
            const match = imgUrl.split("/media/")[1]?.split("/")[0] || "";
    
            return (
              <div key={`${product.id}-${index}`} className="mb-2 text-center">
                <Image
                  src={imgUrl}
                  alt={product.name}
                  width={100}
                  height={100}
                  className="rounded-md"
                />
                {match && (
                  <p className="pt-1">{match}</p>
                )}
              </div>
            );
          })}
        </div>
      ),
    },
    
    {
      title: "ATWORK",
      dataIndex: "products",
      key: "products",
      align: "center",
      width: 200,
      render: (products: any[]) => (
        <div className="flex flex-col">
          {products.map((product, index) => (
            <div
              key={`${product.id}-${index}`}
              className="mb-2 text-center relative group"
            >
              
    
              <div className="inline-block transition-transform transform group-hover:scale-150 relative">
                <a
                  href={product.img_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src={convertToAtworkUrl(product.pivot.img_url)}
                    alt={product.name}
                    width={130}
                    height={150}
                    className="rounded-md object-cover"
                  />
                </a>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    
    

    {
      title: (
        <TitleWithSort
          title={t("table:table-item-total")}
          ascending={sortingObj.sort === SortOrder.Asc && sortingObj.column === "total"}
          isActive={sortingObj.column === "total"}
        />
      ),
      className: "cursor-pointer",
      dataIndex: "total",
      key: "total",
      align: "center",
      width: 120,
      onHeaderCell: () => onHeaderClick("total"),
      render: (total: number, record: any) => {
        const discount = record.discount || 0;

        return (
          <span>
            {total.toFixed(2)}
            {discount > 0 && (
              <span className="text-red-500"> ({discount.toFixed(2)})</span>
            )}
          </span>
        );
      },
    },

    {
      title: (
        <TitleWithSort
          title={t("table:table-item-order-date")}
          ascending={
            sortingObj.sort === SortOrder.Asc &&
            sortingObj.column === "created_at"
          }
          isActive={sortingObj.column === "created_at"}
        />
      ),
      className: "cursor-pointer",
      dataIndex: "created_at",
      key: "created_at",
      align: "center",
      onHeaderCell: () => onHeaderClick("created_at"),
      render: (date: string) => {
        dayjs.extend(relativeTime);
        dayjs.extend(utc);
        dayjs.extend(timezone);
        return (
          <span className="whitespace-nowrap">
            {dayjs.utc(date).tz(dayjs.tz.guess()).fromNow()}
          </span>
        );
      },
    },
    {
      title: (
        <TitleWithSort
          title={t("table:table-item-status")}
          ascending={
            sortingObj.sort === SortOrder.Asc && sortingObj.column === "status"
          }
          isActive={sortingObj.column === "status"}
        />
      ),
      className: "cursor-pointer",
      dataIndex: "status",
      key: "status",
      align: alignLeft,
      onHeaderCell: () => onHeaderClick("status"),
      render: (status: OrderStatus) => {
        let additionalText = "";
    
        if (status?.id === 2) additionalText = "(G)";
        else if (status?.id === 9) additionalText = "(Burgerprint)";
        else if (status?.id === 8) additionalText = "(Printway)";
    
        if (status?.id === 77) {
          return (
            <span className="text-red-600 font-semibold flex items-center gap-1">
              <AlertTriangle size={16} className="text-red-500" />
              Error
            </span>
          );
        }
    
        return (
          <span
            className="whitespace-nowrap font-semibold"
            style={{ color: status?.color }}
          >
            {status?.name} {additionalText}
          </span>
        );
      },
    },

    {
      title: "Tracking",
      dataIndex: "tracking_number",
      key: "tracking",
      align: "center",
      width: 200,
      render: (_: any, row: any) => {
        const trackingNumber = row.tracking_number || "No Tracking";
        const trackingUrl = row.tracking_url || "";
    
        return (
          <div className="flex flex-col items-center text-sm text-blue-600">
            <p>{trackingNumber}</p>
            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-xs text-blue-500 mt-1"
              >
                View Tracking
              </a>
            )}
          </div>
        );
      },
    },
    
    
    {
      title: t("table:table-item-actions"),
      dataIndex: "id",
      key: "actions",
      align: "center",
      width: 200,
      render: (id: string, status: string) => {
        if (!id) return null;
    
        const handleFulfill = async () => {
          setLoadingRows((prev) => ({ ...prev, [id]: true }));
    
          try {
            await axios.put(`https://orders.idreamshirt.com/orders/${id}`, { status: 2 });
            toast.success("Order fulfilled successfully!");
          } catch (error) {
            toast.error("Failed to fulfill the order. Please try again.");
          } finally {
            setLoadingRows((prev) => ({ ...prev, [id]: false }));
          }
        };
    
        const handleBurger = async () => {
          setLoadingRows((prev) => ({ ...prev, [`burger-${id}`]: true }));
    
          try {
            await axios.put(`https://orders.idreamshirt.com/orders/${id}`, { status: 9 });
            toast.success("Burger order fulfilled successfully!");
          } catch (error) {
            toast.error("Failed to fulfill the burger order. Please try again.");
          } finally {
            setLoadingRows((prev) => ({ ...prev, [`burger-${id}`]: false }));
          }
        };
        const handleMerchize = async () => {
          setLoadingRows((prev) => ({ ...prev, [`merchize-${id}`]: true }));
    
          try {
            await axios.put(`https://orders.idreamshirt.com/orders/${id}`, { status: 68 });
            toast.success("Merchize order fulfilled successfully!");
          } catch (error) {
            toast.error("Failed to fulfill the Merchize order. Please try again.");
          } finally {
            setLoadingRows((prev) => ({ ...prev, [`merchize-${id}`]: false }));
          }
        };
    
        return (
          <>
            <ActionButtons id={id} detailsUrl={`${router.asPath}/${id}`} />
            <div className="flex flex-col items-center gap-2">
              {/* Fulfill Button */}
              
              <button
                onClick={handleMerchize}
                disabled={loadingRows[`merchize-${id}`]}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-white bg-green-500 hover:bg-green-600 transition"
              >
                {loadingRows[`merchize-${id}`] ? (
                  <PacmanLoader size={15} color="#fff" loading={loadingRows[`burger-${id}`]} />
                ) : (
                  ''
                )}
                Merchize
              </button>
              {/* Burger Button */}
              <button
                onClick={handleBurger}
                disabled={loadingRows[`burger-${id}`]}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-white bg-red-500 hover:bg-red-600 transition"
              >
                {loadingRows[`burger-${id}`] ? (
                  <PacmanLoader size={15} color="#fff" loading={loadingRows[`burger-${id}`]} />
                ) : (
                  ''
                )}
                Burger
              </button>

              <button
                onClick={handleFulfill}
                disabled={loadingRows[id]}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-white bg-blue-500 hover:bg-blue-600 transition"
              >
                {loadingRows[id] ? (
                  <PacmanLoader size={15} color="#fff" loading={loadingRows[id]} />
                ) : (
                  <BiSolidTShirt />
                )}
                Fulfill
              </button>
            </div>
          </>
        );
      },
    }
    
  ];

  return (
    <>
      {Object.keys(selectedOrders).length > 0 && (
        <div className="mb-4">
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded"
            onClick={handleUnifiedFulfill}
          >
            Fulfill Selected ({Object.keys(selectedOrders).length})
          </button>
        </div>
      )}

      <div className="rounded overflow-hidden shadow mb-6">
        <Table
          //@ts-ignore
          columns={columns}
          emptyText={t("table:empty-table-data")}
          data={data}
          rowKey="id"
          scroll={{ x: 1000 }}
          expandable={{ expandIconColumnIndex: -1 }}
        />
      </div>

      {!!paginatorInfo?.total && (
        <div className="flex justify-end items-center">
          <Pagination
            total={paginatorInfo.total}
            current={paginatorInfo.currentPage}
            pageSize={paginatorInfo.perPage}
            onChange={onPagination}
          />
        </div>
      )}
    </>
  );

};

export default OrderList;
