import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "./Dashboard";
import { DataState } from "../components/ListKit";
import { useAuth } from "../auth/AuthContext";
import { formatMoney } from "./detail/DealDetail";
import Breakdown from "./reports/Breakdown";

// Monthly and yearly reports from GET /reports/periodic (all records, Hong Kong months).
// The server returns every month in from..to (zeros where empty) plus a one-sentence
// definition per metric, used as the column tooltips.

const METRICS = [
  ["revenue", "Invoice revenue", "money", "Paid invoices, by date paid"],
  ["roomRevenue", "Room booking revenue", "money", "Paid WordPress room bookings (live payments only)"],
  ["roomHours", "Room hours booked", "number", "Paid meeting room and Library hours"],
  ["bookings", "Bookings", "number", "All CRM bookings that start in the period (not cancelled)"],
  ["dayPasses", "Day passes sold", "number", "Won day pass and day pass package deals"],
  ["newContacts", "New contacts", "number", "Contacts created"],
  ["newDeals", "New deals", "number", "Deals created"],
  ["dealsWon", "Deals won", "number", "Deals marked won"],
  ["dealsWonValue", "Value won", "money", "Total value of deals won"],
  ["dealsLost", "Deals lost", "number", "Deals marked lost"],
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (kind, v) => (kind === "money" ? formatMoney(v || 0) : Number(v || 0).toLocaleString("en-HK"));

// Banyan started using the CRM in 2026: reports never go further back (client, 25 Nov).
export const REPORTS_START_YEAR = 2026;

export default function Reports() {
  const { request } = useAuth();
  const thisYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric" }).format(new Date()));
  const [period, setPeriod] = useState("month");
  const [year, setYear] = useState(thisYear);
  const [state, setState] = useState({ months: {}, definitions: {}, loading: true, error: "" });
  const [pipeline, setPipeline] = useState([]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    request("/dashboard/pipeline").then((p) => setPipeline(p.data || [])).catch(() => setPipeline([]));
    try {
      // 5 years of months (max 120 months per request). Yearly totals are summed here from the months.
      const r = await request("/reports/periodic", { query: { period: "month", from: `${Math.max(thisYear - 4, REPORTS_START_YEAR)}-01`, to: `${thisYear}-12` } });
      const months = Object.fromEntries((r.data?.periods || []).map((p) => [p.key, p]));
      setState({ months, definitions: r.data?.definitions || {}, loading: false, error: "" });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.status === 400 ? `Invalid report range: ${e.message}` : e.message || "Could not load reports." }));
    }
  }, [request, thisYear]);
  useEffect(() => { load(); }, [load]);

  const years = useMemo(() => {
    const ys = new Set([thisYear, ...Object.keys(state.months).map((k) => Number(k.slice(0, 4)))]);
    return [...ys].filter((y) => y && y >= REPORTS_START_YEAR).sort((a, b) => b - a);
  }, [state.months, thisYear]);

  const rows = useMemo(() => {
    if (period === "month") {
      return MONTHS.map((label, i) => ({ key: `${year}-${String(i + 1).padStart(2, "0")}`, label: `${label} ${year}`, ...(state.months[`${year}-${String(i + 1).padStart(2, "0")}`] || {}) }));
    }
    return years.slice().sort((a, b) => a - b).map((y) => {
      const sum = { key: String(y), label: String(y) };
      Object.entries(state.months).forEach(([k, m]) => {
        if (!k.startsWith(`${y}-`)) return;
        METRICS.forEach(([id]) => { sum[id] = (sum[id] || 0) + (m[id] || 0); });
      });
      return sum;
    });
  }, [period, year, years, state.months]);

  const totals = useMemo(() => Object.fromEntries(METRICS.map(([id]) => [id, rows.reduce((s, r) => s + (r[id] || 0), 0)])), [rows]);
  const maxRevenue = Math.max(1, ...rows.map((r) => (r.revenue || 0) + (r.roomRevenue || 0)));

  function exportCsv() {
    const head = ["Period", ...METRICS.map(([, l]) => l)];
    const body = rows.map((r) => [r.label, ...METRICS.map(([id]) => r[id] || 0)]);
    const csv = [head, ...body].map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `banyan-report-${period === "month" ? year : "yearly"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const help = (id, fallback) => state.definitions[id] || fallback;
  const totalPipeline = pipeline.reduce((sum, r) => sum + (r.value || 0), 0);
  return (
    <Page title="Reports" kicker={period === "month" ? `Monthly · ${year}` : "Yearly"}
      actions={<><button type="button" className="btn ghost" onClick={exportCsv} disabled={state.loading}>Export CSV</button><Link className="btn ghost" to="/dashboard">Open dashboard</Link></>}>
      <section className="rp-toolbar">
        <div className="av-seg" role="tablist" aria-label="Period">
          {[["month", "Monthly"], ["year", "Yearly"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={period === k} className={period === k ? "active" : ""} onClick={() => setPeriod(k)}>{l}</button>)}
        </div>
        {period === "month" && <select aria-label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>}
      </section>

      <div className="rp-tiles">
        {METRICS.filter(([id]) => ["revenue", "roomRevenue", "newContacts", "dealsWon", "dealsWonValue", "dayPasses"].includes(id)).map(([id, label, kind, desc]) => (
          <div key={id} className="panel rp-tile" title={help(id, desc)}><span>{label}</span><b>{fmt(kind, totals[id])}</b><small>{period === "month" ? year : "All years"}</small></div>
        ))}
      </div>

      <Breakdown />

      <h3 className="rp-section-title">Monthly and yearly totals</h3>
      <section className="panel lk-table-wrap">
        <DataState loading={state.loading} error={state.error} onRetry={load} empty={false}>
          <table className="lk-table rp-table rp-periodic">
            <thead>
              <tr><th>{period === "month" ? "Month" : "Year"}</th>{METRICS.map(([id, label, , desc]) => <th key={id} title={help(id, desc)}>{label}</th>)}<th aria-label="Revenue bar" /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td><b>{r.label}</b></td>
                  {METRICS.map(([id, , kind]) => <td key={id} className={r[id] ? "" : "lk-muted"}>{fmt(kind, r[id])}</td>)}
                  <td className="rp-bar-cell"><span className="rp-bar" style={{ width: `${(((r.revenue || 0) + (r.roomRevenue || 0)) / maxRevenue) * 100}%` }} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td><b>Total</b></td>{METRICS.map(([id, , kind]) => <td key={id}><b>{fmt(kind, totals[id])}</b></td>)}<td /></tr>
            </tfoot>
          </table>
        </DataState>
      </section>

      <section className="panel rp-card">
        <h3>Open pipeline by stage</h3>
        <p className="lk-muted">{formatMoney(totalPipeline)} across {pipeline.reduce((s, r) => s + (r.count || 0), 0)} open deals (right now)</p>
        <table className="lk-table rp-table">
          <thead><tr><th>Stage</th><th>Deals</th><th>Value</th></tr></thead>
          <tbody>{pipeline.map((row) => <tr key={row.stageId}><td>{row.name}</td><td>{row.count}</td><td>{formatMoney(row.value)}</td></tr>)}</tbody>
        </table>
      </section>
    </Page>
  );
}
