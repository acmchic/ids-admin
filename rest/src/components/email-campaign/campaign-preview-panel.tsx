import { Fragment, useEffect, useState } from "react";
import { toast } from "react-toastify";

export type CampaignLink = {
  key: string;
  label: string;
  url: string;
  status: number | null;
  ok: boolean;
  required: boolean;
  note?: string | null;
  page_title?: string | null;
};

type OrderLine = {
  order_id: number;
  tracking_number: string | null;
  ordered_at: string;
  is_custom: boolean;
  product_name: string | null;
  product_slug: string | null;
  variation: string | null;
  image_url: string | null;
  note: string | null;
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
  orders?: OrderLine[];
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
  recipients: {
    email: string;
    name: string | null;
    last_order_at?: string | null;
    products: number;
    dropped: number;
    blocked: boolean;
    links?: (CampaignLink & { image_url?: string | null })[];
  }[];
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
                <p className="font-mono text-[10px] text-gray-500 break-all" title={link.url}>
                  {link.url.split("?")[0].replace(/^https?:\/\/[^/]+/, "")}
                </p>
                {link.page_title && <p className="text-[10px] text-gray-700 mt-0.5">Opens: “{link.page_title}”</p>}
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

/** What the customer actually bought, to compare with the links in the email. */
export function OrdersTable({ orders, links }: { orders: OrderLine[]; links: CampaignLink[] }) {
  const inEmail = (name: string | null) =>
    links.find((link) => link.key.startsWith("reorder") && link.label === `Reorder: ${name}`);

  return (
    <div className="border rounded-lg overflow-hidden">
      <p className="bg-gray-50 p-2 text-xs font-bold text-gray-700">Customer's orders ({orders.length})</p>
      {orders.length === 0 && <p className="p-2 text-xs text-gray-500">No completed orders found for this email.</p>}
      <table className="w-full text-xs">
        <tbody>
          {orders.map((order, index) => {
            const link = inEmail(order.product_name);
            return (
              <tr key={`${order.order_id}-${index}`} className="border-t align-top">
                <td className="p-2 w-14">
                  {order.image_url ? (
                    <img src={order.image_url} alt="" loading="lazy" className="w-12 h-12 object-cover rounded border" />
                  ) : (
                    <div className="w-12 h-12 rounded border bg-gray-100" />
                  )}
                </td>
                <td className="p-2">
                  <p className="font-semibold text-gray-800">{order.product_name || "(unknown product)"}</p>
                  <p className="text-gray-500">
                    #{order.tracking_number || order.order_id} · {order.ordered_at.slice(0, 10)}
                    {order.variation ? ` · ${order.variation}` : ""}
                    {order.is_custom ? " · custom" : ""}
                  </p>
                  {order.note && <p className="text-red-600">{order.note}</p>}
                </td>
                <td className="p-2 whitespace-nowrap">
                  {link ? (
                    link.ok ? (
                      <a href={link.url} target="_blank" rel="noreferrer" className="text-green-700 font-semibold underline">In email ↗</a>
                    ) : (
                      <span className="text-red-600 font-semibold">Removed</span>
                    )
                  ) : (
                    <span className="text-gray-400">Not in email</span>
                  )}
                </td>
              </tr>
            );
          })}
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
  const [testTo, setTestTo] = useState("acmchic88@gmail.com");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [batch, setBatch] = useState<BatchCheckResult | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "test" | "batch" | "status">("");
  const [progress, setProgress] = useState<{ phase: string; done: number; total: number } | null>(null);

  useEffect(() => {
    setPreview(null);
    setBatch(null);
    onBatchChecked?.(null);
    setEmail(defaultEmail || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const run = async (kind: typeof busy, body: Record<string, unknown>) => {
    setBusy(kind);
    try {
      return await postAction({ id: campaignId, ...body });
    } catch (err: any) {
      toast.error(err.message);
      return null;
    } finally {
      setBusy("");
    }
  };

  const runPreview = async (target?: string) => {
    const address = (target ?? email).trim();
    if (!address) return toast.error("Enter a customer email");
    setEmail(address);
    const result = await run("preview", { action: "preview", email: address });
    if (result) setPreview(result);
  };

  const sendTest = async () => {
    const result = await run("test", { action: "test", email: testTo, previewAs: email.trim() || undefined });
    if (result) toast.success(`Test sent to ${testTo}`);
  };

  const checkBatch = async () => {
    setBusy("batch");
    try {
      await postAction({ id: campaignId, action: "check-batch", limit: 300 });
      // Runs in the background on the server; poll every 3s for up to 15 minutes.
      for (let i = 0; i < 300; i++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const status = await postAction({ id: campaignId, action: "check-batch-status" });
        if (status.status === "running") {
          setProgress(status.progress || null);
          continue;
        }
        if (status.status !== "done") throw new Error(status.error || "Link check failed");
        setBatch(status);
        onBatchChecked?.(status);
        // Pre-fill the next customer so Preview works in one click.
        if (!email.trim() && status.recipients?.[0]?.email) setEmail(status.recipients[0].email);
        return;
      }
      throw new Error("Link check is taking too long; try again later");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy("");
      setProgress(null);
    }
  };

  const toggleStatus = async () => {
    const result = await run("status", { action: campaignStatus === "paused" ? "resume" : "pause" });
    if (result) {
      toast.success(result.message);
      onStatusChanged?.();
    }
  };

  const inList = (address: string) =>
    Boolean(batch?.recipients.some((recipient) => recipient.email.toLowerCase() === address.toLowerCase()));

  const previewBlock = (result: PreviewResult) => (
    <div className="mb-4">
      {(result.blocked || result.mailing_address_missing || result.products_dropped > 0) && (
        <div className="p-3 mb-3 rounded-lg bg-yellow-50 text-yellow-800 text-xs space-y-1">
          {result.blocked && <p className="text-red-700 font-semibold">⛔ Will not be sent: {result.block_reason}</p>}
          {result.products_dropped > 0 && <p>{result.products_dropped} past product(s) removed (page does not open).</p>}
          {result.mailing_address_missing && <p>EMAIL_MAILING_ADDRESS is not set (required in the footer by US law).</p>}
        </div>
      )}
      <p className="text-xs text-gray-600 mb-3">
        <strong>Subject:</strong> {result.subject} · <strong>To:</strong> {result.email}
        {result.country_code ? ` (${result.country_code})` : ""}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <EmailFrame html={result.html} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <LinkTable links={result.links} />
          <OrdersTable orders={result.orders || []} links={result.links} />
        </div>
      </div>
    </div>
  );

  const button = "px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 whitespace-nowrap";

  return (
    <div className="border rounded-xl p-5 mb-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h3 className="text-base font-extrabold text-gray-800 flex-1">Email check</h3>
        <button onClick={checkBatch} disabled={!!busy} className={`${button} bg-gray-900 text-white hover:bg-gray-700`}>
          {busy === "batch"
            ? progress
              ? `${progress.phase} ${progress.done}/${progress.total}...`
              : "Starting check..."
            : "Check next 300 emails"}
        </button>
        {(campaignStatus === "sending" || campaignStatus === "paused") && (
          <button onClick={toggleStatus} disabled={!!busy} className={`${button} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
            {campaignStatus === "paused" ? "▶ Resume" : "⏸ Pause"}
          </button>
        )}
      </div>

      {batch && (
        <div className={`p-3 mb-4 rounded-lg text-sm ${batch.safe_to_send ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          <p className="font-semibold">
            {batch.checked === 0
              ? "No customers waiting to be emailed."
              : batch.safe_to_send
                ? `✅ ${batch.checked} emails OK · ${batch.with_products} with past products · ${batch.products_dropped} broken product links removed`
                : `⛔ ${batch.blocked} of ${batch.checked} emails blocked: customize page does not open`}
          </p>
          {batch.broken_links.slice(0, 10).map((link) => (
            <p key={link.url} className="text-xs font-mono break-all mt-1">
              {link.status ?? "no response"} · {link.count}× ·{" "}
              <a href={link.url} target="_blank" rel="noreferrer" className="underline">{link.url}</a>
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runPreview()}
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          placeholder="Customer email"
        />
        <button onClick={() => runPreview()} disabled={!!busy} className={`${button} bg-blue-600 text-white hover:bg-blue-700`}>
          {busy === "preview" ? "Loading..." : "Preview"}
        </button>
        <input
          type="email"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          className="md:w-56 border rounded-lg px-3 py-2 text-sm"
          placeholder="Send test to"
        />
        <button onClick={sendTest} disabled={!!busy} className={`${button} bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100`}>
          {busy === "test" ? "Sending..." : "Send test"}
        </button>
      </div>

      {preview && !inList(preview.email) && previewBlock(preview)}

      {batch && batch.recipients.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 w-10">#</th>
                <th className="text-left p-2">Customer</th>
                <th className="text-left p-2">Products in email (click to open)</th>
                <th className="text-left p-2">Customize</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {batch.recipients.map((recipient, index) => {
                const products = (recipient.links || []).filter((link) => link.key.startsWith("reorder"));
                const customize = (recipient.links || []).find((link) => link.key === "customize");
                const open = preview?.email === recipient.email.toLowerCase();
                return (
                  <Fragment key={recipient.email}>
                    <tr className={`border-t align-top ${recipient.blocked ? "bg-red-50" : open ? "bg-blue-50" : ""}`}>
                      <td className="p-2 text-gray-500">{index + 1}</td>
                      <td className="p-2">
                        <p className="font-semibold text-gray-800">{recipient.name || "-"}</p>
                        <p className="font-mono text-gray-500">{recipient.email}</p>
                        {recipient.last_order_at && <p className="text-gray-400">Last order {recipient.last_order_at}</p>}
                      </td>
                      <td className="p-2">
                        {products.length === 0 && <span className="text-gray-400">No past products (customize only)</span>}
                        <div className="flex flex-wrap gap-2">
                          {products.map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              title={`${link.label}${link.ok ? "" : ` — removed (${link.status ?? "no response"})`}`}
                              className={`block w-16 text-center ${link.ok ? "" : "opacity-40"}`}
                            >
                              {link.image_url ? (
                                <img src={link.image_url} alt="" loading="lazy" className={`w-16 h-16 object-cover rounded border ${link.ok ? "" : "border-red-500"}`} />
                              ) : (
                                <div className="w-16 h-16 rounded border bg-gray-100" />
                              )}
                              <span className={`block truncate ${link.ok ? "text-blue-600" : "text-red-600 line-through"}`}>
                                {link.label.replace(/^Reorder: /, "")}
                              </span>
                            </a>
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        {customize && (
                          <a href={customize.url} target="_blank" rel="noreferrer" className={customize.ok ? "text-blue-600 underline" : "text-red-600 font-bold"}>
                            {customize.ok ? "Open ↗" : `Broken (${customize.status ?? "no response"})`}
                          </a>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => (open ? setPreview(null) : runPreview(recipient.email))}
                          disabled={!!busy}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-semibold disabled:opacity-50"
                        >
                          {busy === "preview" && email === recipient.email ? "..." : open ? "Hide" : "Preview"}
                        </button>
                      </td>
                    </tr>
                    {open && preview && (
                      <tr>
                        <td colSpan={5} className="p-3 bg-gray-50">
                          {previewBlock(preview)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
