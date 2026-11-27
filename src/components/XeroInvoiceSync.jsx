import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";

// Invoices page (admin): pull invoices made in Xero into the CRM now. The server also does
// this every 30 minutes. Read-only towards Xero.
//   GET  /integrations/xero/status        → { invoiceSync: { lastSyncAt, lastResult, lastError } }
//   POST /integrations/xero/sync-invoices → { fetched, created, updated, linkedToContact, linkedToCompany, linkedToDeal, unmatched, onlineLinks }

const when = (v) => (v ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" }) : "");
const summary = (r) => r ? `${r.fetched ?? 0} checked, ${r.created ?? 0} new, ${r.updated ?? 0} updated, ${r.unmatched ?? 0} not linked to a contact or company` : "";

export default function XeroInvoiceSync({ onDone }) {
  const { request } = useAuth();
  const isAdmin = usePermissions().can("workspace.manage");
  const [sync, setSync] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    request("/integrations/xero/status").then((r) => setSync(r.data?.invoiceSync || null)).catch(() => {});
  }, [request]);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);
  if (!isAdmin) return null;

  async function run() {
    setBusy(true); setMsg("");
    try {
      const r = await request("/integrations/xero/sync-invoices", { method: "POST", body: {} });
      setMsg(`Synced from Xero: ${summary(r.data)}.`);
      load(); onDone?.();
    } catch (e) {
      setMsg(e.status === 404 ? "Syncing from Xero needs the latest server update." : (e.payload?.code || e.payload?.error?.code) === "INTEGRATION_NOT_CONNECTED" ? "Xero isn't connected yet. An admin can connect it in Settings → Integrations (Connect Xero)." : e.message || "The Xero sync failed.");
    } finally { setBusy(false); }
  }

  const title = sync?.lastSyncAt ? `Last synced ${when(sync.lastSyncAt)}: ${summary(sync.lastResult)}${sync.lastError ? `. Last error: ${sync.lastError}` : ""}` : "Pull invoices made in Xero into the CRM";
  return (
    <>
      <button type="button" className="btn ghost" onClick={run} disabled={busy} title={title}>{busy ? "Syncing from Xero…" : "Sync from Xero"}</button>
      {msg && <span className="xs-msg" role="status">{msg}</span>}
    </>
  );
}
