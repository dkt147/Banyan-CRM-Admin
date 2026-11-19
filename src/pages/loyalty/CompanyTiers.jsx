import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { DataState, Pager, SearchBox } from "../../components/ListKit";
import { recordHref } from "../../utils/recordLinks";
import { formatMoney } from "../detail/DealDetail";

// Company loyalty tiers by spend over the last 12 months (GET /loyalty/companies).
// Tiers and thresholds are edited in the tier list below (existing tier CRUD).

const PAGE_SIZE = 25;

export default function CompanyTiers() {
  const { request } = useAuth();
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ items: [], tiers: [], pages: 1, total: 0, loading: true, error: "" });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await request("/loyalty/companies", { query: { search, tier, page, limit: PAGE_SIZE } });
      const d = r.data || {};
      setState({ items: d.items || [], tiers: d.tiers || [], pages: d.pagination?.pages || d.pagination?.totalPages || 1, total: d.pagination?.total || 0, loading: false, error: "" });
    } catch (e) {
      setState((s) => ({ ...s, items: [], loading: false, error: e.status === 404 ? "Company tiers need the latest backend update." : e.message || "Could not load company tiers." }));
    }
  }, [request, search, tier, page]);
  useEffect(() => { load(); }, [load]);

  const count = (id) => state.items.filter((x) => (x.tier?.id || x.tier?._id) === id).length;
  return (
    <section className="panel rp-card lt-companies" aria-labelledby="lt-companies-title">
      <h3 id="lt-companies-title">Company tiers</h3>
      <p className="lk-muted">Based on each company's spend in the last 12 months: paid room bookings, day passes and invoices (live payments only). Higher tiers get perks like priority booking.</p>
      {state.tiers.length > 0 && (
        <div className="lt-tiers">
          {state.tiers.map((t) => (
            <button key={t.id || t._id} type="button" className={`lt-tier${tier === (t.id || t._id) ? " active" : ""}`} onClick={() => { setTier(tier === (t.id || t._id) ? "" : (t.id || t._id)); setPage(1); }}>
              <b>{t.name}</b>
              <span>from {formatMoney(t.minSpend)}</span>
              {(t.benefits || []).length > 0 && <small>{t.benefits.join(" · ")}</small>}
              {!tier && <em>{count(t.id || t._id)} on this page</em>}
            </button>
          ))}
        </div>
      )}
      <div className="lk-toolbar"><SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search companies" /></div>
      <div className="lk-table-wrap">
        <DataState loading={state.loading} error={state.error} onRetry={load} empty={state.items.length === 0} emptyText="No companies match.">
          <table className="lk-table">
            <thead><tr><th>Company</th><th>Spend, last 12 months</th><th>Tier</th><th>Next tier</th></tr></thead>
            <tbody>
              {state.items.map((x) => (
                <tr key={x.company?.id || x.company?._id}>
                  <td><Link to={recordHref.company(x.company?.id || x.company?._id)}>{x.company?.name}</Link></td>
                  <td>{formatMoney(x.spend12m)}</td>
                  <td><b>{x.tier?.name || "—"}</b></td>
                  <td>{x.nextTier ? `${formatMoney(x.toNextTier)} to ${x.nextTier.name}` : <span className="lk-muted">Top tier</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
      <Pager page={page} pages={state.pages} total={state.total} onPage={setPage} loading={state.loading} />
    </section>
  );
}
