import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Page } from "./Dashboard";
import Modal from "../components/Modal";
import BookingsTabs from "../components/BookingsTabs";
import { BulkBar, CheckCell, DataState, FilterChips, Pager, SavedViews, SearchBox, runBulk, useSelection } from "../components/ListKit";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { recordHref } from "../utils/recordLinks";
import { personLabel, useLookups } from "../utils/useLookups";
import { fromHkInput } from "../utils/hkTime";
import { BOOKING_STATUSES, BOOKING_TYPES, bookingStatusLabel } from "./detail/BookingDetail";
import RoomBookingModal from "../roomBooking/RoomBookingModal";

const PAGE_SIZE = 25;
// Cancelled and expired are hidden unless picked (brief 6.2).
const DEFAULT_STATUSES = ["pending_payment", "held", "pending", "confirmed", "completed"];
const DEFAULT_VIEW = { search: "", statuses: DEFAULT_STATUSES, upcoming: false };
const blankForm = { title: "", contactId: "", companyId: "", dealId: "", resourceName: "", bookingType: "meeting_room", startAt: "", endAt: "", status: "confirmed", price: 0, currency: "HKD", notes: "" };
const PAYMENT = { not_required: "—", unpaid: "Unpaid", paid: "Paid", refunded: "Refunded", failed: "Failed" };
const time = (v) => new Date(v).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function Bookings() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { contacts, companies, deals } = useLookups(["contacts", "companies", "deals"]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [contactFilter, setContactFilter] = useState(() => searchParams.get("contactId") || "");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  // WordPress room bookings are read-only here, so they are not selectable for bulk cancel.
  const sel = useSelection(rows.filter((b) => !b.externalRef));
  const canWrite = usePermissions().can("bookings.write");
  const legacyId = searchParams.get("id");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = { page, limit: PAGE_SIZE, search: view.search, contactId: contactFilter, status: view.statuses.join(","), sort: "startAt", order: view.upcoming ? "asc" : "desc" };
      if (view.upcoming) query.from = new Date().toISOString();
      const r = await request("/bookings", { query });
      setRows(r.data?.items || []);
      setMeta({ total: r.data?.pagination?.total || 0, pages: r.data?.pagination?.pages || 1 });
    } catch (e) { setError(e.message || "Failed to load bookings."); setRows([]); }
    finally { setLoading(false); }
  }, [request, page, view, contactFilter]);
  useEffect(() => { if (!legacyId) load(); }, [load, legacyId]);

  if (legacyId) return <Navigate to={recordHref.booking(legacyId)} replace />;
  const update = (patch) => { setView((v) => ({ ...v, ...patch })); setPage(1); };
  const toggleStatus = (s) => update({ statuses: view.statuses.includes(s) ? view.statuses.filter((x) => x !== s) : [...view.statuses, s] });

  async function create() {
    if (!form.contactId) { setFormError("Select the contact this booking is for."); return; }
    if (!form.resourceName.trim() || !form.startAt || !form.endAt) { setFormError("Room, start and end are required."); return; }
    if (fromHkInput(form.endAt) <= fromHkInput(form.startAt)) { setFormError("End time must be after start time."); return; }
    setSaving(true); setFormError("");
    try {
      const body = { ...form, startAt: fromHkInput(form.startAt).toISOString(), endAt: fromHkInput(form.endAt).toISOString(), price: Number(form.price) || 0, source: "manual" };
      for (const key of ["companyId", "dealId", "title", "notes"]) if (!body[key]) delete body[key];
      const r = await request("/bookings", { method: "POST", body });
      setModal(false); setForm(blankForm);
      navigate(recordHref.booking(r.data._id));
    } catch (e) { setFormError(e.message || "Failed to create booking."); }
    finally { setSaving(false); }
  }

  async function bulkCancel() {
    const ids = sel.ids();
    if (!window.confirm(`Cancel ${ids.length} booking(s) and free the rooms?`)) return;
    const result = await runBulk(ids, (id) => request(`/calendar/${id}/cancel`, { method: "PATCH" }));
    setNotice(`${result.ok} cancelled${result.failed ? `, ${result.failed} failed: ${result.firstError}` : ""}.`);
    sel.clear(); load();
  }

  const filterContact = contactFilter && (contacts.find((c) => c._id === contactFilter) || rows.find((r) => r.contactId?._id === contactFilter)?.contactId);

  return (
    <Page title="Bookings and Calendar" kicker={`${meta.total} booking${meta.total === 1 ? "" : "s"}`}
      actions={canWrite && <>
        <button type="button" className="btn ghost" onClick={() => { setForm(blankForm); setFormError(""); setModal(true); }}>Other booking</button>
        <button type="button" className="btn primary" onClick={() => setRoomModal(true)}>Book a meeting room</button>
      </>}>
      <BookingsTabs active="list" />
      <section className="lk-toolbar">
        <SearchBox value={view.search} onChange={(search) => update({ search })} placeholder="Search room, title or contact" />
        <SavedViews page="bookings" current={view} onApply={(state) => { setView({ ...DEFAULT_VIEW, ...state }); setPage(1); }} />
      </section>
      <section className="lk-filterbar">
        <FilterChips label="Status" chips={BOOKING_STATUSES.map(([key, label]) => ({ key, label, active: view.statuses.includes(key) }))} onToggle={toggleStatus} />
        <FilterChips chips={[{ key: "upcoming", label: "Upcoming only", active: view.upcoming }, ...(contactFilter ? [{ key: "contact", label: `Contact: ${personLabel(filterContact) || "selected"} ✕`, active: true }] : [])]}
          onToggle={(k) => k === "upcoming" ? update({ upcoming: !view.upcoming }) : (setContactFilter(""), setPage(1))} />
      </section>
      {notice && <div className="notice"><b>Bookings</b><span>{notice}</span></div>}
      <BulkBar count={canWrite ? sel.count : 0} onClear={sel.clear}>
        <button type="button" className="btn ghost" onClick={bulkCancel}>Cancel bookings</button>
      </BulkBar>

      <section className="panel lk-table-wrap">
        <DataState loading={loading} error={error} onRetry={load} empty={rows.length === 0} emptyText="No bookings match these filters.">
          <table className="lk-table">
            <thead>
              <tr>
                {canWrite && <th className="lk-check"><input type="checkbox" aria-label="Select all" checked={sel.allSelected} onChange={sel.toggleAll} /></th>}
                <th>When</th><th>Booking</th><th>Contact</th><th>Deal</th><th>Status</th><th>Payment</th>
              </tr>
            </thead>
            <tbody className={loading ? "lk-dim" : ""}>
              {rows.map((b) => {
                const contact = b.contactId && typeof b.contactId === "object" ? b.contactId : null;
                const status = b.displayStatus || b.status;
                return (
                  <tr key={b._id} className="lk-row" onClick={() => navigate(recordHref.booking(b._id))}>
                    {canWrite && (b.externalRef
                      ? <td className="lk-check" title="Managed in WordPress" />
                      : <CheckCell checked={sel.has(b._id)} onChange={() => sel.toggle(b._id)} label="Select booking" />)}
                    <td><b>{new Date(b.startAt).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</b><small>{time(b.startAt)}–{time(b.endAt)}</small></td>
                    <td><Link to={recordHref.booking(b._id)} onClick={(e) => e.stopPropagation()} className="lk-primary">{b.title || b.resourceName || "Booking"}</Link><small>{[b.resourceName, (BOOKING_TYPES.find(([v]) => v === b.bookingType) || [])[1]].filter(Boolean).join(" · ")}</small></td>
                    <td>{contact ? <Link to={recordHref.contact(contact._id)} onClick={(e) => e.stopPropagation()}>{personLabel(contact)}</Link> : <span className="lk-warn-text">Unlinked</span>}</td>
                    <td>{b.dealId?._id ? <Link to={recordHref.deal(b.dealId._id)} onClick={(e) => e.stopPropagation()}>{b.dealId.title}</Link> : "—"}</td>
                    <td><span className={`status-pill status-${status}`}>{bookingStatusLabel(status)}</span></td>
                    <td>{PAYMENT[b.paymentStatus] || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
        <Pager page={page} pages={meta.pages} total={meta.total} loading={loading} onPage={setPage} />
      </section>

      {roomModal && <RoomBookingModal onClose={() => setRoomModal(false)} onBooked={load} />}

      {modal && (
        <Modal title="New booking" onClose={() => !saving && setModal(false)} actions={<>
          <button type="button" className="btn ghost" onClick={() => setModal(false)} disabled={saving}>Cancel</button>
          <button type="button" className="btn primary" onClick={create} disabled={saving}>{saving ? "Saving…" : "Create booking"}</button>
        </>}>
          {formError && <div className="notice error"><b>Booking</b><span>{formError}</span></div>}
          <div className="form-grid">
            <label>Contact<span className="required-mark"> *</span><select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}><option value="">Select contact</option>{contacts.map((c) => <option key={c._id} value={c._id}>{personLabel(c)}</option>)}</select></label>
            <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Room / resource<span className="required-mark"> *</span><input value={form.resourceName} onChange={(e) => setForm({ ...form, resourceName: e.target.value })} placeholder="Harbour Room" /></label>
            <label>Type<select value={form.bookingType} onChange={(e) => setForm({ ...form, bookingType: e.target.value })}>{BOOKING_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Start<span className="required-mark"> *</span><input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></label>
            <label>End<span className="required-mark"> *</span><input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></label>
            <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{BOOKING_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Company<select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}><option value="">From contact</option>{companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
            <label>Deal<select value={form.dealId} onChange={(e) => setForm({ ...form, dealId: e.target.value })}><option value="">No deal</option>{deals.map((d) => <option key={d._id} value={d._id}>{d.title}</option>)}</select></label>
            <label>Price<input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          </div>
          <label>Notes<textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </Modal>
      )}
    </Page>
  );
}
