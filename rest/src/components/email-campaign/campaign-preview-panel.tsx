import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export type CampaignLink = {
  key: string;
  label: string;
  url: string;
  status: number | null;
  ok: boolean;
  required: boolean;
  note?: string | null;
};

type PreviewResult = {
  email: string;
  name: string | null;
  country_code: string | null;
  last_order_at: string | null;
  subject: string;
  preview_text: string | null;
  blocked: boolean;
  block_reason: string | null;
  products_in_email: number;
  products_dropped: number;
  links: CampaignLink[];
  mailing_address_missing: boolean;
  html: string;
};

export type BatchCheckResult = {
  checked: number;
  ok: number;
  blocked: number;
  with_products: number;
  without_products: number;
  products_shown: number;
  products_dropped: number;
  safe_to_send: boolean;
  checked_at: string;
  broken_links: { url: string; label: string; status: number | null; required: boolean; count: number }[];
  blocked_recipients: { email: string; reason: string }[];
  recipients: { email: string; name: string | null; products: number; dropped: number; blocked: boolean }[];
};

type Props = {
  campaignId: number;
  campaignStatus: string;
  defaultEmail?: string;
  onBatchChecked?: (result: BatchCheckResult | null) => void;
  onStatusChanged?: () => void;
};

async function postAction(body: Record<string, unknown>) {
  const res = await fetch("/api/email-campaigns/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error([json.error, json.details].filter(Boolean).join(": ") || "Request failed");
  }
  return json;
}

