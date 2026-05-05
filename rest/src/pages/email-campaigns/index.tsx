import Card from "@components/common/card";
import Layout from "@components/layouts/admin";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { adminOnly } from "@utils/auth-utils";
import Loader from "@components/ui/loader/loader";
import { toast } from "react-toastify";

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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    discountCode: "WELCOME",
    discountPercent: "30",
    ctaUrl: "https://idreamshirt.com/products/customize/premium-t-shirt",
  });

  // Contacts state
  const [contactsData, setContactsData] = useState<ContactsData | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsSearch, setContactsSearch] = useState("");
  const [contactsSource, setContactsSource] = useState("");
  const [extractLimit, setExtractLimit] = useState(300);
  const [testEmail, setTestEmail] = useState("acmchic88@gmail.com");
  const [actionLoading, setActionLoading] = useState(false);
  const [dryRunData, setDryRunData] = useState<string[] | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/email-campaigns?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setData(data);
    } catch (err) {
      toast.error("Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  const runAction = async (id: number, action: string) => {
    try {
      setActionLoading(true);
      if (action === 'dry-run') setDryRunData(null);
      
      const res = await fetch("/api/email-campaigns/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id, 
          action, 
          limit: action === 'extract' ? extractLimit : undefined,
          batchSize: action === 'send' ? selectedPendingCount : undefined,
          email: action === 'test' ? testEmail : undefined
        }),
      });
      const result = await res.json();
      
      if (res.ok) {
        if (action === 'dry-run') {
          // Parse output to find email list
          const lines = result.output.split("\n")
            .filter((l: string) => l.includes("→"))
            .map((l: string) => l.replace("→", "").trim());
          setDryRunData(lines);
        } else {
          toast.success(result.message || `Action ${action} successful`);
          if (selectedCampaign) fetchDetail(id);
          fetchCampaigns();
          if (action === 'send') setShowSendConfirm(false);
        }
      } else {
        toast.error(result.error || `Action ${action} failed`);
      }
    } catch (err) {
      toast.error("Network error executing action");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteCampaign = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this campaign? This will remove all recipient data and cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/email-campaigns/${id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      
      if (res.ok) {
        toast.success(result.message || "Campaign deleted");
        fetchCampaigns();
      } else {
        toast.error(result.error || "Failed to delete campaign");
      }
    } catch (err) {
      toast.error("Network error deleting campaign");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/email-campaigns?t=${Date.now()}`, { cache: "no-store" });
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      const res = await fetch("/api/email-campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      await fetchData();
      toast.success("Campaign created successfully! ✨");
      setShowCreateModal(false);
      setFormData({
        name: "",
        subject: "",
        discountCode: "WELCOME",
        discountPercent: "30",
        ctaUrl: "https://idreamshirt.com/products/customize/premium-t-shirt",
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

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
      const res = await fetch(`/api/email-campaigns/${id}?t=${Date.now()}`, { cache: "no-store" });
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
    if (activeTab === "campaigns") {
      fetchCampaigns();
    }
  }, [activeTab, fetchCampaigns]);

  // Auto-refresh for sending campaigns
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedCampaign && selectedCampaign.campaign.status === 'sending') {
      interval = setInterval(() => {
        fetchDetail(selectedCampaign.campaign.id);
      }, 10000); // 10 seconds
    }
    return () => clearInterval(interval);
  }, [selectedCampaign, fetchDetail]);

  useEffect(() => {
    if (activeTab === "contacts") {
      fetchContacts(contactsPage, contactsSearch, contactsSource);
    }
  }, [activeTab, contactsPage, contactsSource, fetchContacts]);

  const handleContactsSearch = () => {
    setContactsPage(1);
    fetchContacts(1, contactsSearch, contactsSource);
  };

  const selectedPendingCount = selectedCampaign?.stats.find((stat) => stat.status === "pending")?.count || 0;

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
      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">✨ New Email Campaign</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Campaign Name</label>
                <input
                  required
                  placeholder="e.g. Welcome Back - April 2024"
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email Subject</label>
                <input
                  required
                  placeholder="e.g. Special 30% OFF just for you!"
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Discount Code</label>
                  <input
                    placeholder="e.g. WELCOME"
                    className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                    value={formData.discountCode}
                    onChange={(e) => setFormData({ ...formData, discountCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    placeholder="e.g. 30"
                    className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                    value={formData.discountPercent}
                    onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">CTA URL</label>
                <input
                  placeholder="Link for Shop Now button"
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none text-gray-500"
                  value={formData.ctaUrl}
                  onChange={(e) => setFormData({ ...formData, ctaUrl: e.target.value })}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-semibold disabled:opacity-50"
                >
                  {createLoading ? "Creating..." : "Create Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header + Tabs */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📧 Email Campaigns</h1>
            <p className="text-sm text-gray-500 mt-1">Manage campaigns and contacts</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { fetchData(); if (activeTab === "contacts") fetchContacts(contactsPage, contactsSearch, contactsSource); }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              ↻ Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium shadow-sm"
            >
              + Create Campaign
            </button>
          </div>
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
                            <div className="flex gap-2 justify-center">
                              <button onClick={() => fetchDetail(campaign.id)} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition text-xs font-medium">
                                View Details
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteCampaign(campaign.id); }}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                title="Delete Campaign"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
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
                <div className="flex gap-2">
                  <button 
                    onClick={() => { deleteCampaign(selectedCampaign.campaign.id); setSelectedCampaign(null); }} 
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition text-sm font-medium"
                  >
                    🗑️ Delete
                  </button>
                  <button onClick={() => setSelectedCampaign(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm">
                    ✕ Close
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {selectedCampaign.stats.map((stat) => (
                  <div key={stat.status} className={`p-4 rounded-lg text-center ${recipientStatusColors[stat.status] || "bg-gray-100"}`}>
                    <p className="text-2xl font-bold">{stat.count.toLocaleString()}</p>
                    <p className="text-sm font-medium capitalize">{stat.status}</p>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="bg-white border-2 border-orange-100 rounded-xl p-5 mb-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🛡️</span>
                  <h3 className="text-base font-extrabold text-gray-800">Safety & Quality Control</h3>
                </div>
                
                <div className="space-y-6">
                  {/* Step 1: Extract */}
                  <div className="flex flex-col md:flex-row md:items-center gap-4 py-3 border-b border-gray-100">
                    <div className="flex-1">
                      <p className="font-bold text-gray-700 text-sm">Step 1: Extract Next Unsent Contacts</p>
                      <p className="text-xs text-gray-500">Pick top customers who have not received a campaign email yet.</p>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={extractLimit} 
                        onChange={(e) => setExtractLimit(Number(e.target.value))}
                        className="w-24 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                        placeholder="Limit"
                      />
                      <button 
                        onClick={() => runAction(selectedCampaign.campaign.id, 'extract')}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition text-sm font-bold disabled:opacity-50"
                      >
                        {actionLoading ? "..." : "Extract"}
                      </button>
                    </div>
                  </div>

                  {/* Step 2: Test */}
                  <div className="flex flex-col md:flex-row md:items-center gap-4 py-3 border-b border-gray-100">
                    <div className="flex-1">
                      <p className="font-bold text-gray-700 text-sm">Step 2: Send Test Email</p>
                      <p className="text-xs text-gray-500">Check how it looks in your own inbox first.</p>
                    </div>
                    <div className="flex gap-2 flex-1">
                      <input 
                        type="email" 
                        value={testEmail} 
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none"
                        placeholder="your-email@example.com"
                      />
                      <button 
                        onClick={() => runAction(selectedCampaign.campaign.id, 'test')}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-600 hover:text-white transition text-sm font-bold disabled:opacity-50"
                      >
                        {actionLoading ? "..." : "Send Test"}
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Dry Run & Send */}
                  <div className="flex flex-col md:flex-row md:items-start gap-4 py-3">
                    <div className="flex-1">
                      <p className="font-bold text-gray-700 text-sm">Step 3: Preview & Dispatch</p>
                      <p className="text-xs text-gray-500">Preview the next 50 recipients, then send all pending recipients.</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => runAction(selectedCampaign.campaign.id, 'dry-run')}
                          disabled={actionLoading}
                          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition text-sm font-bold disabled:opacity-50"
                        >
                          {actionLoading ? "..." : "Preview Batch (50)"}
                        </button>
                        <button 
                          onClick={() => setShowSendConfirm(true)}
                          disabled={actionLoading || selectedPendingCount === 0}
                          className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-extrabold shadow-md hover:shadow-lg disabled:opacity-50"
                        >
                           🚀 Start Sending
                        </button>
                      </div>
                      
                      {dryRunData && (
                        <div className="mt-3 bg-gray-900 text-green-400 p-3 rounded-lg text-[10px] font-mono max-h-40 overflow-y-auto border border-gray-700">
                          <p className="text-gray-400 mb-1 font-sans border-b border-gray-800 pb-1">NEXT RECIPIENTS (PREVIEW):</p>
                          {dryRunData.map((email, i) => (
                            <p key={i}>→ {email}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirmation Modal */}
              {showSendConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-red-100">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
                      <h3 className="text-xl font-black text-gray-900">Are you sure?</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        This will send real emails to <strong>{selectedPendingCount.toLocaleString()} customers</strong>. Make sure you have tested the content and previewed the list.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => runAction(selectedCampaign.campaign.id, 'send')}
                        disabled={actionLoading}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition"
                      >
                        {actionLoading ? "Sending..." : "Yes, Dispatch Now"}
                      </button>
                      <button 
                        onClick={() => setShowSendConfirm(false)}
                        className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                        <th className="text-right p-3 font-semibold text-gray-600">Sent</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Tags</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Last Order</th>
                        <th className="text-left p-3 font-semibold text-gray-600">Last Sent</th>
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
                          <td className="p-3 text-right font-mono text-blue-600 font-semibold">{contact.sent_count || 0}</td>
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
                          <td className="p-3 text-gray-500 text-xs font-medium">
                            {contact.last_sent_at ? new Date(contact.last_sent_at).toLocaleDateString() : "-"}
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
