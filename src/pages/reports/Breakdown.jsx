import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { DataState } from "../../components/ListKit";
import { formatMoney } from "../detail/DealDetail";
import { hkAddDays, toHkInput } from "../../utils/hkTime";

// GET /reports/breakdown?by=revenue|leadSource|enquiryType&period=week|month&from&to
// Hong Kong dates; weeks start Monday. The server returns every period and category (0 when
// empty), totals and a definition per category (used as column tooltips).

const VIEWS = [
  ["revenue", "Revenue by category", "Paid, live payments only (test payments never count)."],
  ["leadSource", "Where leads come from", "New contacts, grouped by how they found Banyan."],
  ["enquiryType", "Enquiries by type", "Website enquiries and walk-in forms, by service asked about."],
];
const RANGES = {
  week: [["8w", "Last 8 weeks", 8 * 7], ["13w", "Last 13 weeks", 13 * 7], ["26w", "Last 26 weeks", 26 * 7]],
  month: [["6m", "Last 6 months", 6], ["12m", "Last 12 months", 12], ["ytd", "This year", 0]],
};

const today = () => toHkInput(new Date(), "date");
// No data before Banyan started on the CRM (Reports.jsx REPORTS_START_YEAR).
const EARLIEST = "2026-01-01";
const clampFrom = (d) => (d < EARLIEST ? EARLIEST : d);
function rangeFor(period, key) {
  const to = today();
  if (period === "week") {
    const days = (RANGES.week.find(([k]) => k === key) || RANGES.week[0])[2];
    return { from: clampFrom(toHkInput(hkAddDays(new Date(), -days + 1), "date")), to };
  }
  const [y, m] = to.split("-").map(Number);
  if (key === "ytd") return { from: clampFrom(`${y}-01-01`), to };
  const months = (RANGES.month.find(([k]) => k === key) || RANGES.month[1])[2];
  const start = new Date(Date.UTC(y, m - 1 - (months - 1), 1));
  return { from: clampFrom(start.toISOString().slice(0, 10)), to };
}

export default function Breakdown() {
  const { request } = useAuth();
  const [by, setBy] = useState("enquiryType");
  const [period, setPeriod] = useState("month");
  const [preset, setPreset] = useState("6m");
  const [custom, setCustom] = useState(null);   // { from, to } when the dates are edited
  const [showEmpty, setShowEmpty] = useState(false);
  const [state, setState] = useState({ data: null, loading: true, error: "" });

  const range = custom || rangeFor(period, preset);
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await request("/reports/breakdown", { query: { by, period, from: range.from, to: range.to } });
      setState({ data: r.data, loading: false, error: "" });
    } catch (e) {
      setState({ data: null, loading: false, error: e.status === 404 ? "This report needs the latest backend update." : e.message || "Could not load the report." });
    }
  }, [request, by, period, range.from, range.to]);
  useEffect(() => { load(); }, [load]);

  const d = state.data;
  const money = (d?.unit || "").toUpperCase() === "HKD";
  const fmt = (v) => (money ? formatMoney(v || 0) : Number(v || 0).toLocaleString("en-HK"));
  const categories = useMemo(() => (d?.categories || []).filter((c) => showEmpty || (d.totals?.[c.key] || 0) !== 0), [d, showEmpty]);
  const grand = categories.reduce((s, c) => s + (d?.totals?.[c.key] || 0), 0);
  const rowTotal = (key) => categories.reduce((s, c) => s + (d?.rows?.[key]?.[c.key] || 0), 0);
  const help = (key) => {
    const def = d?.definitions?.[key];
    return Array.isArray(def) ? def.join(", ") : typeof def === "string" ? def : "";
  };
  const view = VIEWS.find(([k]) => k === by);

  function exportCsv() {
    if (!d) return;
    const head = [period === "week" ? "Week" : "Month", ...categories.map((c) => c.label), "Total"];
    const body = (d.periods || []).map((p) => [p.label, ...categories.map((c) => d.rows?.[p.key]?.[c.key] || 0), rowTotal(p.key)]);
    const foot = ["Total", ...categories.map((c) => d.totals?.[c.key] || 0), grand];
    const csv = [head, ...body, foot].map((line) => line.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `banyan-${by}-${period}-${range.from}-to-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="panel rp-card rp-breakdown" aria-labelledby="rp-breakdown-title">
      <div className="rp-bd-head">
        <h3 id="rp-breakdown-title">Breakdowns</h3>
        <button type="button" className="btn ghost" onClick={exportCsv} disabled={!d}>Export CSV</button>
      </div>
      <div className="av-seg rp-bd-views" role="tablist" aria-label="Report">
        {VIEWS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={by === k} className={by === k ? "active" : ""} onClick={() => setBy(k)}>{l}</button>)}
      </div>
      <p className="lk-muted">{view?.[2]}</p>
      <div className="rp-toolbar rp-bd-controls">
        <div className="av-seg" role="tablist" aria-label="Group by">
          {[["week", "Weekly"], ["month", "Monthly"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={period === k} className={period === k ? "active" : ""}
            onClick={() => { setPeriod(k); setPreset(k === "week" ? "8w" : "6m"); setCustom(null); }}>{l}</button>)}
        </div>
        <select aria-label="Range" value={custom ? "custom" : preset} onChange={(e) => { if (e.target.value !== "custom") { setPreset(e.target.value); setCustom(null); } else setCustom(range); }}>
          {RANGES[period].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          <option value="custom">Custom dates</option>
        </select>
        {custom && <>
          <label className="rb-daterange">From<input type="date" value={custom.from} min={EARLIEST} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: clampFrom(e.target.value) })} /></label>
          <label className="rb-daterange">To<input type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} /></label>
        </>}
        <label className="fm-inline"><input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> Show empty columns</label>
      </div>

      <div className="lk-table-wrap">
        <DataState loading={state.loading} error={state.error} onRetry={load} empty={Boolean(d) && categories.length === 0}
          emptyText={showEmpty ? "No categories." : "Nothing in this period. Tick “Show empty columns” to see every category."}>
          {d && (
            <table className="lk-table rp-table">
              <thead>
                <tr>
                  <th>{period === "week" ? "Week" : "Month"}</th>
                  {categories.map((c) => <th key={c.key} title={help(c.key)}>{c.label}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(d.periods || []).map((p) => (
                  <tr key={p.key}>
                    <td><b>{p.label}</b></td>
                    {categories.map((c) => { const v = d.rows?.[p.key]?.[c.key] || 0; return <td key={c.key} className={v ? "" : "lk-muted"}>{fmt(v)}</td>; })}
                    <td><b>{fmt(rowTotal(p.key))}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><b>Total</b></td>
                  {categories.map((c) => <td key={c.key}><b>{fmt(d.totals?.[c.key])}</b>{grand > 0 && <small className="rp-share">{Math.round(((d.totals?.[c.key] || 0) / grand) * 100)}%</small>}</td>)}
                  <td><b>{fmt(grand)}</b></td>
                </tr>
              </tfoot>
            </table>
          )}
        </DataState>
      </div>
      {by === "leadSource" && d?.mapping && Object.keys(d.mapping).length > 0 && (
        <details className="rp-mapping">
          <summary>How sources are grouped</summary>
          <ul>{Object.entries(d.mapping).map(([raw, key]) => <li key={raw}><code>{raw}</code> → {(d.categories || []).find((c) => c.key === key)?.label || key}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
