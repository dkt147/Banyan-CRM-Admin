import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Page } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { BulkBar, CheckCell, DataState, FilterChips, Pager, SavedViews, SearchBox, runBulk, useSelection } from "../components/ListKit";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { recordHref } from "../utils/recordLinks";
import { invalidateLookups } from "../utils/useLookups";

const PAGE_SIZE = 25;
const DEFAULT_VIEW = { search: "", status: "active", sort: "createdAt-desc" };
const blank = { name: "", legalName: "", industry: "", website: "", email: "", phone: "", street: "", city: "", country: "", postalCode: "", tags: "", notes: "" };
const SORTS = [["createdAt-desc", "Newest first"], ["createdAt-asc", "Oldest first"], ["name-asc", "Name A–Z"], ["name-desc", "Name Z–A"]];

export default function Companies() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState(DEFAULT_VIEW);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const sel = useSelection(rows);
  const canWrite = usePermissions().can("records.write");
  const legacyId = searchParams.get("id");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [sort, order] = view.sort.split("-");
      const r = await request("/companies", {
        query: { page, limit: PAGE_SIZE, search: view.search, sort, order, isArchived: view.status === "all" ? "all" : view.status === "archived" },
      });
      setRows(Array.isArray(r.data) ? r.data : []);
      setMeta({ total: r.pagination?.total || 0, pages: r.pagination?.totalPages || 1 });
    } catch (e) { setError(e.message || "Failed to load companies."); setRows([]); }
    finally { setLoading(false); }
  }, [request, page, view]);
  useEffect(() => { if (!legacyId) load(); }, [load, legacyId]);

  if (legacyId) return <Navigate to={recordHref.company(legacyId)} replace />;
  const update = (patch) => { setView((v) => ({ ...v, ...patch })); setPage(1); };

  async function create() {
    if (form.name.trim().length < 2) { setFormError("Company name must be at least 2 characters."); return; }
    setSaving(true); setFormError("");
    try {
      const body = { name: form.name.trim(), tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      for (const key of ["legalName", "industry", "website", "email", "phone", "notes"]) if (form[key].trim()) body[key] = form[key].trim();
      const address = Object.fromEntries(["street", "city", "country", "postalCode"].filter((k) => form[k].trim()).map((k) => [k, form[k].trim()]));
      if (Object.keys(address).length) body.address = address;
      const r = await request("/companies", { method: "POST", body });
      invalidateLookups("companies");
      setModal(false); setForm(blank);
      navigate(recordHref.company(r.data._id));
    } catch (e) { setFormError(e.message || "Failed to create company."); }
    finally { setSaving(false); }
  }

  async function bulkArchive() {
    const ids = sel.ids();
    if (!window.confirm(`Archive ${ids.length} compan${ids.length === 1 ? "y" : "ies"}?`)) return;
    const result = await runBulk(ids, (id) => request(`/companies/${id}/archive`, { method: "PATCH" }));
    setNotice(`${result.ok} archived${result.failed ? `, ${result.failed} failed: ${result.firstError}` : ""}.`);
    sel.clear(); invalidateLookups("companies"); load();
  }

  return (
    <Page
      title="Companies"
      kicker={`${meta.total} compan${meta.total === 1 ? "y" : "ies"}`}
      actions={canWrite && <button type="button" className="btn primary" onClick={() => { setForm(blank); setFormError(""); setModal(true); }}>+ New company</button>}
    >
      <section className="lk-toolbar">
        <SearchBox value={view.search} onChange={(search) => update({ search })} placeholder="Search name, legal name or email" />
        <select aria-label="Sort" value={view.sort} onChange={(e) => update({ sort: e.target.value })}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <SavedViews page="companies" current={view} onApply={(state) => { setView({ ...DEFAULT_VIEW, ...state }); setPage(1); }} />
      </section>
      <section className="lk-filterbar">
        <FilterChips label="Status" chips={[["active", "Active"], ["archived", "Archived"], ["all", "All"]].map(([key, label]) => ({ key, label, active: view.status === key }))} onToggle={(status) => update({ status })} />
      </section>
      {notice && <div className="notice"><b>Companies</b><span>{notice}</span></div>}
      <BulkBar count={canWrite ? sel.count : 0} onClear={sel.clear}>
        <button type="button" className="btn ghost" onClick={bulkArchive}>Archive</button>
      </BulkBar>

      <section className="panel lk-table-wrap">
        <DataState loading={loading} error={error} onRetry={load} empty={rows.length === 0} emptyText={view.search ? `No companies match "${view.search}".` : "No companies found."}>
          <table className="lk-table">
            <thead>
              <tr>
                {canWrite && <th className="lk-check"><input type="checkbox" aria-label="Select all" checked={sel.allSelected} onChange={sel.toggleAll} /></th>}
                <th>Company</th><th>Industry</th><th>Email / phone</th><th>Contacts</th><th>Open deals</th><th>Created</th>
              </tr>
            </thead>
            <tbody className={loading ? "lk-dim" : ""}>
              {rows.map((c) => (
                <tr key={c._id} className="lk-row" onClick={() => navigate(recordHref.company(c._id))}>
                  {canWrite && <CheckCell checked={sel.has(c._id)} onChange={() => sel.toggle(c._id)} label={`Select ${c.name}`} />}
                  <td><Link to={recordHref.company(c._id)} onClick={(e) => e.stopPropagation()} className="lk-primary">{c.name}</Link>{c.legalName && <small>{c.legalName}</small>}{c.isArchived && <Badge tone="warn">Archived</Badge>}</td>
                  <td>{c.industry || "—"}</td>
                  <td><span>{c.email || "—"}</span>{c.phone && <small>{c.phone}</small>}</td>
                  <td>{c.contactCount ?? "—"}</td>
                  <td>{c.openDealCount ?? "—"}</td>
                  <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
        <Pager page={page} pages={meta.pages} total={meta.total} loading={loading} onPage={setPage} />
      </section>

      {modal && (
        <Modal title="Create new company" onClose={() => !saving && setModal(false)} actions={<>
          <button type="button" className="btn ghost" onClick={() => setModal(false)} disabled={saving}>Cancel</button>
          <button type="button" className="btn primary" onClick={create} disabled={saving}>{saving ? "Saving…" : "Create company"}</button>
        </>}>
          {formError && <div className="notice error"><b>Company</b><span>{formError}</span></div>}
          <div className="form-grid">
            {[["name", "Name *"], ["legalName", "Legal name"], ["industry", "Industry"], ["website", "Website (https://…)"], ["email", "Email"], ["phone", "Phone"], ["street", "Street"], ["city", "City"], ["country", "Country"], ["postalCode", "Postal code"], ["tags", "Tags (comma separated)"]].map(([key, label]) => (
              <label key={key}>{label}<input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
            ))}
          </div>
          <label>Notes<textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </Modal>
      )}
    </Page>
  );
}
