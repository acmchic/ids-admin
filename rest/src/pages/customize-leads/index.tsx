import Layout from "@components/layouts/admin";
import Button from "@components/ui/button";
import { adminOnly } from "@utils/auth-utils";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { Copy, ExternalLink, Loader2, Mail, RefreshCw, Search, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

type LeadItem = {
  id: number;
  productCustomizeId: number | null;
  slug: string;
  email: string;
  productName: string;
  catalog: string | null;
  color: string | null;
  source: string | null;
  landingUrl: string | null;
  artworkFileName: string | null;
  artworkUrl: string | null;
  orderCount: number;
  latestOrderNum: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type LeadResponse = {
  data: LeadItem[];
  stats: {
    total: number;
    uniqueEmails: number;
  };
  paginatorInfo: {
    total: number;
    currentPage: number;
    perPage: number;
    lastPage: number;
  };
};

const today = () => new Date().toISOString().slice(0, 10);

export default function CustomizeLeadsPage() {
  const [items, setItems] = useState<LeadItem[]>([]);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [stats, setStats] = useState({ total: 0, uniqueEmails: 0 });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"create" | "test" | "send" | "dry-run" | null>(null);
  const [campaign, setCampaign] = useState({
    name: `Customize upload follow-up ${today()}`,
    subject: "Your custom shirt design is waiting",
    previewText: "We saved your uploaded artwork so you can finish your custom shirt.",
    heading: "Your custom design is ready",
    discountCode: "CUSTOM30",
    discountPercent: "30",
    ctaText: "Finish Your Custom Shirt",
    ctaUrl: "https://idreamshirt.com/products/customize/premium-t-shirt",
    testEmail: "acmchic88@gmail.com",
  });

  const loadLeads = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
      });

      if (search.trim()) params.set("search", search.trim());
      if (date) params.set("date", date);

      const response = await fetch(`/api/customize-leads?${params.toString()}`);
      const result: LeadResponse = await response.json();

      if (!response.ok) {
        throw new Error((result as any)?.error || "Failed to load customize leads");
      }

      setItems(result.data || []);
      setStats(result.stats || { total: 0, uniqueEmails: 0 });
      setLastPage(result.paginatorInfo?.lastPage || 1);
      setSelectedIds((current) => current.filter((id) => (result.data || []).some((item) => item.id === id)));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load customize leads");
    } finally {
      setLoading(false);
    }
  }, [date, page, search]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const updateCampaign = (key: keyof typeof campaign, value: string) => {
    setCampaign((current) => ({ ...current, [key]: value }));
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
    );
  };

  const runCampaignAction = async (action: "create" | "test" | "send" | "dry-run") => {
    if (action !== "test" && selectedIds.length === 0) {
      toast.error("Select at least one lead first");
      return;
    }

    if (action === "send" && !window.confirm(`Send email to ${selectedIds.length} selected lead(s)?`)) {
      return;
    }

    setActionLoading(action);

    try {
      const response = await fetch("/api/customize-leads/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          leadIds: selectedIds,
          testEmail: campaign.testEmail,
          name: campaign.name,
          subject: campaign.subject,
          previewText: campaign.previewText,
          heading: campaign.heading,
          discountCode: campaign.discountCode,
          discountPercent: Number(campaign.discountPercent || 0),
          ctaText: campaign.ctaText,
          ctaUrl: campaign.ctaUrl,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || result?.details || "Campaign action failed");
      }

      toast.success(result?.message || "Done");
      if (result?.output && action === "dry-run") {
        console.log(result.output);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Campaign action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email);
    toast.success("Copied email");
  };

  const allVisibleSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  return (
    <div className="space-y-6">
      <div className="rounded bg-white p-5 shadow md:p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-heading">Customize Leads</h1>
            <p className="mt-1 text-sm text-body">
              View uploaded-artwork emails, inspect proof links, and send follow-up campaigns.
            </p>
          </div>
          <Button onClick={loadLeads} loading={loading} disabled={loading} size="small">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr_auto_auto] md:items-center">
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded border border-border-200 px-3 text-sm outline-none focus:border-accent"
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search email, slug, file..."
              className="h-11 w-full rounded border border-border-200 pl-10 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <Button type="button" variant="outline" size="small" onClick={() => setDate(today())}>
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

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded border border-border-100 p-3">
            <div className="text-body">Leads</div>
            <div className="mt-1 text-xl font-semibold text-heading">{stats.total.toLocaleString("en-US")}</div>
          </div>
          <div className="rounded border border-border-100 p-3">
            <div className="text-body">Unique emails</div>
            <div className="mt-1 text-xl font-semibold text-heading">{stats.uniqueEmails.toLocaleString("en-US")}</div>
          </div>
          <div className="rounded border border-border-100 p-3">
            <div className="text-body">Selected</div>
            <div className="mt-1 text-xl font-semibold text-heading">{selectedIds.length.toLocaleString("en-US")}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="overflow-hidden rounded bg-white shadow">
          <div className="flex flex-col gap-3 border-b border-border-100 p-4 md:flex-row md:items-center md:justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-body">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => {
                  setSelectedIds(allVisibleSelected ? [] : items.map((item) => item.id));
                }}
              />
              Select all visible
            </label>
            <div className="text-sm text-body">{loading ? "Loading..." : `${items.length} visible`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-body">
                <tr>
                  <th className="w-10 p-3"></th>
                  <th className="p-3">Lead</th>
                  <th className="p-3">Artwork</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border-100 hover:bg-gray-50">
                    <td className="p-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelected(item.id)}
                      />
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-heading">{item.email}</span>
                        <button
                          type="button"
                          onClick={() => copyEmail(item.email)}
                          className="text-body hover:text-accent"
                          title="Copy email"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-body">{item.slug}</div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex items-center gap-3">
                        {item.artworkUrl ? (
                          <a href={item.artworkUrl} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={item.artworkUrl} alt={item.artworkFileName || item.slug} className="h-14 w-14 rounded border object-contain" />
                          </a>
                        ) : (
                          <div className="h-14 w-14 rounded border bg-gray-50" />
                        )}
                        <div>
                          <div className="max-w-[240px] truncate text-xs font-semibold text-heading">
                            {item.artworkFileName || "No file name"}
                          </div>
                          <div className="mt-1 text-xs text-body">
                            {[item.catalog, item.color].filter(Boolean).join(" / ") || "No catalog"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="text-xs text-body">{item.source || "-"}</div>
                      {item.landingUrl && (
                        <a href={item.landingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center text-xs text-accent">
                          Landing
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      )}
                    </td>
                    <td className="p-3 align-top text-xs text-body">
                      {item.orderCount}
                      {item.latestOrderNum ? ` / #${item.latestOrderNum}` : ""}
                    </td>
                    <td className="p-3 align-top text-xs text-body">
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && items.length === 0 && (
            <div className="p-8 text-center text-sm text-body">No customize leads found.</div>
          )}

          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-3 border-t border-border-100 p-4">
              <Button type="button" variant="outline" size="small" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <span className="text-sm text-body">Page {page} / {lastPage}</span>
              <Button type="button" variant="outline" size="small" disabled={page >= lastPage} onClick={() => setPage((current) => current + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>

        <aside className="rounded bg-white p-5 shadow">
          <h2 className="text-lg font-semibold text-heading">Follow-up Template</h2>
          <div className="mt-4 space-y-3">
            {[
              ["name", "Campaign name"],
              ["subject", "Subject"],
              ["previewText", "Preview text"],
              ["heading", "Heading"],
              ["discountCode", "Discount code"],
              ["discountPercent", "Discount percent"],
              ["ctaText", "CTA text"],
              ["ctaUrl", "CTA URL"],
              ["testEmail", "Test email"],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block font-semibold text-heading">{label}</span>
                <input
                  value={campaign[key as keyof typeof campaign]}
                  onChange={(event) => updateCampaign(key as keyof typeof campaign, event.target.value)}
                  className="h-10 w-full rounded border border-border-200 px-3 text-sm outline-none focus:border-accent"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-2">
            <Button type="button" size="small" variant="outline" disabled={Boolean(actionLoading)} onClick={() => runCampaignAction("test")}>
              {actionLoading === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send Test
            </Button>
            <Button type="button" size="small" variant="outline" disabled={Boolean(actionLoading) || selectedIds.length === 0} onClick={() => runCampaignAction("dry-run")}>
              Dry Run Selected
            </Button>
            <Button type="button" size="small" variant="outline" disabled={Boolean(actionLoading) || selectedIds.length === 0} onClick={() => runCampaignAction("create")}>
              Create Campaign
            </Button>
            <Button type="button" size="small" disabled={Boolean(actionLoading) || selectedIds.length === 0} onClick={() => runCampaignAction("send")}>
              {actionLoading === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Selected ({selectedIds.length})
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

CustomizeLeadsPage.authenticate = {
  permissions: adminOnly,
};

CustomizeLeadsPage.Layout = Layout;

export const getStaticProps = async ({ locale }: any) => ({
  props: {
    ...(await serverSideTranslations(locale, ["common"])),
  },
});
