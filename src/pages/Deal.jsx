import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Page } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { BulkBar, CheckCell, DataState, FilterChips, Pager, SavedViews, SearchBox, runBulk, useSelection } from "../components/ListKit";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { recordHref } from "../utils/recordLinks";
import { invalidateLookups, personLabel, useLookups } from "../utils/useLookups";
import { formatMoney } from "./detail/DealDetail";

const PAGE_SIZE = 25;
const DEFAULT_VIEW = { search: "", status: "", pipelineId: "", mine: false };
const STATUS_CHIPS = [["open", "Open"], ["won", "Won"], ["lost", "Lost"]];

// Deals list. Each deal opens its detail page (/deal/:id); the drag-and-drop board
// stays on Pipelines.
export default function Deal() {
  const { request, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { pipelines } = useLookups(["pipelines"]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lostModal, setLostModal] = useState(null);
  const sel = useSelection(rows);
  const canWrite = usePermissions().can("records.write");
  const legacyId = searchParams.get("id");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await request("/deals", {
        query: { page, limit: PAGE_SIZE, search: view.search, status: view.status, pipelineId: view.pipelineId, ownerId: view.mine ? user?._id : undefined },
      });
      setRows(r.data?.items || []);
      setMeta({ total: r.data?.pagination?.total || 0, pages: r.data?.pagination?.pages || 1 });
    } catch (e) { setError(e.message || "Failed to load deals."); setRows([]); }
    finally { setLoading(false); }
  }, [request, page, view, user?._id]);
  useEffect(() => { if (!legacyId) load(); }, [load, legacyId]);

  if (legacyId) return <Navigate to={recordHref.deal(legacyId)} replace />;
  const update = (patch) => { setView((v) => ({ ...v, ...patch })); setPage(1); };

  async function finishBulk(result, verb) {
    setNotice(`${result.ok} ${verb}${result.failed ? `, ${result.failed} failed: ${result.firstError}` : ""}.`);
    sel.clear(); invalidateLookups("deals"); load();
  }
  async function bulkDelete() {
    const ids = sel.ids();
    if (!window.confirm(`Delete ${ids.length} deal(s)? This cannot be undone.`)) return;
    finishBulk(await runBulk(ids, (id) => request(`/deals/${id}`, { method: "DELETE" })), "deleted");
  }
  async function bulkLost() {
    const reason = lostModal.reason.trim();
    if (!reason) return;
    const ids = sel.ids();
    setLostModal(null);
    finishBulk(await runBulk(ids, (id) => request(`/deals/${id}`, { method: "PATCH", body: { status: "lost", lostReason: reason } })), "marked lost");
  }

  return (
    <Page title="Deals" kicker={`${meta.total} deal${meta.total === 1 ? "" : "s"}`}
      actions={<Link className="btn ghost" to="/pipelines">Open pipeline board</Link>}>
      <section className="lk-toolbar">
        <SearchBox value={view.search} onChange={(search) => update({ search })} placeholder="Search deal title or source" />
        <select aria-label="Pipeline" value={view.pipelineId} onChange={(e) => update({ pipelineId: e.target.value })}>
          <option value="">All pipelines</option>
          {pipelines.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <SavedViews page="deals" current={view} onApply={(state) => { setView({ ...DEFAULT_VIEW, ...state }); setPage(1); }} />
      </section>
      <section className="lk-filterbar">
        <FilterChips label="Status" chips={STATUS_CHIPS.map(([key, label]) => ({ key, label, active: view.status === key }))} onToggle={(s) => update({ status: view.status === s ? "" : s })} onClear={() => update({ status: "" })} />
        <FilterChips chips={[{ key: "mine", label: "My deals", active: view.mine }]} onToggle={() => update({ mine: !view.mine })} />
      </section>
      {notice && <div className="notice"><b>Deals</b><span>{notice}</span></div>}
      <BulkBar count={canWrite ? sel.count : 0} onClear={sel.clear}>
        <button type="button" className="btn ghost" onClick={() => setLostModal({ reason: "" })}>Mark lost</button>
        <button type="button" className="btn ghost" onClick={bulkDelete}>Delete</button>
      </BulkBar>

      <section className="panel lk-table-wrap">
        <DataState loading={loading} error={error} onRetry={load} empty={rows.length === 0} emptyText={view.search ? `No deals match "${view.search}".` : "No deals found."}>
          <table className="lk-table">
            <thead>
              <tr>
                {canWrite && <th className="lk-check"><input type="checkbox" aria-label="Select all" checked={sel.allSelected} onChange={sel.toggleAll} /></th>}
                <th>Deal</th><th>Contact</th><th>Company</th><th>Pipeline · stage</th><th>Value</th><th>Status</th><th>Owner</th>
              </tr>
            </thead>
            <tbody className={loading ? "lk-dim" : ""}>
              {rows.map((d) => {
                const contact = d.contactId && typeof d.contactId === "object" ? d.contactId : null;
                const company = d.companyId && typeof d.companyId === "object" ? d.companyId : null;
                return (
                  <tr key={d._id} className="lk-row" onClick={() => navigate(recordHref.deal(d._id))}>
                    {canWrite && <CheckCell checked={sel.has(d._id)} onChange={() => sel.toggle(d._id)} label={`Select ${d.title}`} />}
                    <td><Link to={recordHref.deal(d._id)} onClick={(e) => e.stopPropagation()} className="lk-primary">{d.title}</Link><small>{d.dealNumber ? `#${d.dealNumber} · ` : ""}{d.productType || ""}</small></td>
                    <td>{contact ? <Link to={recordHref.contact(contact._id)} onClick={(e) => e.stopPropagation()}>{personLabel(contact)}</Link> : "—"}</td>
                    <td>{company ? <Link to={recordHref.company(company._id)} onClick={(e) => e.stopPropagation()}>{company.name}</Link> : "—"}</td>
                    <td>{d.pipelineId?.name || "—"}<small>{d.stageId?.name || ""}</small></td>
                    <td><b>{formatMoney(d.value, d.currency)}</b></td>
                    <td><Badge tone={d.status === "won" ? "good" : d.status === "lost" ? "warn" : ""}>{d.status}</Badge></td>
                    <td>{d.ownerId?.name || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
        <Pager page={page} pages={meta.pages} total={meta.total} loading={loading} onPage={setPage} />
      </section>

      {lostModal && (
        <Modal title={`Mark ${sel.count} deal(s) as lost`} onClose={() => setLostModal(null)} actions={<>
          <button type="button" className="btn ghost" onClick={() => setLostModal(null)}>Cancel</button>
          <button type="button" className="btn primary" disabled={!lostModal.reason.trim()} onClick={bulkLost}>Mark lost</button>
        </>}>
          <label>Reason (required)<textarea rows={3} value={lostModal.reason} onChange={(e) => setLostModal({ reason: e.target.value })} /></label>
        </Modal>
      )}
    </Page>
  );
}
