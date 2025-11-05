import React, { useState, useRef } from "react";
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
import { format } from "date-fns";
import { useFailedOrders } from "../../hooks/useFailedOrders";

import { Table } from "@components/ui/table";
import Pagination from "@components/ui/pagination";
import ActionButtons from "@components/common/action-buttons";
import TitleWithSort from "@components/ui/title-with-sort";
import Link from "@components/ui/link";
import { PacmanLoader } from "react-spinners";

import { useIsRTL } from "@utils/locals";
import { UsState } from "../../utils/us-states";
import { AlertTriangle } from "lucide-react";
import { getApiUrl } from "../../config/api";

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

    const ffName = statusCode === 68 ? "merchize" : statusCode === 9 ? "burger" : statusCode === 69 ? "mango" : "gearment";
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

    const ffName = statusCode === 68 ? "merchize" : statusCode === 9 ? "burger" : statusCode === 69 ? "mango" : "gearment";
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

// Function to get original artwork URL from pivot.img_url
const getOriginalArtworkUrl = (pivotImgUrl: string): string => {
  // pivotImgUrl is usually the original artwork URL like:
  // https://api.idreamshirt.com/images/ids/gmc/the-kakashi-andamp;amp;amp;-pakkun-show_bb5.png
  // Just return it directly
  return pivotImgUrl;
};


