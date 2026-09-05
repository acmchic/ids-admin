import Layout from "@components/layouts/admin";
import Button from "@components/ui/button";
import { adminOnly } from "@utils/auth-utils";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { Copy, Download, ExternalLink, Loader2, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

type UploadItem = {
  id: string;
  productId: number;
  slug: string;
  productName: string;
  imagePath: string;
  fileName: string;
  folder: string;
  uploadDate: string | null;
  url: string;
  orderCount: number;
  paidOrderCount: number;
  latestOrderId: string | null;
  latestOrderNum: string | null;
  latestCustomerName: string | null;
};

type UploadResponse = {
  data: UploadItem[];
  paginatorInfo: {
    total: number;
    currentPage: number;
    perPage: number;
    lastPage: number;
  };
};

const today = () => new Date().toISOString().slice(0, 10);

const splitImagePath = (imagePath: string) => {
  const parts = imagePath.split("/").filter(Boolean);
  const fileName = parts.pop() || imagePath;
  return {
    imagePath: parts.join("/"),
    fileName,
  };
};

export default function CustomizeUploadsPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [replaceLoading, setReplaceLoading] = useState<Record<string, boolean>>({});
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadUploads = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "60",
      });

      if (date) params.set("date", date);
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/customize-uploads?${params.toString()}`);
      const result: UploadResponse = await response.json();

      if (!response.ok) {
        throw new Error((result as any)?.error || "Failed to load customize uploads");
      }

      setItems(result.data || []);
      setSelectedIds((current) => current.filter((id) => (result.data || []).some((item) => item.id === id)));
      setTotal(result.paginatorInfo?.total || 0);
      setLastPage(result.paginatorInfo?.lastPage || 1);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load customize uploads");
    } finally {
      setLoading(false);
    }
  }, [date, page, search]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Copied image URL");
  };

  const toggleSelected = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  };

  const deleteImages = async (targets: UploadItem[]) => {
    if (!targets.length) return;

    const message = targets.length === 1
      ? `Delete ${targets[0].fileName}? This will remove it from customize uploads.`
      : `Delete ${targets.length} selected customize images?`;

    if (!window.confirm(message)) return;

    setDeleteLoading(true);

    try {
      const response = await fetch("/api/customize-uploads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: targets.map((item) => ({
            productId: item.productId,
            imagePath: item.imagePath,
          })),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || result?.details || "Delete failed");
      }

      if (result?.warnings?.length) {
        toast.warning(`Deleted from DB, but ${result.warnings.length} remote file delete warning(s).`);
      } else {
        toast.success(`Deleted ${result?.deletedCount || targets.length} image${targets.length === 1 ? "" : "s"}`);
      }

      setSelectedIds([]);
      await loadUploads();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  const replaceImage = async (item: UploadItem, file?: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Kích thước file phải nhỏ hơn 25MB");
      return;
    }

    const target = splitImagePath(item.imagePath);
    const key = item.id;
    setReplaceLoading((prev) => ({ ...prev, [key]: true }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", target.imagePath);
      formData.append("fileName", target.fileName);
      formData.append("storage", "customize");
      formData.append("forceReplace", "1");

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || result?.details || "Upload failed");
      }

      toast.success("Đã replace ảnh customize");
      await loadUploads();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Replace failed");
    } finally {
      setReplaceLoading((prev) => ({ ...prev, [key]: false }));
      if (fileInputRefs.current[key]) {
        fileInputRefs.current[key]!.value = "";
      }
    }
  };

  const applyDate = (nextDate: string) => {
    setDate(nextDate);
    setPage(1);
  };

  const applySearch = (nextSearch: string) => {
    setSearch(nextSearch);
    setPage(1);
  };

  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded bg-white p-5 shadow md:p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-heading">Customize Uploads</h1>
            <p className="mt-1 text-sm text-body">
              View, download, and replace customer uploaded customize artwork.
            </p>
          </div>
          <Button onClick={loadUploads} loading={loading} disabled={loading} size="small">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[180px_1fr_auto_auto] md:items-center">
          <input
            type="date"
            value={date}
            onChange={(event) => applyDate(event.target.value)}
            className="h-11 rounded border border-border-200 px-3 text-sm outline-none focus:border-accent"
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
            <input
              value={search}
              onChange={(event) => applySearch(event.target.value)}
              placeholder="Search file, folder, order, customer..."
              className="h-11 w-full rounded border border-border-200 pl-10 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <Button type="button" variant="outline" size="small" onClick={() => applyDate(today())}>
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="small"
            onClick={() => {
              setDate("");
              setSearch("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        </div>

        <div className="text-sm text-body">
          {loading ? "Loading..." : `${total.toLocaleString("en-US")} image${total === 1 ? "" : "s"}`}
        </div>

        <div className="flex flex-col gap-3 border-t border-border-100 pt-4 md:flex-row md:items-center md:justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() => {
                if (allVisibleSelected) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(items.map((item) => item.id));
                }
              }}
            />
            Select all visible
          </label>
          <Button
            type="button"
            size="small"
            variant="outline"
            disabled={!selectedItems.length || deleteLoading}
            loading={deleteLoading}
            onClick={() => deleteImages(selectedItems)}
            className="text-red-600 hover:border-red-600 hover:bg-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected ({selectedItems.length})
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {items.map((item) => {
          const isReplacing = Boolean(replaceLoading[item.id]);
          const downloadUrl = `/api/customize-uploads/download?path=${encodeURIComponent(item.imagePath)}`;

          return (
            <div key={item.id} className="overflow-hidden rounded bg-white shadow">
              <div className="flex items-center justify-between border-b border-border-100 px-4 py-3">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-body">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelected(item.id)}
                  />
                  Select
                </label>
                <button
                  type="button"
                  onClick={() => deleteImages([item])}
                  disabled={deleteLoading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 text-red-600 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="block bg-gray-100">
                <img
                  src={`${item.url}?admin_cache=${item.updatedAt || item.id}`}
                  alt={item.fileName}
                  className="h-64 w-full object-contain"
                  loading="lazy"
                />
              </a>

              <div className="space-y-3 p-4">
                <div>
                  <div className="truncate font-mono text-xs font-semibold text-heading" title={item.fileName}>
                    {item.fileName}
                  </div>
                  <div className="mt-1 truncate text-xs text-body" title={item.folder}>
                    {item.folder || "root"} {item.uploadDate ? `· ${item.uploadDate}` : ""}
                  </div>
                </div>

                <div className="space-y-1 text-xs text-body">
                  <div className="truncate">Product: {item.slug}</div>
                  <div className="truncate">
                    Paid orders: {item.paidOrderCount}
                    {item.latestOrderNum ? ` · Latest #${item.latestOrderNum}` : ""}
                  </div>
                  {item.orderCount > item.paidOrderCount && (
                    <div className="truncate text-amber-700">
                      {item.orderCount - item.paidOrderCount} linked cart/order record{item.orderCount - item.paidOrderCount === 1 ? "" : "s"} without completed payment
                    </div>
                  )}
                  {item.latestCustomerName && <div className="truncate">Customer: {item.latestCustomerName}</div>}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <a
                    href={downloadUrl}
                    className="inline-flex h-10 items-center justify-center rounded border border-border-200 text-body transition hover:border-accent hover:text-accent"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyUrl(item.url)}
                    className="inline-flex h-10 items-center justify-center rounded border border-border-200 text-body transition hover:border-accent hover:text-accent"
                    title="Copy URL"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded border border-border-200 text-body transition hover:border-accent hover:text-accent"
                    title="Open"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[item.id]?.click()}
                    disabled={isReplacing}
                    className="inline-flex h-10 items-center justify-center rounded border border-border-200 text-body transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                    title="Replace"
                  >
                    {isReplacing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <input
                  ref={(ref) => {
                    fileInputRefs.current[item.id] = ref;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => replaceImage(item, event.target.files?.[0])}
                />

                {isReplacing && <div className="text-xs font-semibold text-accent">Replacing...</div>}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && items.length === 0 && (
        <div className="rounded bg-white p-8 text-center text-sm text-body shadow">
          No customize uploads found.
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3 rounded bg-white p-4 shadow">
          <Button
            type="button"
            variant="outline"
            size="small"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-body">
            Page {page} / {lastPage}
          </span>
          <Button
            type="button"
            variant="outline"
            size="small"
            disabled={page >= lastPage}
            onClick={() => setPage((current) => Math.min(current + 1, lastPage))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

CustomizeUploadsPage.authenticate = {
  permissions: adminOnly,
};

CustomizeUploadsPage.Layout = Layout;

export const getStaticProps = async ({ locale }: any) => ({
  props: {
    ...(await serverSideTranslations(locale, ["common"])),
  },
});
