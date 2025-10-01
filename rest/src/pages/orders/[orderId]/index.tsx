import Card from "@components/common/card";
import Layout from "@components/layouts/admin";
import Image from "next/image";
import { Table } from "@components/ui/table";
import ProgressBox from "@components/ui/progress-box/progress-box";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import Button from "@components/ui/button";
import ErrorMessage from "@components/ui/error-message";
import { siteSettings } from "@settings/site.settings";
import usePrice from "@utils/use-price";
import { formatAddress } from "@utils/format-address";
import Loader from "@components/ui/loader/loader";
import ValidationError from "@components/ui/form-validation-error";
import { Attachment } from "@ts-types/generated";
import { useOrderQuery } from "@data/order/use-order.query";
import { useUpdateOrderMutation } from "@data/order/use-order-update.mutation";
import { useOrderStatusesQuery } from "@data/order-status/use-order-statuses.query";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import SelectInput from "@components/ui/select-input";
import { useIsRTL } from "@utils/locals";
import UploadImageButton from "@components/ui/upload-image-button";
import { toast } from "react-toastify";

type FormValues = {
  order_status: any;
};

export default function OrderDetailsPage() {
  const { t } = useTranslation();
  const { query } = useRouter();
  const { alignLeft, alignRight } = useIsRTL();

  const { mutate: updateOrder, isLoading: updating } = useUpdateOrderMutation();
  const { data: orderStatusData } = useOrderStatusesQuery({});
  const {
    data,
    isLoading: loading,
    error,
  } = useOrderQuery(query.orderId as string);

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { order_status: data?.order?.status?.id ?? "" },
  });

  const ChangeStatus = ({ order_status }: FormValues) => {
    updateOrder({
      variables: {
        id: data?.order?.id as string,
        input: {
          status: order_status?.id as string,
        },
      },
    });
  };

  const { price: subtotal } = usePrice(
    data && {
      amount: data?.order?.amount!,
    }
  );
  const { price: total } = usePrice(
    data && {
      amount: data?.order?.paid_total!,
    }
  );
  const { price: discount } = usePrice(
    data && {
      amount: data?.order?.discount!,
    }
  );
  const { price: delivery_fee } = usePrice(
    data && {
      amount: data?.order?.delivery_fee!,
    }
  );
  const { price: sales_tax } = usePrice(
    data && {
      amount: data?.order?.sales_tax!,
    }
  );

  if (loading) return <Loader text={t("common:text-loading")} />;
  if (error) return <ErrorMessage message={error.message} />;
  console.log(data?.order?.products);

  const columns = [
    {
      dataIndex: "pivot.img_url",
      key: "pivot.img_url",
      width: 70,
      render: (_: any, item: any) => {
        // Extract path and filename from img_url
        const imgUrl = item.img_url || item.pivot.img_url;
        const urlParts = imgUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];

        // Extract path from URL (after /images/)
        const imagesIndex = urlParts.findIndex((part) => part === "images");
        let imagePath = "custom";
        if (imagesIndex !== -1 && imagesIndex + 1 < urlParts.length - 1) {
          const pathParts = urlParts.slice(imagesIndex + 1, -1);
          imagePath = pathParts.join("/");
        }

        return (
          <div className="flex flex-col items-center gap-2">
            <Image
              src={item.pivot.img_url ?? siteSettings.product.placeholder}
              layout="fixed"
              width={150}
              height={150}
            />
            <UploadImageButton
              imagePath={imagePath}
              fileName={fileName}
              originalImageUrl={imgUrl}
              onUploadSuccess={() => {
                toast.success("Upload thành công!");
                // Refresh page after successful upload
                window.location.reload();
              }}
            />
          </div>
        );
      },
    },
    {
      title: t("table:table-item-products"),
      dataIndex: "name",
      key: "name",
      align: alignLeft,
      render: (name: string, item: any) => {
        const variation = JSON.parse(item.pivot.variation);
        return (
          <div>
            <span>{name}</span>
            <span className="mx-2">x</span>
            <span className="font-semibold text-heading">
              {item.pivot.order_quantity}
            </span>
            <div>
              <span>Size: {variation.size}</span>
              <span className="mx-2">|</span>
              <span>Color: {variation.color}</span>
              <span className="mx-2">|</span>
              <span>Side: {variation.side}</span>
            </div>
          </div>
        );
      },
    },

    {
      title: t("table:table-item-total"),
      dataIndex: "price",
      key: "price",
      align: alignRight,
      render: (_: any, item: any) => {
        // const { price } = usePrice({
        // 	amount: parseFloat(item.pivot.subtotal),
        // });
        // return <span>{price}</span>;
      },
    },
  ];

  return (
    <Card>
      {/* Order Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8">
        <div className="flex flex-col items-start mb-4 lg:mb-0">
          <h3
            className="text-2xl font-semibold text-heading cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() =>
              window.open(
                `https://idreamshirt.com/orders/${data?.order?.order_num}`,
                "_blank"
              )
            }
          >
            {t("form:input-label-order-id")} - {data?.order?.order_num}
          </h3>
          <div className="text-sm text-gray-600 mt-2 space-y-1">
            {data?.order?.created_at && (
              <p>
                Order Date:{" "}
                {new Date(data.order.created_at).toLocaleDateString()}
              </p>
            )}
            {data?.order?.payment_gateway && (
              <p>Payment Method: {data.order.payment_gateway}</p>
            )}
          </div>
        </div>

        <form
          onSubmit={handleSubmit(ChangeStatus)}
          className="flex items-start ms-auto w-full lg:w-2/4"
        >
          <div className="w-full me-5 z-20">
            <SelectInput
              name="order_status"
              control={control}
              getOptionLabel={(option: any) => option.name}
              getOptionValue={(option: any) => option.id}
              options={orderStatusData?.order_statuses?.data}
              placeholder={t("form:input-placeholder-order-status")}
            />

            <ValidationError message={t(errors?.order_status?.message)} />
          </div>
          <Button loading={updating}>
            <span className="hidden sm:block">
              {t("form:button-label-change-status")}
            </span>
            <span className="block sm:hidden">
              {t("form:button-label-change")}
            </span>
          </Button>
        </form>
      </div>

      {/* Order Summary and Shipping Information - Moved to top */}
      <div className="flex flex-col py-7 md:items-start md:justify-start w-full md:flex-row gap-8">
        {/* Order Summary */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg flex-1">
          <h3 className="text-heading font-semibold mb-4 pb-2 border-b border-border-200 flex items-center">
            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Order Summary
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-body">
              <span className="font-medium text-gray-600">Sub total</span>
              <span className="text-gray-800">{subtotal}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-body">
              <span className="font-medium text-gray-600">Tax</span>
              <span className="text-gray-800">{sales_tax}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-body">
              <span className="font-medium text-gray-600">Delivery fee</span>
              <span className="text-gray-800">{delivery_fee}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-body">
              <span className="font-medium text-gray-600">Discount</span>
              <span className="text-gray-800">{discount}</span>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between text-base text-heading font-semibold">
                <span>Total</span>
                <span className="text-lg">{total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg flex-1">
          <h3 className="text-heading font-semibold mb-4 pb-2 border-b border-border-200 flex items-center">
            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {t("common:shipping-address")}
          </h3>

          <div className="text-sm text-body space-y-2">
            {data?.order?.shipping_address?.shipping_name && (
              <div className="flex">
                <span className="font-medium text-gray-600 w-16">Name:</span>
                <span className="text-gray-800">
                  {data.order.shipping_address.shipping_name}
                </span>
              </div>
            )}
            {data?.order?.shipping_address?.shipping_email && (
              <div className="flex">
                <span className="font-medium text-gray-600 w-16">Email:</span>
                <span className="text-gray-800">
                  {data.order.shipping_address.shipping_email}
                </span>
              </div>
            )}
            {data?.order?.shipping_address?.shipping_phone && (
              <div className="flex">
                <span className="font-medium text-gray-600 w-16">Phone:</span>
                <span className="text-gray-800">
                  {data.order.shipping_address.shipping_phone}
                </span>
              </div>
            )}
            {data?.order?.shipping_address?.shipping_province_code && (
              <div className="flex">
                <span className="font-medium text-gray-600 w-16">State:</span>
                <span className="text-gray-800">
                  {data.order.shipping_address.shipping_province_code}
                </span>
              </div>
            )}
            {data?.order?.shipping_address && (
              <div className="mt-3">
                <span className="font-medium text-gray-600 block mb-1">
                  Address:
                </span>
                <div className="text-gray-800 pl-4 border-l-2 border-gray-200">
                  {formatAddress(data.order.shipping_address)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      <div className="my-5 lg:my-10 flex justify-center items-center">
        <ProgressBox
          data={orderStatusData?.order_statuses?.data?.slice(0, 4)}
          status={data?.order?.status?.serial!}
        />
      </div>

      <div className="mb-10">
        {(data?.order?.tracking_number || data?.order?.tracking_url) && (
          <div className="mb-4 p-4 border border-border-200 rounded bg-gray-50 space-y-2">
            {data?.order?.tracking_number && (
              <p className="text-sm font-semibold text-gray-700 pb-6">
                Order Transaction:{" "}
                <span className="text-blue-600">
                  {data.order.tracking_number}
                </span>
              </p>
            )}

            {data?.order?.tracking_url && (
              <p className="text-sm font-semibold text-gray-700">
                <a
                  href={data.order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  View Tracking detail:{" "}
                  {data.order.tracking_url ?? data.order.tracking_url}
                </a>
              </p>
            )}
          </div>
        )}

        {data?.order ? (
          <Table
            //@ts-ignore
            columns={columns}
            emptyText={t("table:empty-table-data")}
            data={data?.order?.products!}
            rowKey="id"
            scroll={{ x: 300 }}
          />
        ) : (
          <span>{t("common:no-order-found")}</span>
        )}

        {/* Additional Order Information */}
        {(data?.order?.note || data?.order?.admin_comment) && (
        <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-heading font-semibold mb-4 pb-2 border-b border-yellow-300 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Notes & Comments
          </h3>
          <div className="space-y-3">
            {data?.order?.note && (
              <div>
                <span className="font-medium text-gray-700 block mb-1">
                  Customer Note:
                </span>
                <p className="text-sm text-gray-800 bg-white p-3 rounded border">
                  {data.order.note}
                </p>
              </div>
            )}
            {data?.order?.admin_comment && (
              <div>
                <span className="font-medium text-gray-700 block mb-1">
                  Admin Comment:
                </span>
                <p className="text-sm text-gray-800 bg-white p-3 rounded border">
                  {data.order.admin_comment}
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </Card>
  );
}

OrderDetailsPage.Layout = Layout;

export const getServerSideProps = async ({ locale }: any) => ({
  props: {
    ...(await serverSideTranslations(locale, ["common", "form", "table"])),
  },
});
