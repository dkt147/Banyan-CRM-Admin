import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { formatMoney } from "../pages/detail/DealDetail";
import { Card } from "./DetailLayout";

// Meeting room credits (per company, per Hong Kong month; 1 credit = 1 hour) and the
// company's loyalty tier (spend over the last 12 months).
//   GET  /companies/:id/credits?month=YYYY-MM
//   POST /companies/:id/credits/adjust { hours, note, month }   (credits.adjust)
//   PATCH /companies/:id { meetingRoomCreditHours }             (records.write)
//   GET  /companies/:id/loyalty

const hkMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
const monthLabel = (m) => { const [y, mo] = String(m).split("-").map(Number); return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); };
const hours = (h) => `${Number(h || 0).toLocaleString("en-HK", { maximumFractionDigits: 1 })} h`;
const TYPE_LABEL = { use: "Booked", refund: "Returned", adjust: "Adjusted" };
const shiftMonth = (m, by) => { const [y, mo] = String(m).split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + by, 1)); return d.toISOString().slice(0, 7); };
// use: always taken; refund: always given back; adjust: the stored sign (-1 for an undo).
function entryHours(x) {
  const n = Math.abs(Number(x.hours) || 0);
  if (x.type === "use") return `−${hours(n)}`;
  if (x.type === "refund") return `+${hours(n)} returned`;
  return `${Number(x.hours) < 0 ? "−" : "+"}${hours(n)}`;
}

