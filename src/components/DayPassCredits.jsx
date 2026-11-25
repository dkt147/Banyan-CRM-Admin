import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { recordHref } from "../utils/recordLinks";
import { personLabel } from "../utils/useLookups";
import { Card } from "./DetailLayout";
import { SearchBox, DataState } from "./ListKit";

// Day pass packages (client meeting 25 Nov). Members without an agreement buy e.g. 10 days
// up front and use a half day (0.5) or a full day (1) per visit. Replaces the front desk's
// spreadsheet. Balance is per contact, in days, in half-day steps.
//   GET  /contacts/:id/day-passes                 → { balance, lowThreshold, entries[], lastBalanceEmailAt, autoEmail }
//   POST /contacts/:id/day-passes/purchase        { days, amount?, note? }
//   POST /contacts/:id/day-passes/redeem          { days: 0.5 | 1, date?, note? }   409 when not enough left
//   POST /contacts/:id/day-passes/adjust          { days (±, half steps), note }   (credits.adjust)
//   POST /contacts/:id/day-passes/email-balance   → { sentAt }
//   GET  /day-passes?search=&low=true             → contacts with a package and their balance

export const fmtDays = (n) => {
  const v = Math.round(Number(n || 0) * 2) / 2;
  return `${v.toLocaleString("en-HK", { maximumFractionDigits: 1 })} day${Math.abs(v) === 1 ? "" : "s"}`;
};
const signed = (n) => `${Number(n) < 0 ? "−" : "+"}${fmtDays(Math.abs(n))}`;
// "2026-11-24" → "24 Nov 2026" (a calendar date, so no time zone shift).
const visitDay = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : String(s);
};
const when = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" }) : "—");
const TYPE_LABEL = { purchase: "Package bought", redeem: "Used", adjust: "Adjusted", refund: "Returned" };
const halfStep = (n) => Number.isFinite(n) && Math.round(n * 2) === n * 2;
// Redeem response: lowBalanceEmail { status: sent | skipped | failed | not_needed, reason }.
function lowEmailText(data) {
  const e = data?.lowBalanceEmail;
  if (data?.lowBalanceEmailSent || e?.status === "sent") return " A low-balance email was sent to the member.";
  if (e?.status === "failed") return ` The low-balance email couldn't be sent${e.reason ? ` (${e.reason})` : ""}.`;
  if (e?.status === "skipped" && e.reason && !/already sent today/i.test(e.reason)) return ` No low-balance email: ${e.reason}`;
  return "";
}