export function LinkTable({ links }: { links: CampaignLink[] }) {
  if (!links.length) {
    return <p className="text-xs text-gray-500">No links recorded.</p>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">Link</th>
            <th className="text-left p-2">Check</th>
            <th className="text-left p-2">Open</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link, index) => (
            <tr key={`${link.key}-${index}`} className={`border-t ${link.ok ? "" : "bg-red-50"}`}>
              <td className="p-2 align-top">
                <p className="font-semibold text-gray-800">{link.label}</p>
                <p className="font-mono text-[10px] text-gray-500 break-all">{link.url}</p>
                {link.note && <p className="text-[10px] text-red-600 mt-0.5">{link.note}</p>}
              </td>
              <td className="p-2 align-top whitespace-nowrap">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold ${
                    link.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {link.ok ? "200 OK" : `${link.status ?? "No response"}`}
                </span>
                {link.required && !link.ok && <p className="text-[10px] text-red-600 mt-1">Required: email blocked</p>}
                {!link.required && !link.ok && <p className="text-[10px] text-gray-500 mt-1">Removed from email</p>}
              </td>
              <td className="p-2 align-top">
                {link.url && (
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    Open ↗
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmailFrame({ html }: { html: string }) {
  return (
    <iframe
      title="Email preview"
      srcDoc={html}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      className="w-full rounded-lg border bg-white"
      style={{ height: 900 }}
    />
  );
}

export function SentEmailModal({ recipientId, onClose }: { recipientId: number; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/email-campaigns/recipient/${recipientId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load email");
        setData(json);
      })
      .catch((err) => setError(err.message));
  }, [recipientId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-6xl shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Email sent to {data?.email || "..."}</h3>
            {data && (
              <p className="text-xs text-gray-500">
                Status: {data.status}
                {data.sent_at ? ` · sent ${new Date(data.sent_at).toLocaleString()}` : ""}
                {data.error_message ? ` · ${data.error_message}` : ""}
              </p>
            )}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
            ✕ Close
          </button>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!data && !error && <p className="text-sm text-gray-500">Loading...</p>}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              {data.html ? (
                <EmailFrame html={data.html} />
              ) : (
                <p className="text-sm text-gray-500 p-4 border rounded-lg">
                  No HTML stored for this recipient (it was blocked before sending or sent before snapshots existed).
                </p>
              )}
            </div>
            <div className="lg:col-span-2">
              <p className="text-sm font-bold text-gray-700 mb-2">Links checked before sending</p>
              <LinkTable links={data.links || []} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignPreviewPanel({
  campaignId,
  campaignStatus,
  defaultEmail,
  onBatchChecked,
  onStatusChanged,
}: Props) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [batchLimit, setBatchLimit] = useState(300);
  const [batch, setBatch] = useState<BatchCheckResult | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    setPreview(null);
    setBatch(null);
    onBatchChecked?.(null);
    setEmail(defaultEmail || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const runPreview = async (target?: string) => {
    const address = (target ?? email).trim();
    if (!address) {
      toast.error("Enter a customer email to preview");
      return;
    }
    setEmail(address);
    setPreviewLoading(true);
    try {
      setPreview(await postAction({ id: campaignId, action: "preview", email: address }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const runBatchCheck = async () => {
    setBatchLoading(true);
    try {
      const result = await postAction({ id: campaignId, action: "check-batch", limit: batchLimit });
      setBatch(result);
      onBatchChecked?.(result);
      if (result.safe_to_send) {
        toast.success(`All ${result.checked} emails OK to send`);
      } else {
        toast.error(`${result.blocked} of ${result.checked} emails blocked by broken links`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleStatus = async () => {
    const action = campaignStatus === "paused" ? "resume" : "pause";
    setStatusLoading(true);
    try {
      const result = await postAction({ id: campaignId, action });
      toast.success(result.message);
      onStatusChanged?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="bg-white border-2 border-blue-100 rounded-xl p-5 mb-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-extrabold text-gray-800">👀 Email content check</h3>
          <p className="text-xs text-gray-500">
            See exactly what a customer will receive. Every link is opened on the live store; product links that fail are
            removed and emails with a broken customize link are never sent.
          </p>
        </div>
        {(campaignStatus === "sending" || campaignStatus === "paused") && (
          <button
            onClick={toggleStatus}
            disabled={statusLoading}
            className={`px-4 py-2 rounded-lg text-sm font-bold border disabled:opacity-50 ${
              campaignStatus === "paused"
                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                : "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
            }`}
          >
            {statusLoading ? "..." : campaignStatus === "paused" ? "▶ Resume daily sending" : "⏸ Pause daily sending"}
          </button>
        )}
      </div>

      {/* Single customer preview */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runPreview()}
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
          placeholder="Customer email, e.g. customer@gmail.com"
        />
        <button
          onClick={() => runPreview()}
          disabled={previewLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-bold disabled:opacity-50 whitespace-nowrap"
        >
          {previewLoading ? "Rendering..." : "Preview email"}
        </button>
      </div>

      {preview && (
        <div className="mb-6">
          {preview.blocked && (
            <div className="p-3 mb-3 rounded-lg bg-red-50 text-red-700 text-sm font-semibold">
              ⛔ This customer would NOT be emailed: {preview.block_reason}
            </div>
          )}
          {preview.mailing_address_missing && (
            <div className="p-3 mb-3 rounded-lg bg-yellow-50 text-yellow-800 text-xs">
              ⚠️ EMAIL_MAILING_ADDRESS is not set on the orders server. US law (CAN-SPAM) requires a postal address in the
              footer of marketing emails.
            </div>
          )}
          {preview.products_dropped > 0 && (
            <div className="p-3 mb-3 rounded-lg bg-yellow-50 text-yellow-800 text-xs">
              ⚠️ {preview.products_dropped} past product(s) removed because their page does not open.
            </div>
          )}
          <div className="text-xs text-gray-600 mb-3 space-y-0.5">
            <p>
              <strong>To:</strong> {preview.name ? `${preview.name} <${preview.email}>` : preview.email}
              {preview.country_code ? ` · ${preview.country_code}` : " · country unknown"}
              {preview.last_order_at ? ` · last order ${new Date(preview.last_order_at).toLocaleDateString()}` : ""}
            </p>
            <p>
              <strong>Subject:</strong> {preview.subject}
            </p>
            {preview.preview_text && (
              <p>
                <strong>Preview text:</strong> {preview.preview_text}
              </p>
            )}
            <p>
              <strong>Past products in email:</strong> {preview.products_in_email}
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <EmailFrame html={preview.html} />
            </div>
            <div className="lg:col-span-2">
              <p className="text-sm font-bold text-gray-700 mb-2">Links in this email</p>
              <LinkTable links={preview.links} />
            </div>
          </div>
        </div>
      )}

      {/* Next batch check */}
      <div className="border-t pt-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
          <div className="flex-1">
            <p className="font-bold text-gray-700 text-sm">Check the next batch before it goes out</p>
            <p className="text-xs text-gray-500">
              Renders the next emails (without sending) and opens every link. Takes 1–3 minutes for 300 emails.
            </p>
          </div>
          <input
            type="number"
            min={1}
            max={1000}
            value={batchLimit}
            onChange={(e) => setBatchLimit(Number(e.target.value))}
            className="w-24 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={runBatchCheck}
            disabled={batchLoading}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition text-sm font-bold disabled:opacity-50 whitespace-nowrap"
          >
            {batchLoading ? "Checking links..." : "Check next batch"}
          </button>
        </div>

        {batch && (
          <div>
            <div
              className={`p-3 mb-3 rounded-lg text-sm font-semibold ${
                batch.safe_to_send ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {batch.safe_to_send
                ? `✅ ${batch.checked} emails checked — all customize links work. Checked ${batch.checked_at}.`
                : `⛔ ${batch.blocked} of ${batch.checked} emails blocked by a broken customize link. Fix the store page before sending.`}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3 text-center">
              {[
                ["Checked", batch.checked],
                ["OK to send", batch.ok],
                ["With past products", batch.with_products],
                ["Customize only", batch.without_products],
                ["Products removed", batch.products_dropped],
              ].map(([label, value]) => (
                <div key={label as string} className="p-3 rounded-lg bg-gray-50 border">
                  <p className="text-xl font-bold text-gray-900">{Number(value).toLocaleString()}</p>
                  <p className="text-[11px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {batch.broken_links.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-bold text-red-600 mb-1">Broken links ({batch.broken_links.length})</p>
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-red-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">URL</th>
                        <th className="text-left p-2">HTTP</th>
                        <th className="text-left p-2">Emails</th>
                        <th className="text-left p-2">Effect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.broken_links.map((link) => (
                        <tr key={link.url} className="border-t">
                          <td className="p-2 font-mono break-all">
                            <a href={link.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                              {link.url}
                            </a>
                          </td>
                          <td className="p-2">{link.status ?? "No response"}</td>
                          <td className="p-2">{link.count}</td>
                          <td className="p-2">{link.required ? "Email blocked" : "Product removed"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-sm font-bold text-gray-700 mb-1">Next recipients</p>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Products</th>
                    <th className="text-left p-2">Status</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {batch.recipients.map((recipient, index) => (
                    <tr key={recipient.email} className={`border-t ${recipient.blocked ? "bg-red-50" : ""}`}>
                      <td className="p-2 text-gray-500">{index + 1}</td>
                      <td className="p-2 font-mono">{recipient.email}</td>
                      <td className="p-2">
                        {recipient.products}
                        {recipient.dropped > 0 && <span className="text-red-600"> (−{recipient.dropped})</span>}
                      </td>
                      <td className="p-2">{recipient.blocked ? "Blocked" : "OK"}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => runPreview(recipient.email)}
                          className="px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
