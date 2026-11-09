import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "./Dashboard";
import { DataState } from "../components/ListKit";
import { useAuth } from "../auth/AuthContext";
import { formatMoney } from "./detail/DealDetail";

// Reports from the existing dashboard APIs: open pipeline value by stage and paid
// revenue by month. The widget-based dashboard (brief 6.7, C4) remains on Dashboard.
export default function Reports() {
  const { request } = useAuth();
  const [state, setState] = useState({ pipeline: [], revenue: [], loading: true, error: "" });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const [p, r] = await Promise.all([request("/dashboard/pipeline"), request("/dashboard/revenue")]);
      setState({ pipeline: p.data || [], revenue: r.data || [], loading: false, error: "" });
    } catch (e) { setState({ pipeline: [], revenue: [], loading: false, error: e.message || "Could not load reports." }); }
  }, [request]);
  useEffect(() => { load(); }, [load]);

  const maxValue = Math.max(1, ...state.pipeline.map((r) => r.value || 0));
  const maxRevenue = Math.max(1, ...state.revenue.map((r) => r.revenue || 0));
  const totalPipeline = state.pipeline.reduce((sum, r) => sum + (r.value || 0), 0);

  return (
    <Page title="Reports" kicker="Pipeline and revenue" actions={<Link className="btn ghost" to="/dashboard">Open dashboard</Link>}>
      <div className="rp-grid">
        <section className="panel rp-card">
          <h3>Open pipeline by stage</h3>
          <p className="lk-muted">{formatMoney(totalPipeline)} across {state.pipeline.reduce((s, r) => s + (r.count || 0), 0)} open deals</p>
          <DataState loading={state.loading} error={state.error} onRetry={load} empty={state.pipeline.length === 0} emptyText="No open deals.">
            <table className="lk-table rp-table">
              <thead><tr><th>Stage</th><th>Deals</th><th>Value</th><th aria-hidden="true" /></tr></thead>
              <tbody>
                {state.pipeline.map((row) => (
                  <tr key={row.stageId}>
                    <td>{row.name}</td><td>{row.count}</td><td>{formatMoney(row.value)}</td>
                    <td className="rp-bar-cell"><span className="rp-bar" style={{ width: `${(row.value / maxValue) * 100}%` }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </section>
        <section className="panel rp-card">
          <h3>Paid revenue by month</h3>
          <p className="lk-muted">From paid invoices</p>
          <DataState loading={state.loading} error={state.error} onRetry={load} empty={state.revenue.length === 0} emptyText="No paid invoices yet.">
            <table className="lk-table rp-table">
              <thead><tr><th>Month</th><th>Revenue</th><th aria-hidden="true" /></tr></thead>
              <tbody>
                {state.revenue.map((row) => (
                  <tr key={row._id}>
                    <td>{row._id || "No date"}</td><td>{formatMoney(row.revenue)}</td>
                    <td className="rp-bar-cell"><span className="rp-bar" style={{ width: `${(row.revenue / maxRevenue) * 100}%` }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </section>
      </div>
    </Page>
  );
}
