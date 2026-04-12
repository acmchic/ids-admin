import Card from "@components/common/card";
import Layout from "@components/layouts/admin";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { adminOnly } from "@utils/auth-utils";
import Loader from "@components/ui/loader/loader";

type Campaign = {
  id: number;
  name: string;
  subject: string;
  status: string;
  discount_code: string | null;
  discount_percent: number | null;
  total_recipients: number;
  sent_count: number;
  pending_count: number;
  failed_count: number;
  opened_count: number;
  batch_size: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type CampaignDetail = {
  campaign: Campaign;
  stats: { status: string; count: number }[];
  recentRecipients: any[];
  failedRecipients: any[];
};

type OverviewData = {
  campaigns: Campaign[];
  unsubscribeCount: number;
  totalOrderEmails: number;
};

type Contact = {
  id: number;
  email: string;
  name: string | null;
  source: string;
  source_detail: string | null;
  is_active: boolean;
  orders_count: number;
  total_spent: number;
  first_order_at: string | null;
  last_order_at: string | null;
  tags: string[] | null;
  created_at: string | null;
};

type ContactsData = {
  contacts: Contact[];
  stats: {
    total: number;
    active_count: number;
    from_orders: number;
    from_csv: number;
    from_manual: number;
    repeat_buyers: number;
    vip_count: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sending: "bg-blue-100 text-blue-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
};

const recipientStatusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  opened: "bg-blue-100 text-blue-700",
};

const sourceColors: Record<string, string> = {
  order: "bg-blue-100 text-blue-700",
  csv: "bg-purple-100 text-purple-700",
  manual: "bg-orange-100 text-orange-700",
};

function ProgressBar({ sent, total, failed }: { sent: number; total: number; failed: number }) {
  const sentPct = total > 0 ? (sent / total) * 100 : 0;
  const failedPct = total > 0 ? (failed / total) * 100 : 0;

  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div className="h-full flex">
        <div className="bg-green-500 transition-all duration-500" style={{ width: `${sentPct}%` }} />
        <div className="bg-red-400 transition-all duration-500" style={{ width: `${failedPct}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </div>
      </div>
    </div>
  );
}

export default function EmailCampaigns() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"campaigns" | "contacts">("campaigns");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Contacts state
  const [contactsData, setContactsData] = useState<ContactsData | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsSearch, setContactsSearch] = useState("");
  const [contactsSource, setContactsSource] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/email-campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(async (page = 1, search = "", source = "") => {
    try {
      setContactsLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      if (source) params.set("source", source);
      const res = await fetch(`/api/email-campaigns/contacts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const json = await res.json();
      setContactsData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: number) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/email-campaigns/${id}`);
      if (!res.ok) throw new Error("Failed to fetch campaign detail");
      const json = await res.json();
      setSelectedCampaign(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "contacts") {
      fetchContacts(contactsPage, contactsSearch, contactsSource);
    }
  }, [activeTab, contactsPage, contactsSource, fetchContacts]);

  const handleContactsSearch = () => {
    setContactsPage(1);
    fetchContacts(1, contactsSearch, contactsSource);
  };

  if (loading) return <Loader text="Loading..." />;
  if (error && !data) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-500 text-lg font-semibold mb-2">⚠️ {error}</p>
        <p className="text-gray-500 text-sm mb-4">
          Make sure you have run <code className="bg-gray-100 px-2 py-1 rounded">php artisan migrate</code> on the orders server.
        </p>
        <button onClick={fetchData} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition">Retry</button>
      </Card>
    );
  }

  return (
    <>
      {/* Header + Tabs */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📧 Email Campaigns</h1>
            <p className="text-sm text-gray-500 mt-1">Manage campaigns and contacts</p>
          </div>
          <button
            onClick={() => { fetchData(); if (activeTab === "contacts") fetchContacts(contactsPage, contactsSearch, contactsSource); }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              activeTab === "campaigns" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            📨 Campaigns
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              activeTab === "contacts" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            👥 Contacts
          </button>
        </div>
      </Card>

      {/* ==================== CAMPAIGNS TAB ==================== */}
      {activeTab === "campaigns" && (
        <>
          {/* Overview Stats */}
          <Card className="p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="Total Customer Emails" value={data?.totalOrderEmails || 0} icon="👥" color="bg-blue-50 border-blue-200" />
              <StatCard label="Campaigns" value={data?.campaigns?.length || 0} icon="📨" color="bg-purple-50 border-purple-200" />
              <StatCard label="Total Sent" value={data?.campaigns?.reduce((sum, c) => sum + c.sent_count, 0) || 0} icon="✅" color="bg-green-50 border-green-200" />
              <StatCard label="Unsubscribed" value={data?.unsubscribeCount || 0} icon="🚫" color="bg-red-50 border-red-200" />
            </div>
          </Card>

          {/* Campaigns List */}
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Campaigns</h2>
            {!data?.campaigns?.length ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-500 font-medium">No campaigns yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Run <code className="bg-gray-100 px-2 py-1 rounded text-xs">php artisan campaign:create</code>
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold text-gray-600">Campaign</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Progress</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Sent</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Failed</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Total</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Created</th>
                      <th className="text-center p-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.campaigns.map((campaign) => {
                      const progress = campaign.total_recipients > 0 ? Math.round((campaign.sent_count / campaign.total_recipients) * 100) : 0;
                      return (
                        <tr key={campaign.id} className="border-b hover:bg-gray-50 transition">
                          <td className="p-3">
                            <p className="font-semibold text-gray-900">{campaign.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{campaign.subject}</p>
                            {campaign.discount_code && (
                              <span className="inline-block mt-1 text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                                {campaign.discount_code} ({campaign.discount_percent}% OFF)
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[campaign.status] || "bg-gray-100 text-gray-700"}`}>
                              {campaign.status}
                            </span>
                          </td>
                          <td className="p-3 min-w-[160px]">
                            <ProgressBar sent={campaign.sent_count} total={campaign.total_recipients} failed={campaign.failed_count} />
                            <p className="text-xs text-gray-500 mt-1">{progress}%</p>
                          </td>
                          <td className="p-3 text-right font-mono text-green-600 font-semibold">{campaign.sent_count.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-red-500 font-semibold">{campaign.failed_count.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono font-semibold">{campaign.total_recipients.toLocaleString()}</td>
                          <td className="p-3 text-gray-500 text-xs">{campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : "-"}</td>
                          <td className="p-3 text-center">
                            <button onClick={() => fetchDetail(campaign.id)} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition text-xs font-medium">
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Campaign Detail */}
          {detailLoading && <Card className="p-8 text-center"><Loader text="Loading details..." /></Card>}
          {selectedCampaign && !detailLoading && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedCampaign.campaign.name}</h2>
                  <p className="text-sm text-gray-500">{selectedCampaign.campaign.subject}</p>
                </div>
                <button onClick={() => setSelectedCampaign(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm">
                  ✕ Close
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {selectedCampaign.stats.map((stat) => (
                  <div key={stat.status} className={`p-4 rounded-lg text-center ${recipientStatusColors[stat.status] || "bg-gray-100"}`}>
                    <p className="text-2xl font-bold">{stat.count.toLocaleString()}</p>
                    <p className="text-sm font-medium capitalize">{stat.status}</p>
                  </div>
                ))}
              </div>
              {selectedCampaign.failedRecipients.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-red-600 mb-2">❌ Failed ({selectedCampaign.failedRecipients.length})</h3>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50 sticky top-0"><tr><th className="text-left p-2">Email</th><th className="text-left p-2">Error</th></tr></thead>
                      <tbody>
                        {selectedCampaign.failedRecipients.map((r: any) => (
                          <tr key={r.id} className="border-b"><td className="p-2 font-mono">{r.email}</td><td className="p-2 text-red-600">{r.error_message || "-"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">📋 Recipients (last 100)</h3>
                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0"><tr><th className="text-left p-2">Email</th><th className="text-left p-2">Name</th><th className="text-left p-2">Status</th><th className="text-left p-2">Sent At</th></tr></thead>
                    <tbody>
                      {selectedCampaign.recentRecipients.map((r: any) => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-mono">{r.email}</td>
                          <td className="p-2">{r.name || "-"}</td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${recipientStatusColors[r.status] || "bg-gray-100"}`}>{r.status}</span>
                          </td>
                          <td className="p-2 text-gray-500">{r.sent_at ? new Date(r.sent_at).toLocaleString() : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ==================== CONTACTS TAB ==================== */}
      {activeTab === "contacts" && (
        <>
          {/* Contacts Stats */}
          {contactsData?.stats && (
            <Card className="p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <StatCard label="Total" value={contactsData.stats.total} icon="📧" color="bg-gray-50 border-gray-200" />
                <StatCard label="Active" value={contactsData.stats.active_count} icon="✅" color="bg-green-50 border-green-200" />
                <StatCard label="From Orders" value={contactsData.stats.from_orders} icon="🛒" color="bg-blue-50 border-blue-200" />
                <StatCard label="From CSV" value={contactsData.stats.from_csv} icon="📄" color="bg-purple-50 border-purple-200" />
                <StatCard label="Manual" value={contactsData.stats.from_manual} icon="✍️" color="bg-orange-50 border-orange-200" />
                <StatCard label="Repeat Buyers" value={contactsData.stats.repeat_buyers} icon="🔁" color="bg-yellow-50 border-yellow-200" />
                <StatCard label="VIP ($100+)" value={contactsData.stats.vip_count} icon="⭐" color="bg-pink-50 border-pink-200" />
              </div>
            </Card>
          )}

          {/* Search & Filter */}
          <Card className="p-6 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={contactsSearch}
                  onChange={(e) => setContactsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleContactsSearch()}
                  placeholder="Search by email or name..."
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-gray-300 focus:outline-none"
                />
              </div>
              <select
                value={contactsSource}
                onChange={(e) => { setContactsSource(e.target.value); setContactsPage(1); }}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Sources</option>
                <option value="order">Orders</option>
                <option value="csv">CSV Import</option>
                <option value="manual">Manual</option>
              </select>
              <button onClick={handleContactsSearch} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium">
                Search
              </button>

              <div className="ml-auto text-sm text-gray-500">
                {contactsData?.pagination && (
                  <>Showing {((contactsData.pagination.page - 1) * contactsData.pagination.limit) + 1}-{Math.min(contactsData.pagination.page * contactsData.pagination.limit, contactsData.pagination.total)} of {contactsData.pagination.total.toLocaleString()}</>
                )}
              </div>
            </div>

            {/* CLI hint */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-xs text-gray-500 font-mono">
                <span className="font-bold text-gray-700">CLI:</span>{" "}
                <code>php artisan contacts:sync-orders</code> (sync from orders) |{" "}
                <code>php artisan contacts:import-csv path/to/file.csv</code> (import CSV)
              </p>
            </div>
          </Card>

          {/* Contacts Table */}
          <Card className="p-6">
            {contactsLoading ? (
              <Loader text="Loading contacts..." />
            ) : !contactsData?.contacts?.length ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-500 font-medium">No contacts yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Run <code className="bg-gray-100 px-2 py-1 rounded text-xs">php artisan contacts:sync-orders</code> to import from orders
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-semibold text-gray-600">Email</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Name</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Source</th>
                        <th className="text-right p-3 font-semibold text-gray-600">Orders</th>
                        <th className="text-right p-3 font-semibold text-gray-600">Spent</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Tags</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Last Order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactsData.contacts.map((contact) => (
                        <tr key={contact.id} className="border-b hover:bg-gray-50 transition">
                          <td className="p-3 font-mono text-xs">{contact.email}</td>
                          <td className="p-3 text-gray-700">{contact.name || "-"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sourceColors[contact.source] || "bg-gray-100 text-gray-700"}`}>
                              {contact.source}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-semibold">{contact.orders_count}</td>
                          <td className="p-3 text-right font-mono text-green-600 font-semibold">
                            ${contact.total_spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {contact.tags?.map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-gray-500 text-xs">
                            {contact.last_order_at ? new Date(contact.last_order_at).toLocaleDateString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {contactsData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                    <button
                      onClick={() => setContactsPage((p) => Math.max(1, p - 1))}
                      disabled={contactsPage <= 1}
                      className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30 hover:bg-gray-50"
                    >
                      ← Prev
                    </button>
                    <span className="text-sm text-gray-500">
                      Page {contactsPage} / {contactsData.pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setContactsPage((p) => Math.min(contactsData!.pagination.totalPages, p + 1))}
                      disabled={contactsPage >= contactsData.pagination.totalPages}
                      className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30 hover:bg-gray-50"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </>
  );
}

EmailCampaigns.authenticate = {
  permissions: adminOnly,
};

EmailCampaigns.Layout = Layout;

export const getStaticProps = async ({ locale }: any) => ({
  props: {
    ...(await serverSideTranslations(locale, ["table", "common", "form"])),
  },
});
