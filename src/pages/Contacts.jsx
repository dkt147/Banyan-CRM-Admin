import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Page } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { BulkBar, CheckCell, DataState, FilterChips, Pager, SavedViews, SearchBox, runBulk, useSelection } from "../components/ListKit";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { recordHref } from "../utils/recordLinks";
import { invalidateLookups, useLookups } from "../utils/useLookups";
import { CONTACT_TAGS, tagLabel } from "./detail/ContactDetail";

const PAGE_SIZE = 25;
const DEFAULT_VIEW = { search: "", status: "active", tag: "", companyId: "", mine: false };
const blankForm = { firstName: "", lastName: "", email: "", phone: "", whatsapp: "", jobTitle: "", companyId: "", tags: "", source: "", language: "en", notes: "" };
const fmtShort = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "");

export default function Contacts() {
  const { request, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companies } = useLookups(["companies"]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const sel = useSelection(rows);
  const canWrite = usePermissions().can("records.write");
  const legacyId = searchParams.get("id");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = { page, limit: PAGE_SIZE, search: view.search, companyId: view.companyId, tag: view.tag };
      query.isArchived = view.status === "all" ? "all" : view.status === "archived";
      if (view.mine && user?._id) query.ownerId = user._id;
      const r = await request("/contacts", { query });
      setRows(Array.isArray(r.data) ? r.data : []);
      setMeta({ total: r.pagination?.total || 0, pages: r.pagination?.totalPages || 1 });
    } catch (e) { setError(e.message || "Failed to load contacts."); setRows([]); }
    finally { setLoading(false); }
  }, [request, page, view, user?._id]);
  useEffect(() => { if (!legacyId) load(); }, [load, legacyId]);

  // Older links used /contact?id=…; send them to the detail page.
  if (legacyId) return <Navigate to={recordHref.contact(legacyId)} replace />;

  const update = (patch) => { setView((v) => ({ ...v, ...patch })); setPage(1); };

  async function create() {
    if (!form.firstName.trim()) { setFormError("First name is required."); return; }
    setSaving(true); setFormError("");
    try {
      const body = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), language: form.language, tags: form.tags ? [form.tags] : [] };
      for (const key of ["email", "phone", "whatsapp", "jobTitle", "source", "notes"]) if (form[key].trim()) body[key] = form[key].trim();
      if (form.companyId) body.companyId = form.companyId;
      const r = await request("/contacts", { method: "POST", body });
      invalidateLookups("contacts");
      setModal(false); setForm(blankForm);
      navigate(recordHref.contact(r.data._id));
    } catch (e) { setFormError(e.message || "Failed to create contact."); }
    finally { setSaving(false); }
  }

  async function bulk(kind) {
    const ids = sel.ids();
    if (kind === "archive" && !window.confirm(`Archive ${ids.length} contact(s)?`)) return;
    if (kind === "tag" && !bulkTag) return;
    const byId = new Map(rows.map((r) => [r._id, r]));
    const result = await runBulk(ids, (id) => kind === "archive"
      ? request(`/contacts/${id}/archive`, { method: "PATCH" })
      : request(`/contacts/${id}`, { method: "PATCH", body: { tags: [...new Set([...(byId.get(id)?.tags || []), bulkTag])] } }));
    setNotice(`${result.ok} updated${result.failed ? `, ${result.failed} failed: ${result.firstError}` : ""}.`);
    sel.clear(); setBulkTag(""); invalidateLookups("contacts"); load();
  }

  const statusChips = [["active", "Active"], ["archived", "Archived"], ["all", "All"]];

  return (
    <Page
      title="Contacts"
      kicker={`${meta.total} contact${meta.total === 1 ? "" : "s"}`}
      actions={canWrite && <button type="button" className="btn primary" onClick={() => { setForm(blankForm); setFormError(""); setModal(true); }}>+ New contact</button>}
    >
      <section className="lk-toolbar">
        <SearchBox value={view.search} onChange={(search) => update({ search })} placeholder="Search name, email, phone or company" />
        <select aria-label="Company" value={view.companyId} onChange={(e) => update({ companyId: e.target.value })}>
          <option value="">All companies</option>
          {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <SavedViews page="contacts" current={view} onApply={(state) => { setView({ ...DEFAULT_VIEW, ...state }); setPage(1); }} />
      </section>
      <section className="lk-filterbar">
        <FilterChips label="Status" chips={statusChips.map(([key, label]) => ({ key, label, active: view.status === key }))} onToggle={(status) => update({ status })} />
        <FilterChips label="Tag" chips={CONTACT_TAGS.map((t) => ({ key: t, label: tagLabel(t), active: view.tag === t }))} onToggle={(t) => update({ tag: view.tag === t ? "" : t })} />
        <FilterChips chips={[{ key: "mine", label: "My contacts", active: view.mine }]} onToggle={() => update({ mine: !view.mine })} />
      </section>
      {notice && <div className="notice"><b>Contacts</b><span>{notice}</span></div>}

      <BulkBar count={canWrite ? sel.count : 0} onClear={sel.clear}>
        <button type="button" className="btn ghost" onClick={() => bulk("archive")}>Archive</button>
        <select aria-label="Tag to add" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)}>
          <option value="">Add tag…</option>
          {CONTACT_TAGS.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}
        </select>
        <button type="button" className="btn ghost" disabled={!bulkTag} onClick={() => bulk("tag")}>Apply tag</button>
      </BulkBar>

      <section className="panel lk-table-wrap">
        <DataState loading={loading} error={error} onRetry={load} empty={rows.length === 0} emptyText={view.search ? `No contacts match "${view.search}".` : "No contacts found."}>
          <table className="lk-table">
            <thead>
              <tr>
                {canWrite && <th className="lk-check"><input type="checkbox" aria-label="Select all" checked={sel.allSelected} onChange={sel.toggleAll} /></th>}
                <th>Name</th><th>Company</th><th>Email / phone</th><th>Tags</th><th>Bookings</th><th>Deals</th><th>Owner</th>
              </tr>
            </thead>
            <tbody className={loading ? "lk-dim" : ""}>
              {rows.map((c) => {
                const company = c.companyId && typeof c.companyId === "object" ? c.companyId : null;
                return (
                  <tr key={c._id} className="lk-row" onClick={() => navigate(recordHref.contact(c._id))}>
                    {canWrite && <CheckCell checked={sel.has(c._id)} onChange={() => sel.toggle(c._id)} label={`Select ${c.firstName}`} />}
                    <td><Link to={recordHref.contact(c._id)} onClick={(e) => e.stopPropagation()} className="lk-primary">{[c.firstName, c.lastName].filter(Boolean).join(" ")}</Link>{c.jobTitle && <small>{c.jobTitle}</small>}</td>
                    <td>{company ? <Link to={recordHref.company(company._id)} onClick={(e) => e.stopPropagation()}>{company.name}</Link> : "—"}</td>
                    <td><span>{c.email || "—"}</span>{c.phone && <small>{c.phone}</small>}</td>
                    <td>{(c.tags || []).slice(0, 2).map((t) => <Badge key={t}>{tagLabel(t)}</Badge>)}{c.isArchived && <Badge tone="warn">Archived</Badge>}</td>
                    <td>{c.bookingCount || 0}{c.nextBookingAt && <small>Next {fmtShort(c.nextBookingAt)}</small>}</td>
                    <td>{c.dealCount || 0}{c.openDealCount ? <small>{c.openDealCount} open</small> : null}</td>
                    <td>{c.ownerId?.name || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
        <Pager page={page} pages={meta.pages} total={meta.total} loading={loading} onPage={setPage} />
      </section>

      {modal && (
        <Modal title="Create new contact" onClose={() => !saving && setModal(false)} actions={<>
          <button type="button" className="btn ghost" onClick={() => setModal(false)} disabled={saving}>Cancel</button>
          <button type="button" className="btn primary" onClick={create} disabled={saving}>{saving ? "Saving…" : "Create contact"}</button>
        </>}>
          {formError && <div className="notice error"><b>Contact</b><span>{formError}</span></div>}
          <div className="form-grid">
            {[["firstName", "First name *"], ["lastName", "Last name"], ["email", "Email", "email"], ["phone", "Phone"], ["whatsapp", "WhatsApp"], ["jobTitle", "Job title"], ["source", "Source / referral"]].map(([key, label, type]) => (
              <label key={key}>{label}<input type={type || "text"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
            ))}
            <label>Company<select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}><option value="">No company</option>{companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
            <label>Language<select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">English</option><option value="zh">Chinese</option><option value="es">Spanish</option></select></label>
            <label>Tag<select value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}><option value="">No tag</option>{CONTACT_TAGS.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}</select></label>
          </div>
          <label>Notes<textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </Modal>
      )}
    </Page>
  );
}