const OrderList = React.memo(({ orders, onPagination, onSort, onOrder }: IProps) => {
  const { data, paginatorInfo } = orders ?? {};
  const { t } = useTranslation();
  const router = useRouter();
  const { alignLeft } = useIsRTL();
  
  // Hook to get failed orders - no auto refresh
  const { failedOrders, loading: failedOrdersLoading, refetch } = useFailedOrders(0);

  // Function to check if order is in failed orders list
  const isFailedOrder = (orderNum: string) => {
    return failedOrders.some(failedOrder => failedOrder.order_id === orderNum);
  };

  // Function to check if order has customize artwork
  const isCustomizeOrder = (record: any) => {
    if (!record.products || !Array.isArray(record.products)) return false
  
    return record.products.some((product: any) => {
      if (product.is_customize && product.image) {
        try {
          const images = JSON.parse(product.image)
          if (images.length && images[0].original) {
            return images[0].original.toLowerCase().includes("customize")
          }
        } catch {
          return false
        }
        return false
      } else {
        const imgUrl = product.pivot?.img_url || product.img_url || ""
        return imgUrl.toLowerCase().includes("customize")
      }
    })
  }
  
  
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const [selectedOrders, setSelectedOrders] = useState<Record<string, number>>({});
  const [sortingObj, setSortingObj] = useState<{ sort: SortOrder; column: string | null }>({ sort: SortOrder.Desc, column: null });
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  // State for fulfill progress
  const [fulfillProgress, setFulfillProgress] = useState<{
    isProcessing: boolean;
    currentOrder: string;
    completed: number;
    total: number;
  }>({
    isProcessing: false,
    currentOrder: '',
    completed: 0,
    total: 0
  });

  // Function to select all G orders today
  const handleSelectAllG = () => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd"); // Same logic as Today button
    
    console.log('Debug All G - Today:', todayStr);
    console.log('Debug All G - Total orders:', data?.length);
    
    const todayOrdersWithStatus1 = data?.filter(order => {
      const orderDate = format(new Date(order.created_at), "yyyy-MM-dd");
      const hasStatus1 = order.status?.id === 1;
      const isToday = orderDate === todayStr;
      
      console.log(`Order ${order.id}: date=${orderDate}, status=${order.status?.id} (${order.status?.name}), isToday=${isToday}, hasStatus1=${hasStatus1}`);
      
      return isToday && hasStatus1;
    }) || [];
    
    console.log(`Found ${todayOrdersWithStatus1.length} orders with status 1 (Order Received) today for G fulfill`);
    
    const newSelections: Record<string, number> = {};
    todayOrdersWithStatus1.forEach(order => {
      newSelections[order.id] = 2; // G status
    });
    setSelectedOrders(newSelections);
  };

  // Function to select all B orders today  
  const handleSelectAllB = () => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd"); // Same logic as Today button
    
    const todayOrdersWithStatus1 = data?.filter(order => {
      const orderDate = format(new Date(order.created_at), "yyyy-MM-dd");
      const hasStatus1 = order.status?.id === 1;
      const isToday = orderDate === todayStr;
      
      console.log(`Order ${order.id}: date=${orderDate}, status=${order.status?.id} (${order.status?.name}), isToday=${isToday}, hasStatus1=${hasStatus1}`);
      
      return isToday && hasStatus1;
    }) || [];
    
    console.log(`Found ${todayOrdersWithStatus1.length} orders with status 1 (Order Received) today for B fulfill`);
    
    const newSelections: Record<string, number> = {};
    todayOrdersWithStatus1.forEach(order => {
      newSelections[order.id] = 9; // B status
    });
    setSelectedOrders(newSelections);
  };

  // Function to select all M orders today  
  const handleSelectAllM = () => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd"); // Same logic as Today button
    
    const todayOrdersWithStatus1 = data?.filter(order => {
      const orderDate = format(new Date(order.created_at), "yyyy-MM-dd");
      const hasStatus1 = order.status?.id === 1;
      const isToday = orderDate === todayStr;
      
      console.log(`Order ${order.id}: date=${orderDate}, status=${order.status?.id} (${order.status?.name}), isToday=${isToday}, hasStatus1=${hasStatus1}`);
      
      return isToday && hasStatus1;
    }) || [];
    
    console.log(`Found ${todayOrdersWithStatus1.length} orders with status 1 (Order Received) today for M fulfill`);
    
    const newSelections: Record<string, number> = {};
    todayOrdersWithStatus1.forEach(order => {
      newSelections[order.id] = 69; // M status
    });
    setSelectedOrders(newSelections);
  };

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
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    
    // Delay between requests to avoid overwhelming the fulfillment servers
    // 200ms = 5 requests/second, safe for most APIs
    // Can be reduced to 100ms if servers can handle higher load
    const FULFILL_DELAY = 200; // milliseconds

    try {
      const grouped: Record<number, any[]> = {};
      data?.forEach(order => {
        const status = selectedOrders[order.id];
        if (status) {
          if (!grouped[status]) grouped[status] = [];
          grouped[status].push(order);
        }
      });

      // Calculate total orders
      const totalOrders = Object.values(grouped).flat().length;
      
      // Initialize progress
      setFulfillProgress({
        isProcessing: true,
        currentOrder: '',
        completed: 0,
        total: totalOrders
      });

      let completedCount = 0;

      for (const status of Object.keys(grouped)) {
        const ordersForStatus = grouped[+status];

        for (const order of ordersForStatus) {
          // Update current order being processed
          const customerName = order.shipping_address?.shipping_name || 'Unknown';
          setFulfillProgress(prev => ({
            ...prev,
            currentOrder: `${customerName} (${order.order_num || order.id})`,
            completed: completedCount
          }));

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

          completedCount++;
          setFulfillProgress(prev => ({
            ...prev,
            completed: completedCount
          }));

          await sleep(FULFILL_DELAY);
        }
      }

      // Show completion
      setFulfillProgress(prev => ({
        ...prev,
        currentOrder: 'DONE ✅',
        completed: totalOrders
      }));

      toast.success(`✅ DONE! All ${totalOrders} orders fulfilled.`);
      setSelectedOrders({});
      
      // Hide progress after 2 seconds
      setTimeout(() => {
        setFulfillProgress({
          isProcessing: false,
          currentOrder: '',
          completed: 0,
          total: 0
        });
      }, 2000);

    } catch (e) {
      console.error(e);
      toast.error("Some fulfillments failed.");
      setFulfillProgress({
        isProcessing: false,
        currentOrder: '',
        completed: 0,
        total: 0
      });
    }
  };

  // Function to decode HTML entities in filename
  const decodeHtmlEntities = (str: string): string => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, productId: string, imagePath: string, fileName: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      return;
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Kích thước file phải nhỏ hơn 25MB');
      return;
    }

    const uploadKey = `${productId}-image`;
    setUploadingImages(prev => ({ ...prev, [uploadKey]: true }));

    // Decode HTML entities in fileName (fix &amp;amp;amp; issue)
    const decodedFileName = decodeHtmlEntities(fileName);

    // Fallback timeout to reset button state if upload hangs
    const fallbackTimeout = setTimeout(() => {
      setUploadingImages(prev => ({ ...prev, [uploadKey]: false }));
      if (fileInputRefs.current[uploadKey]) {
        fileInputRefs.current[uploadKey]!.value = '';
      }
      toast.error('Upload timeout. Vui lòng thử lại.');
    }, 35000);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', imagePath);
      formData.append('fileName', decodedFileName);

      console.log('🔥 ORDER LIST UPLOAD DEBUG:', {
        productId,
        imagePath,
        originalFileName: fileName,
        decodedFileName: decodedFileName,
        fileSize: file.size,
        fileType: file.type
      });

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      console.log('🔥 ORDER LIST UPLOAD RESPONSE:', {
        status: response.status,
        ok: response.ok,
        result
      });

      if (response.ok) {
        if (result.isReplacing) {
          toast.success('Upload thành công! Đã thay thế ảnh artwork.');
          console.log('✅ Replaced existing file:', fileName);
        } else {
          toast.success(`Upload thành công! File ảnh khác tên - đã upload với tên mới: ${result.finalFileName}`);
          console.log('✅ Uploaded new file:', result.finalFileName);
        }
        // Không reload trang, chỉ show thông báo thành công
      } else {
        console.error('❌ Upload failed:', result);
        toast.error(`Upload thất bại: ${result.error || result.details || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Lỗi mạng. Vui lòng kiểm tra kết nối và thử lại.');
      } else {
        toast.error('Upload thất bại. Vui lòng thử lại.');
      }
    } finally {
      clearTimeout(fallbackTimeout);
      setUploadingImages(prev => ({ ...prev, [uploadKey]: false }));
      if (fileInputRefs.current[uploadKey]) {
        fileInputRefs.current[uploadKey]!.value = '';
      }
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

        return (
          <div className="flex flex-row justify-center gap-2">
            {/* G Button */}
            <button
              onClick={() =>
                setSelectedOrders(prev => ({ ...prev, [row.id]: 2 }))
              }
              className={`px-3 py-2 rounded-md border text-white bg-blue-500 hover:bg-blue-600 text-sm ${selectedOrders[row.id] === 2
                  ? 'ring-2 ring-offset-1 ring-blue-300'
                  : ''
                }`}
            >
              G
            </button>
            
            {/* B Button */}
            <button
              onClick={() =>
                setSelectedOrders(prev => ({ ...prev, [row.id]: 9 }))
              }
              className={`px-3 py-2 rounded-md border text-white bg-red-500 hover:bg-red-600 text-sm ${selectedOrders[row.id] === 9
                  ? 'ring-2 ring-offset-1 ring-red-300'
                  : ''
                }`}
            >
              B
            </button>
            
            {/* M Button - Clone from B button */}
            <button
              onClick={() =>
                setSelectedOrders(prev => ({ ...prev, [row.id]: 69 }))
              }
              className={`px-3 py-2 rounded-md border text-white bg-green-500 hover:bg-green-600 text-sm ${selectedOrders[row.id] === 69
                  ? 'ring-2 ring-offset-1 ring-green-300'
                  : ''
                }`}
            >
              M
            </button>
            {/* Clear button for this row */}
            {selectedOrders[row.id] && (
              <button
                onClick={() => {
                  setSelectedOrders(prev => {
                    const newSelections = { ...prev };
                    delete newSelections[row.id];
                    return newSelections;
                  });
                }}
                className="px-2 py-2 rounded-md border text-white bg-gray-500 hover:bg-gray-600 text-sm"
                title="Clear selection for this order"
              >
                ✕
              </button>
            )}
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
      render: (shipping_address: UserAddress1, record: any) => {
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

        const orderCount = record.order_count || 1;
        const orderLabel = orderCount === 1 ? "" : `${orderCount}th Order`;

        const isFailed = isFailedOrder(record.order_num);

        const handleCopyOrderNum = () => {
          if (record.order_num) {
            navigator.clipboard.writeText(record.order_num);
            toast.success("COPIED ORDER NUMBER");
          }
        };

        return (
          <div className="text-sm text-blue-600 flex flex-col gap-8">
            <div>
              {/* Order Number - click to copy */}
              {record.order_num && (
                <p
                  className="cursor-pointer hover:underline text-indigo-600 font-semibold"
                  onClick={handleCopyOrderNum}
                  title="Click to copy order number"
                >
                  #{record.order_num}
                </p>
              )}
              
              {/* Detail link - click to open page */}
              {record.order_num && (
                <a
                  href={`https://idreamshirt.com/orders/${record.order_num}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:underline cursor-pointer block mb-2"
                  title="View order details"
                >
                  Detail
                </a>
              )}
              
              <div className="flex items-center gap-2">
                <p
                  className="cursor-pointer hover:underline text-blue-500"
                  onClick={handleCopy}
                  title="Click to copy"
                >
                  {name}
                </p>
                {isFailed && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                    ❌ FULFILL FAILED
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 pt-1">{orderLabel}</p>

              {shippingMethod === "express" && (
                <p className="text-xs text-red-600 pt-6 font-semibold uppercase">Express Shipping</p>
              )}
              {shipping_address.design_note && (
                <p className="text-xs text-red-600 pt-2 font-semibold break-words">
                  📝 NOTES: {shipping_address.design_note.slice(0, 30)}{shipping_address.design_note.length > 30 ? '...' : ''}
                </p>
              )}
            </div>

            <Link
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-xs text-black"
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

                {/* Hiển thị side và size */}
                {side && (
                  <p className="text-xs text-gray-500 pt-2">{side}/{size}</p>
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
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
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
          {products.map((product, index) => {
            // Check if this is a customize product
            let displayImgUrl = "";
            let linkUrl = "";
            let isCustomize = false;
            const API_URL = getApiUrl();
            
            if (product.is_customize && product.image) {
              // Customize product - get image from products_customize table
              try {
                const images = JSON.parse(product.image);
                
                if (images && images.length > 0 && images[0].original) {
                  const originalPath = images[0].original;
                  // Build URL: API_URL + '/images/' + original
                  displayImgUrl = `${API_URL}/images/${originalPath}`;
                  linkUrl = displayImgUrl;
                  isCustomize = true;
                }
              } catch (e) {
                console.error("Parse customize image error:", e);
              }
            }
            
            // Regular product - use product.img_url
            if (!displayImgUrl) {
              displayImgUrl = product.img_url || "";
              linkUrl = product.img_url || "";
            }

            function getImageFolderPath(url?: string): string {
              if (!url) return "CUSTOMIZE"
              const afterImages = url.split("images/")[1] || ""
              const pathParts = afterImages.split("/")
              return pathParts.slice(0, 2).join("/")
            }
            
            const folderPath = getImageFolderPath(linkUrl)


            if (!displayImgUrl) {
              return (
                <div
                  key={`${product.id}-${index}`}
                  className="mb-2 text-center"
                >
                  <div className="w-[130px] h-[150px] bg-gray-200 rounded-md flex items-center justify-center text-gray-500 text-xs">
                    No Image
                  </div>
                </div>
              );
            }

            return (
              <div
                key={`${product.id}-${index}`}
                className="mb-2 text-center"
              >
                <div className="inline-block transition-transform transform hover:scale-150 relative">
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Image
                      src={displayImgUrl}
                      alt={product.name || 'Product image'}
                      width={130}
                      height={150}
                      className="rounded-md object-cover"
                    />
                  </a>
                </div>

                <p
                    className={`text-sm font-mono ${folderPath.toLowerCase().includes("customize") || isCustomize
                        ? "text-blue-500 font-bold animate-pulse"
                        : "text-gray-600"
                      }`}
                  >
                    {folderPath.toLowerCase().includes("customize") || isCustomize
                      ? folderPath.toUpperCase()
                      : folderPath}
                  </p>

                {/* Upload Button - Moved below text */}
                {(() => {
                  // For customize products, use displayImgUrl (already built above)
                  // For regular products, use product.img_url
                  const imgUrl = isCustomize ? displayImgUrl : product.img_url;
                  if (!imgUrl) return null;
                  
                  const urlParts = imgUrl.split('/');
                  const fileName = urlParts[urlParts.length - 1];
                  
                  // Extract path from URL (after /images/)
                  let imagePath = 'custom';
                  
                  if (isCustomize) {
                    // For customize: extract from /images/customize/25_11_05/{fileName}
                    // imagePath should be: customize/25_11_05
                    const imagesIndex = urlParts.findIndex((part: string) => part === 'images');
                    if (imagesIndex !== -1 && imagesIndex + 1 < urlParts.length - 1) {
                      const pathParts = urlParts.slice(imagesIndex + 1, -1);
                      imagePath = pathParts.join('/');
                    }
                  } else {
                    // For regular: extract from /images/...
                    const imagesIndex = urlParts.findIndex((part: string) => part === 'images');
                    if (imagesIndex !== -1 && imagesIndex + 1 < urlParts.length - 1) {
                      const pathParts = urlParts.slice(imagesIndex + 1, -1);
                      imagePath = pathParts.join('/');
                    }
                  }

                  const uploadKey = `${product.id}-image`;
                  const isUploading = uploadingImages[uploadKey];

                  return (
                    <div className="mt-2 flex justify-center">
                      <input
                        ref={(el) => {
                          fileInputRefs.current[uploadKey] = el;
                        }}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, product.id.toString(), imagePath, fileName)}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRefs.current[uploadKey]?.click()}
                        disabled={isUploading}
                        className={`flex items-center gap-1 px-2 py-1 text-xs text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                          isCustomize ? 'bg-pink-500 hover:bg-pink-600' : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                        title={isCustomize ? "Upload new customize artwork" : "Upload new artwork image"}
                      >
                        {isUploading ? (
                          <span className="w-3 h-3 animate-spin">⏳</span>
                        ) : (
                          <span className="w-3 h-3">📤</span>
                        )}
                        {isUploading ? 'Up...' : 'Up'}
                      </button>
                    </div>
                  );
                })()}

                {/* Display image path */}
                <div className="mt-1">
                  {(() => {
                    // Lấy path từ URL gốc để hiển thị
                    const originalUrl = product.pivot?.img_url || product.img_url;
                    if (!originalUrl) return null;

                    const urlParts = originalUrl.split("/");
                    const imagesIndex = urlParts.findIndex((part: string) => part === "images");
                    let imagePath = "";

                    if (imagesIndex !== -1 && imagesIndex + 2 < urlParts.length) {
                      // Lấy 2 phần sau "images" (ví dụ: w_shirt/tv)
                      imagePath = urlParts.slice(imagesIndex + 1, imagesIndex + 3).join("/");
                    }

                    if (!imagePath) return null;

                    const isCustomize = imagePath.toLowerCase().includes("customize");

                    let textClass = "text-xs font-mono";
                    if (isCustomize) {
                      textClass += " text-green-500 font-bold animate-pulse";
                    } else {
                      textClass += " text-gray-600";
                    }

                    return (
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${textClass} hover:underline cursor-pointer`}
                      >
                        {isCustomize ? imagePath.toUpperCase() : imagePath}
                      </a>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      ),
    }
,
    
    

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

        if (status?.id == 2) additionalText = "(Mango)";
        else if (status?.id == 9) additionalText = "(Burgerprint)";
        else if (status?.id == 8) additionalText = "(Printway)";
        else if (status?.id == 68) additionalText = "(Merchize)";
        else if (status?.id == 69) additionalText = "(MangoPrint)";

        if (status?.id == 77) {
          return (
            <span className="text-red-600 font-semibold flex items-center gap-1">
              <AlertTriangle size={16} className="text-red-500" />
              Error
            </span>
          );
        }

        if (status?.id == 78) {
          return (
            <span className="text-red-600 font-semibold flex items-center gap-1">
              <AlertTriangle size={16} className="text-red-500" />
              Fulfill Failed
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
      title: "Transactions",
      dataIndex: "tracking_number",
      key: "tracking",
      align: "center",
      width: 400,
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
      render: (id: string, _: string, row: any) => {
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

        const handleMangoPrint = async () => {
          setLoadingRows((prev) => ({ ...prev, [`mango-${id}`]: true }));

          try {
            await axios.put(`https://orders.idreamshirt.com/orders/${id}`, { status: 69 });
            toast.success("MangoPrint order fulfilled successfully!");
          } catch (error) {
            toast.error("Failed to fulfill the MangoPrint order. Please try again.");
          } finally {
            setLoadingRows((prev) => ({ ...prev, [`mango-${id}`]: false }));
          }
        };

        return (
          <>
            <ActionButtons id={id} detailsUrl={`${router.asPath}/${id}`} />
            <div className="flex flex-col items-center gap-2">
              {/* CUSTOMIZE Badge */}
              {isCustomizeOrder(row) && (
                <div className="mb-2">
                  <span className="inline-block bg-pink-500 text-white text-xs font-bold px-3 py-1 rounded animate-pulse">
                    CUSTOMIZE
                  </span>
                </div>
              )}
              
              {/* FULFILL FAILED Badge */}
              {row.status?.id === 78 && (
                <div className="mb-2">
                  <span className="inline-block bg-red-600 text-white text-xs font-bold px-3 py-1 rounded animate-pulse">
                    FULFILL FAILED
                  </span>
                </div>
              )}
              {/* Fulfill Button */}

              <button
                onClick={handleMerchize}
                disabled={loadingRows[`merchize-${id}`]}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-white bg-green-500 hover:bg-green-600 transition"
              >
                {loadingRows[`merchize-${id}`] ? (
                  <PacmanLoader size={15} color="#fff" loading={loadingRows[`merchize-${id}`]} />
                ) : (
                  ''
                )}
                Merchize
              </button>
              
              {/* MangoPrint Button */}
              <button
                onClick={handleMangoPrint}
                disabled={loadingRows[`mango-${id}`]}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-white bg-green-600 hover:bg-green-700 transition font-semibold"
              >
                {loadingRows[`mango-${id}`] ? (
                  <PacmanLoader size={15} color="#fff" loading={loadingRows[`mango-${id}`]} />
                ) : (
                  <span className="text-lg">🥭</span>
                )}
                <span className="text-white font-semibold">Mango</span>
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
      {/* Failed Orders Alert Banner */}
      {failedOrders.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  ❌ {failedOrders.length} Order{failedOrders.length > 1 ? 's' : ''} Fulfill Failed
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>Customers: {failedOrders.map(order => `${order.customer_name} (${order.order_id})`).join(', ')}</p>
                </div>
              </div>
            </div>
            <div className="text-xs text-red-600 flex items-center gap-2">
              <span>{failedOrdersLoading ? 'Refreshing...' : 'Manual refresh only'}</span>
              <button
                onClick={refetch}
                disabled={failedOrdersLoading}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selection Controls */}
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <div className="flex gap-8">
          <button
            onClick={handleSelectAllG}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            All G 
          </button>
          <button
            onClick={handleSelectAllB}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            All B 
          </button>
          <button
            onClick={handleSelectAllM}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
          >
            All M 
          </button>
          <button
            onClick={() => setSelectedOrders({})}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear All
          </button>
        </div>
        
        {Object.keys(selectedOrders).length > 0 && (
          <div className="flex items-center gap-4">
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleUnifiedFulfill}
              disabled={fulfillProgress.isProcessing}
            >
              {fulfillProgress.isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </span>
              ) : (
                `Fulfill Selected (${Object.keys(selectedOrders).length})`
              )}
            </button>
            
            {/* Progress indicator */}
            {fulfillProgress.isProcessing && (
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-blue-100 px-3 py-2 rounded-lg border">
                  <div className="font-medium text-blue-800">
                    Progress: {fulfillProgress.completed}/{fulfillProgress.total}
                  </div>
                  <div className="text-blue-600 text-xs mt-1">
                    {fulfillProgress.currentOrder && (
                      <span>Processing: {fulfillProgress.currentOrder}</span>
                    )}
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${fulfillProgress.total > 0 ? (fulfillProgress.completed / fulfillProgress.total) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded overflow-hidden shadow mb-6">
        <Table
          //@ts-ignore
          columns={columns}
          emptyText={t("table:empty-table-data")}
          data={data}
          rowKey="id"
          scroll={{ x: 1000 }}
          expandable={{ expandIconColumnIndex: -1 }}
          rowClassName={(record) => {
            const isCustomize = isCustomizeOrder(record);
            const isFailed = isFailedOrder(record.order_num);
            const isFulfillFailed = record.status?.id === 78;
            
            if ((isFailed || isFulfillFailed) && isCustomize) {
              return 'bg-red-200 hover:bg-red-300 border-l-4 border-red-500'; // Failed + Customize
            } else if (isFailed || isFulfillFailed) {
              return 'bg-red-100 hover:bg-red-200 border-l-4 border-red-500'; // Failed only
            } else if (isCustomize) {
              return 'bg-pink-100 hover:bg-pink-200'; // Customize only
            }
            return '';
          }}
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

});

export default OrderList;
