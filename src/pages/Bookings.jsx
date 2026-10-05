import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const STATUSES = ["held", "pending", "confirmed", "completed", "cancelled"];

const blankForm = {
  contactId: "",
  companyId: "",
  dealId: "",
  resourceName: "",
  bookingType: "meeting",
  startAt: "",
  endAt: "",
  status: "pending",
  price: 0,
  currency: "HKD",
  notes: "",
};

const idOf = (value) => (typeof value === "object" ? value?._id : value) || "";
const nameOfContact = (value) => {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return value.fullName || [value.firstName, value.lastName].filter(Boolean).join(" ") || value.email || value._id;
};
const nameOf = (value, fallback = "—") => {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.name || value.title || value.fullName || value.email || value._id || fallback;
};
const localValue = (value) => (value ? new Date(value).toISOString().slice(0, 16) : "");

export default function Bookings() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [deals, setDeals] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [dealFilter, setDealFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [details, setDetails] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm);

  async function loadLookups() {
    const [contactsRes, companiesRes, dealsRes] = await Promise.allSettled([
      request("/contacts", { query: { page: 1, limit: 100 } }),
      request("/companies", { query: { page: 1, limit: 100, isArchived: false } }),
      request("/deals", { query: { page: 1, limit: 100 } }),
    ]);
    if (contactsRes.status === "fulfilled") setContacts(contactsRes.value.data?.items || contactsRes.value.data || []);
    if (companiesRes.status === "fulfilled") setCompanies(companiesRes.value.data?.items || companiesRes.value.data || []);
    if (dealsRes.status === "fulfilled") setDeals(dealsRes.value.data?.items || dealsRes.value.data || []);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = { page: 1, limit: 25, sort: "startAt", order: "asc" };
      if (statusFilter) query.status = statusFilter;
      if (contactFilter) query.contactId = contactFilter;
      if (dealFilter) query.dealId = dealFilter;
      const response = await request("/bookings", { query });
      setRows(response.data?.items || response.data?.bookings || []);
    } catch (e) {
      setError(e.message || "Failed to load bookings.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLookups().catch(() => {}); }, []);
  useEffect(() => { load(); }, [statusFilter, contactFilter, dealFilter]);

  function openCreate() {
    setEditingId(null);
    setDetails(null);
    setForm(blankForm);
    setError("");
    setModal(true);
  }

  async function openEdit(row) {
    setError("");
    try {
      const response = await request(`/bookings/${row._id}`);
      const b = response.data || row;
      setDetails(null);
      setEditingId(b._id);
      setForm({
        contactId: idOf(b.contactId), companyId: idOf(b.companyId), dealId: idOf(b.dealId),
        resourceName: b.resourceName || "", bookingType: b.bookingType || "meeting",
        startAt: localValue(b.startAt), endAt: localValue(b.endAt), status: b.status || "pending",
        price: b.price ?? 0, currency: b.currency || "HKD", notes: b.notes || "",
      });
      setModal(true);
    } catch (e) { setError(e.message); }
  }

  async function openDetails(row) {
    try {
      const response = await request(`/bookings/${row._id}`);
      setDetails(response.data || row);
    } catch (e) { setError(e.message); }
  }

  async function save() {
    if (!form.resourceName.trim() || !form.startAt || !form.endAt) {
      setError("Resource, start time and end time are required.");
      return;
    }
    if (new Date(form.endAt) <= new Date(form.startAt)) {
      setError("End time must be after start time.");
      return;
    }
    setError("");
    try {
      const body = {
        ...form,
        contactId: form.contactId || undefined,
        companyId: form.companyId || undefined,
        dealId: form.dealId || undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        price: Number(form.price) || 0,
      };
      const response = await request(editingId ? `/bookings/${editingId}` : "/bookings", {
        method: editingId ? "PATCH" : "POST", body,
      });
      setRows((current) => editingId ? current.map((r) => r._id === editingId ? { ...r, ...response.data } : r) : [response.data, ...current]);
      setModal(false);
      setEditingId(null);
      setForm(blankForm);
    } catch (e) { setError(e.message); }
  }

  async function remove(row) {
    if (!window.confirm("Delete booking?")) return;
    try {
      await request(`/bookings/${row._id}`, { method: "DELETE" });
      setRows((current) => current.filter((r) => r._id !== row._id));
      if (details?._id === row._id) setDetails(null);
    } catch (e) { setError(e.message); }
  }

  return (
    <Page title="Bookings" kicker="Manage workspace bookings"
      actions={<button className="btn primary" onClick={openCreate}>New booking</button>}
    >
      {error && <div className="notice error"><b>Bookings</b><span>{error}</span></div>}

      <section className="panel booking-filters">
        <label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label>Contact<select value={contactFilter} onChange={(e) => setContactFilter(e.target.value)}><option value="">All contacts</option>{contacts.map((c) => <option key={c._id} value={c._id}>{nameOfContact(c)}</option>)}</select></label>
        <label>Deal<select value={dealFilter} onChange={(e) => setDealFilter(e.target.value)}><option value="">All deals</option>{deals.map((d) => <option key={d._id} value={d._id}>{nameOf(d, d._id)}</option>)}</select></label>
      </section>

      <section className="panel table-wrap">
        <table>
          <thead><tr><th>When</th><th>Resource</th><th>Contact</th><th>Deal</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row._id}>
              <td><b>{row.startAt ? new Date(row.startAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</b><span>{row.startAt ? new Date(row.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} – {row.endAt ? new Date(row.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span></td>
              <td><b>{row.resourceName || "—"}</b><span>{row.bookingType || ""}</span></td>
              <td>{nameOfContact(row.contactId)}</td>
              <td>{nameOf(row.dealId)}</td>
              <td>{row.currency || ""} {Number(row.price || 0).toLocaleString()}</td>
              <td><Badge>{row.status}</Badge></td>
              <td><div className="table-actions"><button className="btn ghost" onClick={() => openDetails(row)}>View</button><button className="btn ghost" onClick={() => openEdit(row)}>Edit</button><button className="btn ghost" onClick={() => remove(row)}>Delete</button></div></td>
            </tr>)}
          </tbody>
        </table>
        {loading ? <div className="empty-state">Loading bookings…</div> : rows.length === 0 ? <Empty text="No bookings found." /> : null}
      </section>

      {details && <Modal title="Booking details" onClose={() => setDetails(null)} actions={<><button className="btn ghost" onClick={() => setDetails(null)}>Close</button><button className="btn primary" onClick={() => openEdit(details)}>Edit booking</button></>}>
        <div className="detail-grid">
          <Detail label="Resource" value={details.resourceName} /><Detail label="Type" value={details.bookingType} />
          <Detail label="Status" value={details.status} /><Detail label="Price" value={`${details.currency || ""} ${Number(details.price || 0).toLocaleString()}`} />
          <Detail label="Start" value={details.startAt ? new Date(details.startAt).toLocaleString() : "—"} /><Detail label="End" value={details.endAt ? new Date(details.endAt).toLocaleString() : "—"} />
          <Detail label="Contact" value={nameOfContact(details.contactId)} /><Detail label="Company" value={nameOf(details.companyId)} />
          <Detail label="Deal" value={nameOf(details.dealId)} /><Detail label="Created by" value={nameOf(details.createdBy)} />
          <div className="detail-block"><span>Notes</span><p>{details.notes || "—"}</p></div>
        </div>
      </Modal>}

      {modal && <Modal title={editingId ? "Edit booking" : "New booking"} onClose={() => setModal(false)} actions={<><button className="btn ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn primary" onClick={save}>{editingId ? "Save changes" : "Create booking"}</button></>}>
        <div className="form-grid">
          <label>Contact<select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}><option value="">Select contact</option>{contacts.map((c) => <option key={c._id} value={c._id}>{nameOfContact(c)}</option>)}</select></label>
          <label>Company<select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}><option value="">Select company</option>{companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
          <label>Deal<select value={form.dealId} onChange={(e) => setForm({ ...form, dealId: e.target.value })}><option value="">Select deal</option>{deals.map((d) => <option key={d._id} value={d._id}>{nameOf(d, d._id)}</option>)}</select></label>
          <label>Resource<input value={form.resourceName} onChange={(e) => setForm({ ...form, resourceName: e.target.value })} placeholder="Harbour Room" /></label>
          <label>Booking type<input value={form.bookingType} onChange={(e) => setForm({ ...form, bookingType: e.target.value })} /></label>
          <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label>Start<input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></label>
          <label>End<input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></label>
          <label>Price<input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          <label>Currency<input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></label>
          <label className="form-span-2">Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
      </Modal>}
    </Page>
  );
}

function Detail({ label, value }) { return <div className="detail-item"><span>{label}</span><b>{value || "—"}</b></div>; }
