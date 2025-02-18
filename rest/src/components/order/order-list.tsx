import Pagination from "@components/ui/pagination";
import dayjs from "dayjs";
import { Table } from "@components/ui/table";
import ActionButtons from "@components/common/action-buttons";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  OrderPaginator,
  OrderStatus,
  SortOrder,
  UserAddress1,
} from "@ts-types/generated";

import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { useIsRTL } from "@utils/locals";
import { useState } from "react";
import TitleWithSort from "@components/ui/title-with-sort";
import Link from "@components/ui/link";
import Image from "next/dist/client/image";
import { BiSolidTShirt } from "react-icons/bi";
import { toast } from "react-toastify";
import axios from "axios";
import { PacmanLoader } from "react-spinners";
import Actions from "./action";

type IProps = {
  orders: OrderPaginator | null | undefined;
  onPagination: (current: number) => void;
  onSort: (current: any) => void;
  onOrder: (current: string) => void;
};

const convertToAtworkUrl = (imgUrl: string): string => {
  return imgUrl.replace(/\/media\/(\d+)\/[^/]+\//, "/media/$1/atwork/");
};

const OrderList = ({ orders, onPagination, onSort, onOrder }: IProps) => {
  const { data, paginatorInfo } = orders! ?? {};
  const { t } = useTranslation();
  const router = useRouter();
  const { alignLeft } = useIsRTL();
  const [loading, setLoading] = useState(false);
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});


  const [sortingObj, setSortingObj] = useState<{
    sort: SortOrder;
    column: string | null;
  }>({
    sort: SortOrder.Desc,
    column: null,
  });

  const onHeaderClick = (column: string | null) => ({
    onClick: () => {
      onSort((currentSortDirection: SortOrder) =>
        currentSortDirection === SortOrder.Desc ? SortOrder.Asc : SortOrder.Desc
      );
      onOrder(column!);

      setSortingObj({
        sort:
          sortingObj.sort === SortOrder.Desc ? SortOrder.Asc : SortOrder.Desc,
        column: column,
      });
    },
  });

  const columns = [
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
              <p
                className={`mt-1 text-sm ${
                  product.id > 104585 ? "text-red-500" : ""
                }`}
              >
                {product.id}
              </p>
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
          {products.map((product, index) => (
            <div key={`${product.id}-${index}`} className="mb-2 text-center">
              <p
                className="mt-1 text-sm cursor-pointer text-blue-500 hover:underline"
                onClick={() => window.open(`https://idreamshirt.com/products/${product.slug}/1`, "_blank")}
              >
                {product.name.length > 20
                  ? `${product.name.slice(0, 20)}...`
                  : product.name}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    
    {
      title: "Image",
      dataIndex: "products",
      key: "products",
      align: "center",
      width: 100,
      render: (products: any[]) => (
        <div className="flex flex-col">
          {products.map((product, index) => (
            <div key={`${product.id}-${index}`} className="mb-2 text-center">
              <Image
                src={product.pivot.img_url}
                alt={product.name}
                width={40}
                height={40}
                className="rounded-md"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "ATWORK",
      dataIndex: "products",
      key: "products",
      align: "center",
      width: 150,
      render: (products: any[]) => (
        <div className="flex flex-col">
          {products.map((product, index) => (
            <div key={`${product.id}-${index}`} className="mb-2 text-center relative group">
              <div className="inline-block transition-transform transform group-hover:scale-150">
                <a
                  href={convertToAtworkUrl(product.pivot.img_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src={convertToAtworkUrl(product.pivot.img_url)}
                    alt={product.name}
                    width={100}
                    height={100}
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
          ascending={
            sortingObj.sort === SortOrder.Asc && sortingObj.column === "total"
          }
          isActive={sortingObj.column === "total"}
        />
      ),
      className: "cursor-pointer",
      dataIndex: "total",
      key: "total",
      align: "center",
      width: 120,
      onHeaderCell: () => onHeaderClick("total"),
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
      title: t("table:table-item-shipping-address"),
      dataIndex: "shipping_address",
      key: "shipping_address",
      align: alignLeft,
      render: (shipping_address: UserAddress1) => {
        const street = shipping_address.shipping_address1 || "";
        const city = shipping_address.shipping_city || "";
        const province = shipping_address.shipping_province_code?.label || "";
        const zipcode = shipping_address.shipping_zipcode || "";
        const country = "US";

        const formattedAddress = [street, city, province, zipcode, country]
          .filter((part) => part) // Remove any undefined or empty parts
          .join(", ");

        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          formattedAddress
        )}`;

        return (
          <Link
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {formattedAddress}
          </Link>
        );
      },
    },

    {
      title: t("common:text-invoice"),
      dataIndex: "shipping_address",
      key: "shipping_address",
      align: "center",

      render: (shipping_address: UserAddress1) => {
        const name = shipping_address.shipping_name || "";

        const formattedAddress = [name].filter((part) => part).join("");

        return <span>{formattedAddress}</span>;
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
            const response = await axios.put(
              `https://orders.idreamshirt.com/orders/${id}`,
              { status: 2 }
            );
            toast.success("Order fulfilled successfully!");
          } catch (error) {
            toast.error("Failed to fulfill the order. Please try again.");
          } finally {
            setLoadingRows((prev) => ({ ...prev, [id]: false }));
          }
        };
    
        return (
          <>
          <ActionButtons id={id} detailsUrl={`${router.asPath}/${id}`} />
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleFulfill}
              disabled={loadingRows[id]}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-white transition ${
                "bg-blue-500 hover:bg-blue-600"
              }`}
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
      <div className="rounded overflow-hidden shadow mb-6">
        <Table
          //@ts-ignore
          columns={columns}
          emptyText={t("table:empty-table-data")}
          data={data}
          rowKey="id"
          scroll={{ x: 1000 }}
          expandable={{
            expandIconColumnIndex: -1, // This hides the expand icon column
          }}
        />
      </div>

      {!!paginatorInfo?.total && (
        <div className="flex justify-end items-center">
          <Pagination
            total={paginatorInfo?.total}
            current={paginatorInfo?.currentPage}
            pageSize={paginatorInfo?.perPage}
            onChange={onPagination}
          />
        </div>
      )}
    </>
  );
};

export default OrderList;