export function DayPassCard({ contact }) {
  const { request } = useAuth();
  const perms = usePermissions();
  const canWrite = perms.can("records.write");
  const canAdjust = perms.can("credits.adjust");
  const [state, setState] = useState({ data: null, loading: true, error: "", missing: false });
  const [action, setAction] = useState(null);   // { kind: "redeem"|"purchase"|"adjust", ... }
  const [notice, setNotice] = useState("");
  const [emailing, setEmailing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await request(`/contacts/${contact._id}/day-passes`);
      setState({ data: r.data, loading: false, error: "", missing: false });
    } catch (e) {
      setState({ data: null, loading: false, error: e.status === 404 ? "" : e.message || "Could not load day passes.", missing: e.status === 404 });
    }
  }, [contact._id, request]);
  useEffect(() => { load(); }, [load]);

  const d = state.data;
  const balance = Number(d?.balance || 0);
  const low = d && balance <= Number(d.lowThreshold ?? 5);
  const hasHistory = (d?.entries || []).length > 0;

  async function submit(e) {
    e.preventDefault();
    const a = action;
    const days = Number(a.days);
    if (a.kind === "purchase" && (!halfStep(days) || days <= 0 || days > 100)) { setAction({ ...a, error: "Days must be more than 0, in half-day steps (e.g. 10)." }); return; }
    if (a.kind === "adjust" && (!halfStep(days) || !days || Math.abs(days) > 100)) { setAction({ ...a, error: "Days must be non-zero, in half-day steps (e.g. 1 or -0.5)." }); return; }
    if (a.kind === "adjust" && !a.note.trim()) { setAction({ ...a, error: "Add a note saying why." }); return; }
    if (a.kind === "redeem" && days > balance) { setAction({ ...a, error: `Only ${fmtDays(balance)} left. Add a package first, or charge a normal day pass.` }); return; }
    const amount = a.amount === "" || a.amount == null ? undefined : Number(a.amount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) { setAction({ ...a, error: "Price must be 0 or more." }); return; }
    setAction({ ...a, busy: true, error: "" });
    try {
      const body = { days, note: a.note?.trim() || undefined };
      if (a.kind === "purchase" && amount !== undefined) body.amount = amount;
      if (a.kind === "redeem" && a.date) body.date = a.date;
      const r = await request(`/contacts/${contact._id}/day-passes/${a.kind}`, { method: "POST", body });
      setAction(null);
      const left = r.data?.balance;
      setNotice(a.kind === "redeem"
        ? `${fmtDays(days)} used.${left != null ? ` ${fmtDays(left)} left.` : ""}${lowEmailText(r.data)}`
        : a.kind === "purchase" ? `${fmtDays(days)} added.` : "Balance adjusted.");
      await load();
    } catch (err) { setAction((x) => ({ ...x, busy: false, error: err.message || "Could not save." })); }
  }

  async function emailBalance() {
    if (!window.confirm(`Email ${contact.email} their day pass balance (${fmtDays(balance)})?`)) return;
    setEmailing(true); setNotice("");
    try {
      await request(`/contacts/${contact._id}/day-passes/email-balance`, { method: "POST", body: {} });
      setNotice(`Balance emailed to ${contact.email}.`);
      await load();
    } catch (e) { setNotice(e.message || "The email could not be sent."); }
    finally { setEmailing(false); }
  }

  if (state.missing) return (
    <Card title="Day pass credits"><p className="rr-empty">Day pass packages need the latest server update.</p></Card>
  );

  return (
    <Card title="Day pass credits">
      {state.error && <p className="lk-warn-text">{state.error}</p>}
      {d && <>
        <div className="dp-balance">
          <span className={`dp-balance-num${balance <= 0 ? " is-empty" : low ? " is-low" : ""}`}>{fmtDays(balance)}</span>
          <span className="lk-muted">left{low && hasHistory ? (balance <= 0 ? " · none left" : " · running low") : ""}</span>
        </div>
        {!hasHistory && <p className="lk-muted">No day pass package yet. When this member buys one (e.g. 10 days), click “Add package”. Each visit then uses a half day or a full day.</p>}

        {canWrite && !action && <div className="dp-actions">
          <button type="button" className="btn primary" disabled={balance < 0.5} onClick={() => setAction({ kind: "redeem", days: 0.5, date: "", note: "" })}>Use half day</button>
          <button type="button" className="btn primary" disabled={balance < 1} onClick={() => setAction({ kind: "redeem", days: 1, date: "", note: "" })}>Use full day</button>
          <button type="button" className="btn ghost" onClick={() => setAction({ kind: "purchase", days: "10", amount: "", note: "" })}>Add package</button>
          <button type="button" className="btn ghost" disabled={emailing || !contact.email || !hasHistory} title={!contact.email ? "This contact has no email address" : ""} onClick={emailBalance}>{emailing ? "Sending…" : "Email balance"}</button>
          {canAdjust && <button type="button" className="btn ghost" onClick={() => setAction({ kind: "adjust", days: "", note: "" })}>Adjust</button>}
        </div>}

        {action && (
          <form className="dp-form" onSubmit={submit}>
            {action.kind === "redeem" && <>
              <p><b>Use {fmtDays(action.days)}</b> for {personLabel(contact)}. {fmtDays(balance)} → {fmtDays(balance - action.days)}.</p>
              <label>Visit date (leave empty for today)<input type="date" value={action.date} disabled={action.busy} onChange={(e) => setAction({ ...action, date: e.target.value })} /></label>
            </>}
            {action.kind === "purchase" && <>
              <label>Days in the package<input type="number" min={0.5} step={0.5} value={action.days} disabled={action.busy} onChange={(e) => setAction({ ...action, days: e.target.value })} /></label>
              <label>Price paid (HK$, optional)<input type="number" min={0} step={10} value={action.amount} disabled={action.busy} onChange={(e) => setAction({ ...action, amount: e.target.value })} /></label>
            </>}
            {action.kind === "adjust" && <label>Days (+ to add, − to remove)<input type="number" step={0.5} value={action.days} disabled={action.busy} onChange={(e) => setAction({ ...action, days: e.target.value })} /></label>}
            <label className="dp-note">Note{action.kind === "adjust" ? "" : " (optional)"}<input value={action.note} maxLength={300} disabled={action.busy}
              placeholder={action.kind === "redeem" ? "e.g. Morning only" : action.kind === "purchase" ? "e.g. Paid by FPS, receipt 1234" : "e.g. Correcting a double entry"}
              onChange={(e) => setAction({ ...action, note: e.target.value })} /></label>
            <div className="next-task-actions">
              <button type="submit" className="btn primary" disabled={action.busy}>{action.busy ? "Saving…" : action.kind === "redeem" ? `Use ${fmtDays(action.days)}` : action.kind === "purchase" ? "Add package" : "Save adjustment"}</button>
              <button type="button" className="btn ghost" disabled={action.busy} onClick={() => setAction(null)}>Cancel</button>
            </div>
            {action.error && <p className="lk-warn-text">{action.error}</p>}
          </form>
        )}
        {notice && <p className="dp-notice" role="status">{notice}</p>}

        <p className="lk-muted dp-meta">
          {d.autoEmail !== false && <>An email goes to the member automatically when {fmtDays(d.lowThreshold ?? 5)} or fewer are left. </>}
          {d.lastBalanceEmailAt ? `Last balance email: ${when(d.lastBalanceEmailAt)}.` : ""}
        </p>

        {hasHistory && (
          <details className="dp-history" open={(d.entries || []).length <= 6}>
            <summary>History ({d.entries.length})</summary>
            <table className="lk-table cc-entries">
              <thead><tr><th>Date</th><th>What</th><th>Days</th><th>By</th></tr></thead>
              <tbody>
                {d.entries.map((x) => (
                  <tr key={x.id || x._id || `${x.at}-${x.type}`}>
                    <td className="rb-nowrap">{when(x.at)}</td>
                    <td>{TYPE_LABEL[x.type] || x.type}{x.date ? ` · visit ${visitDay(x.date)}` : ""}{x.amount ? ` · HK$${Number(x.amount).toLocaleString("en-HK")}` : ""}{x.note ? <small className="dl-sub">{x.note}</small> : null}</td>
                    <td className="rb-nowrap">{signed(x.days)}</td>
                    <td>{x.by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </>}
    </Card>
  );
}

/** Everyone with a day pass package and what they have left (Check-ins page). */
export function DayPassBalances() {
  const { request } = useAuth();
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [state, setState] = useState({ items: [], loading: true, error: "", missing: false });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await request("/day-passes", { query: { search: search || undefined, low: lowOnly || undefined, limit: 100 } });
      setState({ items: r.data?.items || r.data || [], loading: false, error: "", missing: false });
    } catch (e) { setState({ items: [], loading: false, error: e.status === 404 ? "" : e.message, missing: e.status === 404 }); }
  }, [request, search, lowOnly]);
  useEffect(() => { load(); }, [load]);
  if (state.missing) return null;
  return (
    <section className="panel dp-list">
      <div className="dp-list-head">
        <h3>Day pass balances</h3>
        <SearchBox value={search} onChange={setSearch} placeholder="Search member" />
        <label className="fm-inline"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> 5 days or fewer</label>
      </div>
      <p className="lk-muted">Open a member to use a half or full day, add a package or email their balance.</p>
      <div className="lk-table-wrap">
        <DataState loading={state.loading} error={state.error} onRetry={load} empty={state.items.length === 0}
          emptyText={search || lowOnly ? "Nobody matches." : "No day pass packages yet. Add one from a contact's page."}>
          <table className="lk-table">
            <thead><tr><th>Member</th><th>Left</th><th>Last visit</th><th>Last balance email</th></tr></thead>
            <tbody>
              {state.items.map((x) => {
                const c = x.contact || {};
                const lowRow = Number(x.balance) <= Number(x.lowThreshold ?? 5);
                return (
                  <tr key={c._id || c.id}>
                    <td><Link to={recordHref.contact(c._id || c.id)}><b>{personLabel(c)}</b></Link>{c.email && <small>{c.email}</small>}</td>
                    <td className={lowRow ? "dp-low-cell" : ""}><b>{fmtDays(x.balance)}</b></td>
                    <td className="rb-nowrap">{x.lastUsedAt ? when(x.lastUsedAt) : "—"}</td>
                    <td className="rb-nowrap">{x.lastBalanceEmailAt ? when(x.lastBalanceEmailAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
      </div>
    </section>
  );
}
