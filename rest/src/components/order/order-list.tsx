import Pagination from "@components/ui/pagination";
import dayjs from "dayjs";
import { Table } from "@components/ui/table";
import ActionButtons from "@components/common/action-buttons";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  Order,
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

type IProps = {
  orders: OrderPaginator | null | undefined;
  onPagination: (current: number) => void;
  onSort: (current: any) => void;
  onOrder: (current: string) => void;
};

const OrderList = ({ orders, onPagination, onSort, onOrder }: IProps) => {
  const { data, paginatorInfo } = orders! ?? {};
  const { t } = useTranslation();
  const rowExpandable = (record: any) => record.children?.length;
  const router = useRouter();
  const { alignLeft } = useIsRTL();
  console.log(data);

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
      title: "Name",
      dataIndex: "products",
      key: "products",
      align: "center",
      width: 200,
      render: (products: any[]) => (
        <div className="flex flex-col gap-2">
          {products.map((product) => (
            <div key={product.id} className="mb-2 text-center">
              <p className="mt-1 text-sm">
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
          {products.map((product) => (
            <div key={product.id} className="mb-2 text-center">
              <Image
                src={product.pivot.img_url}
                alt={product.name}
                width={70} // Adjust width
                height={70} // Adjust height
                className="rounded-md"
              />
            </div>
          ))}
        </div>
      ),
    },

    // {
    //   title: t("table:table-item-tracking-number"),
    //   dataIndex: "order_mapping",
    //   key: "order_mapping",
    //   width: 40,
    //   render: (order_mapping: string, record: Order) => {
    // if (record.tracking_url) {
    //   try {
    // 	const url = new URL(record.tracking_url);
    // 	const tracknum = url.searchParams.get("tracknum");

    // 	const lastFourDigits = (tracknum || order_mapping || "").slice(-4);

    // 	return (
    // 	  <Link
    // 		href={record.tracking_url}
    // 		target="_blank"
    // 		rel="noopener noreferrer"
    // 		className="text-blue-500 hover:underline"
    // 	  >
    // 		{lastFourDigits}
    // 	  </Link>
    // 	);
    //   } catch (error) {
    // 	console.error("Invalid tracking URL:", error);
    // 	return <>{(order_mapping || "").slice(-4)}</>;
    //   }
    // }

    // return <>{(order_mapping || "").slice(-4)}</>;
    // }

    // },

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
        let additionalText = ""; // Define additional text based on status.id

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
        // Safely access address fields and provide default values
        const street = shipping_address.shipping_address1 || "";
        const city = shipping_address.shipping_city || "";
        const province = shipping_address.shipping_province_code?.label || "";
        const zipcode = shipping_address.shipping_zipcode || "";
        const country = "US"; // Fixed value for country

        // Format the address for Google Maps
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
      width: 100,
      render: (id: string) => (
        <ActionButtons id={id} detailsUrl={`${router.asPath}/${id}`} />
      ),
    },
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