export function CreditsCard({ companyId, allowance: initialAllowance, onAllowanceSaved }) {
  const { request } = useAuth();
  const perms = usePermissions();
  const canEditAllowance = perms.can("records.write");
  const canAdjust = perms.can("credits.adjust");
  const [month, setMonth] = useState(hkMonth());
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [editAllowance, setEditAllowance] = useState(null);   // string while editing
  const [adjust, setAdjust] = useState(null);                  // { hours, note, busy, error }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const autoJumped = useRef(false);   // open once on the month of the next credit booking

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = (await request(`/companies/${companyId}/credits`, { query: { month } })).data;
      setState({ data, loading: false, error: "" });
      // nextBookingMonth (backend, when sent): month of the company’s next upcoming credit booking.
      if (!autoJumped.current) {
        autoJumped.current = true;
        const next = data?.nextBookingMonth;
        if (next && next !== month && !(data.entries || []).length) setMonth(next);
      }
    }
    catch (e) { setState({ data: null, loading: false, error: e.status === 404 ? "" : e.message || "Could not load credits." }); }
  }, [companyId, month, request]);
  useEffect(() => { load(); }, [load]);

  async function saveAllowance() {
    const n = Number(editAllowance);
    if (!Number.isInteger(n) || n < 0 || n > 200) { setSaveError("Enter whole hours from 0 to 200."); return; }
    setSaving(true); setSaveError("");
    try {
      const r = await request(`/companies/${companyId}`, { method: "PATCH", body: { meetingRoomCreditHours: n } });
      setEditAllowance(null); onAllowanceSaved?.(r.data); await load();
    } catch (e) { setSaveError(e.message); }
    finally { setSaving(false); }
  }
  async function submitAdjust(e) {
    e.preventDefault();
    const h = Number(adjust.hours);
    if (!h || Math.abs(h) > 500 || Math.round(h * 2) !== h * 2) { setAdjust({ ...adjust, error: "Hours must be non-zero, in half-hour steps (e.g. 2 or -1.5)." }); return; }
    if (!adjust.note.trim()) { setAdjust({ ...adjust, error: "Add a note saying why." }); return; }
    setAdjust({ ...adjust, busy: true, error: "" });
    try {
      await request(`/companies/${companyId}/credits/adjust`, { method: "POST", body: { hours: h, note: adjust.note.trim(), month } });
      setAdjust(null); await load();
    } catch (err) { setAdjust((a) => ({ ...a, busy: false, error: err.message })); }
  }

  const d = state.data;
  const allowance = d?.allowance ?? initialAllowance ?? 0;
  const total = allowance + (d?.adjustments || 0);
  const pct = total > 0 ? Math.min(100, ((d?.used || 0) / total) * 100) : 0;

  return (
    <Card title="Meeting room credits">
      <div className="cc-head">
        <div className="cc-month">
          <button type="button" className="btn ghost small" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>‹</button>
          <label>Month<input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
          <button type="button" className="btn ghost small" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>›</button>
          {month !== hkMonth() && <button type="button" className="av-link" onClick={() => setMonth(hkMonth())}>This month</button>}
        </div>
        <p className="lk-muted">1 credit = 1 hour. Anyone at the company can use them. Credits count in the month of the booking, not when it was made. Unused credits don't carry over.</p>
      </div>
      {state.error && <p className="lk-warn-text">{state.error}</p>}

      <div className="cc-allowance">
        <span>Monthly allowance</span>
        {editAllowance === null ? (
          <b>{hours(allowance)}{canEditAllowance && <button type="button" className="av-link" onClick={() => setEditAllowance(String(allowance))}>Change</button>}</b>
        ) : (
          <span className="cc-edit">
            <input type="number" min={0} max={200} step={1} value={editAllowance} disabled={saving} onChange={(e) => setEditAllowance(e.target.value)} aria-label="Monthly allowance in hours" /> h
            <button type="button" className="btn primary small" onClick={saveAllowance} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" className="btn ghost small" onClick={() => { setEditAllowance(null); setSaveError(""); }} disabled={saving}>Cancel</button>
          </span>
        )}
      </div>
      {saveError && <p className="lk-warn-text">{saveError}</p>}

      {d && (allowance > 0 || (d.entries || []).length > 0) ? <>
        <div className="cc-meter" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={d.used || 0} aria-label={`Credits used in ${monthLabel(month)}`}>
          <span className={pct >= 90 ? "warn" : ""} style={{ width: `${pct}%` }} />
        </div>
        <dl className="cc-stats">
          <div><dt>Used</dt><dd>{hours(d.used)}</dd></div>
          <div><dt>Remaining</dt><dd className={d.remaining <= 0 ? "cc-none" : ""}>{hours(d.remaining)}</dd></div>
          {d.adjustments ? <div><dt>Adjustments</dt><dd>{d.adjustments > 0 ? "+" : ""}{hours(d.adjustments)}</dd></div> : null}
        </dl>
        {(d.entries || []).length > 0 ? (
          <table className="lk-table cc-entries">
            <thead><tr><th>Date</th><th>What</th><th>Hours</th><th>By</th></tr></thead>
            <tbody>
              {d.entries.map((x) => (
                <tr key={x.id || `${x.at}-${x.bookingRef}`}>
                  <td>{new Date(x.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{TYPE_LABEL[x.type] || x.type}{x.bookingRef ? ` · ${x.bookingRef}` : ""}{x.room ? ` · ${x.room}` : ""}{x.note ? <small className="dl-sub">{x.note}</small> : null}</td>
                  <td className="rb-nowrap">{entryHours(x)}</td>
                  <td>{x.by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="rr-empty">No credits used in {monthLabel(month)}.</p>}
      </> : !state.loading && <p className="rr-empty">No allowance set. {canEditAllowance ? "Click “Change” to give this company monthly meeting room hours." : ""}</p>}

      {canAdjust && (adjust ? (
        <form className="cc-adjust" onSubmit={submitAdjust}>
          <label>Hours (+ to add, − to remove)<input type="number" step={0.5} value={adjust.hours} disabled={adjust.busy} onChange={(e) => setAdjust({ ...adjust, hours: e.target.value })} /></label>
          <label className="cc-adjust-note">Note<input value={adjust.note} disabled={adjust.busy} placeholder="e.g. Goodwill top-up for the projector issue" onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} /></label>
          <div className="next-task-actions">
            <button type="submit" className="btn primary" disabled={adjust.busy}>{adjust.busy ? "Saving…" : `Adjust ${monthLabel(month)}`}</button>
            <button type="button" className="btn ghost" disabled={adjust.busy} onClick={() => setAdjust(null)}>Cancel</button>
          </div>
          {adjust.error && <p className="lk-warn-text">{adjust.error}</p>}
        </form>
      ) : <button type="button" className="btn ghost" onClick={() => setAdjust({ hours: "", note: "", busy: false, error: "" })}>Adjust credits</button>)}
    </Card>
  );
}

export function LoyaltyCard({ companyId }) {
  const { request } = useAuth();
  const [state, setState] = useState({ data: null, error: "" });
  useEffect(() => {
    request(`/companies/${companyId}/loyalty`)
      .then((r) => setState({ data: r.data, error: "" }))
      .catch((e) => setState({ data: null, error: e.status === 404 ? "" : e.message }));
  }, [companyId, request]);
  const d = state.data;
  if (!d && !state.error) return null;
  const max = Math.max(1, ...((d?.monthly || []).map((m) => m.spend || 0)));
  return (
    <Card title="Loyalty">
      {state.error ? <p className="lk-warn-text">{state.error}</p> : <>
        <div className="cc-tier">
          <span className="cc-tier-name">{d.tier?.name || "No tier"}</span>
          <span><b>{formatMoney(d.spend12m)}</b> spent in the last 12 months</span>
        </div>
        {d.nextTier && <p className="lk-muted">{formatMoney(d.toNextTier)} more to reach {d.nextTier.name} (from {formatMoney(d.nextTier.minSpend)}).</p>}
        {(d.tier?.benefits || []).length > 0 && <ul className="cc-benefits">{d.tier.benefits.map((b) => <li key={b}>{b}</li>)}</ul>}
        {(d.monthly || []).length > 0 && (
          <div className="cc-spark" aria-label="Spend per month, last 12 months">
            {d.monthly.map((m) => <span key={m.month} title={`${monthLabel(m.month)}: ${formatMoney(m.spend)}`} style={{ height: `${Math.max(2, ((m.spend || 0) / max) * 100)}%` }} />)}
          </div>
        )}
        <p className="lk-muted">Counts paid room bookings, day passes and invoices (live payments only).</p>
      </>}
    </Card>
  );
}
