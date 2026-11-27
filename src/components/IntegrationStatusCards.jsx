import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import Badge from "./Badge";

// Settings → Integrations: Eventbrite and WhatsApp Business status (27 Nov round).
// Like Flodesk, the keys live in the backend's settings on Render and are never typed into
// or shown by the CRM. These cards only show whether the connection works.

const when = (v) => (v ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" }) : "never");

function useStatus(path, enabled) {
  const { request } = useAuth();
  const [state, setState] = useState({ data: null, loading: true, error: "", missing: false });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try { setState({ data: (await request(path)).data || {}, loading: false, error: "", missing: false }); }
    catch (e) { setState({ data: null, loading: false, missing: e.status === 404, error: e.status === 404 ? "" : e.message || "Could not check the connection." }); }
  }, [request, path]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  return [state, load];
}

/** GET /integrations/eventbrite → { connected, organizationName, webhookActive, lastSyncAt,
 *  lastSync: { events, registrations, contactsCreated, contactsUpdated, errors }, lastError }
 *  POST /integrations/eventbrite/sync → same shape after a full sync. */
export function EventbriteStatus() {
  const { request } = useAuth();
  const isAdmin = usePermissions().can("workspace.manage");
  const [state, load] = useStatus("/integrations/eventbrite", isAdmin);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  if (!isAdmin) return null;

  async function sync() {
    setSyncing(true); setMsg("");
    try {
      const r = await request("/integrations/eventbrite/sync", { method: "POST", body: {} });
      const s = r.data?.lastSync || r.data || {};
      setMsg(`Synced ${s.events ?? 0} events and ${s.registrations ?? 0} sign-ups: ${s.contactsCreated ?? 0} new contacts, ${s.contactsUpdated ?? 0} updated.`);
      await load();
    } catch (e) { setMsg((e.payload?.code || e.payload?.error?.code) === "SYNC_RUNNING" ? "A sync is already running. Check again in a minute." : e.message || "The sync failed."); }
    finally { setSyncing(false); }
  }

  const d = state.data;
  const s = d?.lastSync;
  return (
    <section className="panel rp-card fd-status" aria-labelledby="eb-title">
      <div className="rp-bd-head">
        <h3 id="eb-title">Eventbrite (events)</h3>
        <div className="ic-actions">
          {d?.connected && <button type="button" className="btn ghost small" onClick={sync} disabled={syncing || d.syncRunning}>{syncing || d.syncRunning ? "Syncing…" : "Sync now"}</button>}
          <button type="button" className="btn ghost small" onClick={load} disabled={state.loading}>{state.loading ? "Checking…" : "Check again"}</button>
        </div>
      </div>
      {state.missing && <p className="lk-muted">Eventbrite needs the latest server update.</p>}
      {state.error && <p className="lk-warn-text">{state.error}</p>}
      {d && <>
        <p>
          <Badge tone={d.connected ? "good" : "warn"}>{d.connected ? "Connected" : "Not connected"}</Badge>{" "}
          {d.connected
            ? <>{d.organizationName ? <>Organisation <b>{d.organizationName}</b>. </> : null}Everyone who signs up on Eventbrite is added to or matched with a contact (by email) and tagged "Eventbrite". <Link to="/events">See events</Link>.</>
            : "The Eventbrite private token isn't set on the server (EVENTBRITE_PRIVATE_TOKEN on Render), or Eventbrite rejected it."}
        </p>
        {d.connected && (
          <ul className="ic-facts">
            <li>New sign-ups arrive {d.webhookActive ? <b>straight away</b> : <span className="lk-warn-text">only with the 30-minute sync (the Eventbrite webhook isn't set up)</span>}.</li>
            <li>Last sync: {when(d.lastSyncAt)}{s ? ` · ${s.events ?? 0} events, ${s.registrations ?? 0} sign-ups, ${s.contactsCreated ?? 0} new contacts` : ""}{s?.errors ? ` · ${s.errors} errors` : ""}</li>
          </ul>
        )}
        {d.lastError && <p className="lk-warn-text">Last error: {d.lastError}</p>}
      </>}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}

/** GET /integrations/whatsapp/status → { configured, displayPhoneNumber, verifiedName,
 *  qualityRating, webhookVerified, lastInboundAt, templates: [{ name, language, category, status, body, paramCount }], error } */
export function WhatsAppStatus() {
  const isAdmin = usePermissions().can("workspace.manage");
  const [state, load] = useStatus("/integrations/whatsapp/status", isAdmin);
  if (!isAdmin) return null;
  const d = state.data;
  const approved = (d?.templates || []).filter((t) => String(t.status).toUpperCase() === "APPROVED");
  return (
    <section className="panel rp-card fd-status" aria-labelledby="wa-title">
      <div className="rp-bd-head">
        <h3 id="wa-title">WhatsApp Business</h3>
        <button type="button" className="btn ghost small" onClick={load} disabled={state.loading}>{state.loading ? "Checking…" : "Check again"}</button>
      </div>
      {state.missing && <p className="lk-muted">The WhatsApp status check needs the latest server update.</p>}
      {state.error && <p className="lk-warn-text">{state.error}</p>}
      {d && <>
        <p>
          <Badge tone={d.configured ? "good" : "warn"}>{d.configured ? "Connected" : "Not connected"}</Badge>{" "}
          {d.configured
            ? <>Sending from <b>{d.displayPhoneNumber || "the business number"}</b>{d.verifiedName ? ` (${d.verifiedName})` : ""}.{d.qualityRating ? ` Quality: ${d.qualityRating}.` : ""}</>
            : "WhatsApp Business (Meta Cloud API) isn't set up on the server yet. Until it is, WhatsApp messages can't be sent or received in the CRM."}
        </p>
        {d.configured && (
          <ul className="ic-facts">
            <li>Incoming messages: {d.webhookVerified ? <>arriving{d.lastInboundAt ? `, last one ${when(d.lastInboundAt)}` : ""}</> : <span className="lk-warn-text">not set up (the Meta webhook isn't pointing at the CRM)</span>}.</li>
            <li>Approved message templates: <b>{approved.length}</b>. WhatsApp only lets a business start a conversation with a template; free text works for 24 hours after the customer's last message.</li>
          </ul>
        )}
        {d.error && <p className="lk-warn-text">{d.configured === false ? d.error : `Meta said: ${d.error}`}</p>}
        {approved.length > 0 && (
          <details>
            <summary>Templates</summary>
            <table className="lk-table">
              <thead><tr><th>Name</th><th>Language</th><th>Type</th><th>Text</th></tr></thead>
              <tbody>{approved.map((t) => <tr key={`${t.name}-${t.language}`}><td>{t.name}</td><td>{t.language}</td><td>{t.category}</td><td>{t.body}</td></tr>)}</tbody>
            </table>
          </details>
        )}
      </>}
    </section>
  );
}

/** Read-only Gmail delivery check (report 27 Nov, F1). Admin only; GET calls to Gmail, no tokens returned.
 *  GET /integrations/google/gmail/diagnostics?ids=&days= → { account, sendAs[], messages[], bounces{items[]} } */
export function GmailDeliveryCheck() {
  const { request } = useAuth();
  const isAdmin = usePermissions().can("workspace.manage");
  const [ids, setIds] = useState("1a21a630a8093e65");
  const [days, setDays] = useState("7");
  const [state, setState] = useState({ busy: false, data: null, error: "" });
  const [copied, setCopied] = useState(false);
  if (!isAdmin) return null;

  async function run() {
    setState({ busy: true, data: null, error: "" }); setCopied(false);
    try {
      const r = await request("/integrations/google/gmail/diagnostics", { query: { ids: ids.replace(/\s+/g, ""), days } });
      setState({ busy: false, data: r.data || {}, error: "" });
    } catch (e) {
      setState({ busy: false, data: null, error: e.status === 404 ? "The Gmail check needs the latest server update." : e.message || "The check failed." });
    }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(JSON.stringify(state.data, null, 2)); setCopied(true); } catch { setCopied(false); }
  }

  const d = state.data;
  const bounces = d?.bounces?.items || [];
  return (
    <section className="panel rp-card fd-status" aria-labelledby="gd-title">
      <div className="rp-bd-head"><h3 id="gd-title">Gmail delivery check</h3></div>
      <p className="lk-muted">Looks up sent emails in the info@ mailbox and lists any bounces. Read only: nothing is sent or changed.</p>
      <div className="ic-actions">
        <label>Gmail message IDs (comma-separated)<input value={ids} onChange={(e) => setIds(e.target.value)} /></label>
        <label>Bounces from the last (days)<input type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} /></label>
        <button type="button" className="btn ghost small" onClick={run} disabled={state.busy}>{state.busy ? "Checking…" : "Check"}</button>
      </div>
      {state.error && <p className="lk-warn-text">{state.error}</p>}
      {d && <>
        <ul className="ic-facts">
          <li>Signed in as <b>{d.account?.signedIn || "?"}</b>, sending as <b>{d.account?.configuredFrom || "?"}</b>{(d.fromIsSignedInAccount ?? d.account?.fromIsSignedInAccount) ? " (same account)" : (d.fromIsVerifiedAlias ?? d.account?.fromIsVerifiedAlias) ? " (verified alias)" : <span className="lk-warn-text"> (not the signed-in account or a verified alias)</span>}.</li>
          {(d.messages || []).map((m) => <li key={m.id}>{m.id}: {m.error ? <span className="lk-warn-text">{m.error}</span> : <>{m.hasSentLabel ? "in Sent" : <span className="lk-warn-text">not in Sent</span>} · to {m.headers?.To || m.to || "?"} · {m.headers?.Subject || m.subject || ""}</>}</li>)}
          <li>Bounces: <b>{bounces.length}</b>{bounces.map((b, i) => <span key={i}><br />{b.date} · {b.subject} · {b.snippet}</span>)}</li>
        </ul>
        <button type="button" className="btn ghost small" onClick={copy}>{copied ? "Copied" : "Copy result"}</button>
      </>}
    </section>
  );
}
