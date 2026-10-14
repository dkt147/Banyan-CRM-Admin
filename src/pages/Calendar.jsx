import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
import { listenForGoogleOAuth, openGoogleOAuth } from "../utils/googleOAuth";

const STATUSES = ["scheduled", "cancelled", "completed"];
const blankForm = {
  title: "", type: "meeting", startAt: "", endAt: "", timezone: "Asia/Hong_Kong", location: "",
  contactId: "", companyId: "", dealId: "", assignedTo: "", bookingId: "", status: "scheduled", notes: "", metadata: "{}",
};
const idOf = (value) => (typeof value === "object" ? value?._id : value) || "";
const contactName = (value) => typeof value === "object" ? (value.fullName || [value.firstName, value.lastName].filter(Boolean).join(" ") || value.email || value._id) : value || "—";
const displayName = (value) => typeof value === "object" ? (value.name || value.title || value.fullName || value.email || value._id) : value || "—";
const localValue = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";

export default function Calendar() {
  const { request } = useAuth();
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [deals, setDeals] = useState([]);
  const [members, setMembers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [details, setDetails] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [googleNotice, setGoogleNotice] = useState("");

  async function loadLookups() {
    const results = await Promise.allSettled([
      request("/contacts", { query: { page: 1, limit: 100 } }),
      request("/companies", { query: { page: 1, limit: 100, isArchived: false } }),
      request("/deals", { query: { page: 1, limit: 100 } }),
      request("/members", { query: { status: "active" } }),
      request("/bookings", { query: { page: 1, limit: 100, sort: "startAt", order: "asc" } }),
    ]);
    const [c, co, d, m, b] = results;
    if (c.status === "fulfilled") setContacts(c.value.data?.items || c.value.data || []);
    if (co.status === "fulfilled") setCompanies(co.value.data?.items || co.value.data || []);
    if (d.status === "fulfilled") setDeals(d.value.data?.items || d.value.data || []);
    if (m.status === "fulfilled") setMembers(m.value.data?.items || m.value.data || []);
    if (b.status === "fulfilled") setBookings(b.value.data?.items || b.value.data || []);
  }

  async function load() {
    setLoading(true); setError("");
    try {
      const query = { page: 1, limit: 25, sort: "startAt", order: "asc" };
      if (statusFilter) query.status = statusFilter;
      const response = await request("/calendar-events", { query });
      setEvents(response.data?.items || []);
    } catch (e) { setError(e.message || "Failed to load calendar events."); setEvents([]); }
    finally { setLoading(false); }
  }
  async function loadGoogleStatus() {
    try {
      const response = await request("/integrations", { query: { limit: 100 } });
      const rows = response.data?.items || response.data || [];
      setGoogleConnected(Array.isArray(rows) && rows.some((row) => row.provider === "google_calendar" && row.status === "connected"));
    } catch {
      setGoogleConnected(false);
    }
  }

  useEffect(() => { loadLookups().catch(() => {}); loadGoogleStatus(); }, []);
  useEffect(() => { load(); }, [statusFilter]);
  useEffect(() => listenForGoogleOAuth((result) => {
    setConnectingGoogle(false);
    if (result.success) {
      setError("");
      setGoogleNotice(result.message || "Google Calendar connected.");
      loadGoogleStatus();
    } else {
      setError(result.message || "Google authorization was not completed.");
    }
  }), []);

  async function connectGoogle() {
    setConnectingGoogle(true); setError(""); setGoogleNotice("");
    try { await openGoogleOAuth(request); }
    catch (e) { setConnectingGoogle(false); setError(e.message || "Could not start Google authorization."); }
  }

  async function syncFromGoogle() {
    setSyncingGoogle(true); setError(""); setGoogleNotice("");
    try {
      const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
      const timeMax = new Date(Date.now() + 180 * 86400000).toISOString();
      const response = await request("/integrations/google/calendar/sync", {
        method: "POST",
        body: { timeMin, timeMax, maxResults: 2500 },
      });
      const result = response.data || {};
      setGoogleNotice(`Google Calendar sync complete: ${result.created || 0} created, ${result.updated || 0} updated, ${result.skipped || 0} skipped.`);
      await load();
    } catch (e) { setError(e.message || "Google Calendar sync failed."); }
    finally { setSyncingGoogle(false); }
  }

  async function syncEventToGoogle(row) {
    setError(""); setGoogleNotice("");
    try {
      const response = await request(`/integrations/google/calendar/events/${row._id}/sync`, { method: "POST" });
      setGoogleNotice(row.status === "cancelled" ? "Google Calendar event cancelled." : `Event synced to Google Calendar${response.data?.htmlLink ? "." : " successfully."}`);
      await load();
    } catch (e) { setError(e.message || "Could not sync event to Google Calendar."); }
  }

  function openCreate() { setEditingId(null); setDetails(null); setForm(blankForm); setError(""); setModal(true); }

  async function openEdit(row) {
    try {
      const response = await request(`/calendar-events/${row._id}`); const e = response.data || row;
      setDetails(null); setEditingId(e._id); setForm({
        title: e.title || "", type: e.type || "meeting", startAt: localValue(e.startAt), endAt: localValue(e.endAt), timezone: e.timezone || "Asia/Hong_Kong", location: e.location || "",
        contactId: idOf(e.contactId), companyId: idOf(e.companyId), dealId: idOf(e.dealId), assignedTo: idOf(e.assignedTo), bookingId: idOf(e.bookingId), status: e.status || "scheduled", notes: e.notes || "", metadata: JSON.stringify(e.metadata || {}, null, 2),
      }); setModal(true);
    } catch (e) { setError(e.message); }
  }

  async function openDetails(row) {
    try { const response = await request(`/calendar-events/${row._id}`); setDetails(response.data || row); }
    catch (e) { setError(e.message); }
  }

  async function save() {
    if (!form.title.trim() || !form.startAt || !form.endAt) { setError("Title, start time and end time are required."); return; }
    if (new Date(form.endAt) <= new Date(form.startAt)) { setError("End time must be after start time."); return; }
    let metadata = {};
    try { metadata = form.metadata.trim() ? JSON.parse(form.metadata) : {}; } catch { setError("Metadata must be valid JSON."); return; }
    try {
      setError("");
      const body = {
        title: form.title, type: form.type, startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString(), timezone: form.timezone,
        location: form.location, contactId: form.contactId || undefined, companyId: form.companyId || undefined, dealId: form.dealId || undefined,
        assignedTo: form.assignedTo || undefined, bookingId: form.bookingId || undefined, status: form.status, notes: form.notes, metadata,
      };
      const response = await request(editingId ? `/calendar-events/${editingId}` : "/calendar-events", { method: editingId ? "PATCH" : "POST", body });
      const savedEvent = response.data;
      setEvents((current) => editingId ? current.map((r) => r._id === editingId ? { ...r, ...savedEvent } : r) : [savedEvent, ...current]);
      setModal(false); setEditingId(null); setForm(blankForm);
      if (googleConnected && savedEvent?._id) {
        try {
          await request(`/integrations/google/calendar/events/${savedEvent._id}/sync`, { method: "POST" });
          setGoogleNotice("Calendar event saved and synced to Google Calendar.");
          await load();
        } catch (syncError) {
          setGoogleNotice(`Event saved in Banyan, but Google sync failed: ${syncError.message}`);
        }
      }
    } catch (e) { setError(e.message); }
  }

  async function remove(row) {
    if (!window.confirm(row.externalProvider === "google_calendar" ? "Cancel this event in Banyan and Google Calendar?" : "Delete calendar event?")) return;
    try {
      if (row.externalProvider === "google_calendar") {
        if (!googleConnected) throw new Error("Reconnect Google Calendar before cancelling this synced event.");
        await request(`/calendar-events/${row._id}`, { method: "PATCH", body: { status: "cancelled" } });
        await request(`/integrations/google/calendar/events/${row._id}/sync`, { method: "POST" });
      } else {
        await request(`/calendar-events/${row._id}`, { method: "DELETE" });
      }
      if (row.externalProvider === "google_calendar") {
        setEvents((current) => current.map((item) => item._id === row._id ? { ...item, status: "cancelled" } : item));
        if (details?._id === row._id) setDetails({ ...details, status: "cancelled" });
      } else {
        setEvents((current) => current.filter((r) => r._id !== row._id));
        if (details?._id === row._id) setDetails(null);
      }
    } catch (e) { setError(e.message); }
  }

  return <Page title="Calendar" kicker="Banyan & Google Calendar" actions={<>
    <Badge tone={googleConnected ? "" : "warn"}>{googleConnected ? "Google Calendar connected" : "Google not connected"}</Badge>
    <button className="btn ghost" onClick={connectGoogle} disabled={connectingGoogle}>{connectingGoogle ? "Opening Google…" : googleConnected ? "Reconnect Google" : "Connect Google"}</button>
    <button className="btn ghost" onClick={syncFromGoogle} disabled={!googleConnected || syncingGoogle}>{syncingGoogle ? "Syncing…" : "Sync from Google"}</button>
    <button className="btn primary" onClick={openCreate}>New calendar event</button>
  </>}>
    {error && <div className="notice error"><b>Calendar</b><span>{error}</span></div>}
    {googleNotice && <div className="notice"><b>Google Calendar</b><span>{googleNotice}</span></div>}
    <section className="panel booking-filters">
      <label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
      <div className="calendar-filter-note">Create, view, edit and delete events using the live <b>/calendar-events</b> API.</div>
    </section>
    <section className="panel table-wrap">
      <table><thead><tr><th>When</th><th>Event</th><th>Contact</th><th>Assigned to</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{events.map((e) => <tr key={e._id}>
          <td><b>{e.startAt ? new Date(e.startAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</b><span>{e.startAt ? new Date(e.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} – {e.endAt ? new Date(e.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span></td>
          <td><b>{e.title}</b><span>{e.type || ""}{e.location ? ` · ${e.location}` : ""}</span></td>
          <td>{contactName(e.contactId)}</td><td>{displayName(e.assignedTo)}</td><td><Badge>{e.status}</Badge></td>
          <td><div className="table-actions"><button className="btn ghost" onClick={() => openDetails(e)}>View</button><button className="btn ghost" onClick={() => openEdit(e)}>Edit</button>{googleConnected && <button className="btn ghost" onClick={() => syncEventToGoogle(e)}>{e.externalProvider === "google_calendar" ? "Sync Google" : "Sync to Google"}</button>}<button className="btn ghost" onClick={() => remove(e)}>{e.externalProvider === "google_calendar" ? "Cancel" : "Delete"}</button></div></td>
        </tr>)}</tbody>
      </table>
      {loading ? <div className="empty-state">Loading events…</div> : events.length === 0 ? <Empty text="No calendar events found." /> : null}
    </section>

    {details && <Modal title="Calendar event details" onClose={() => setDetails(null)} actions={<><button className="btn ghost" onClick={() => setDetails(null)}>Close</button><button className="btn primary" onClick={() => openEdit(details)}>Edit event</button></>}>
      <div className="detail-grid"><Detail label="Title" value={details.title}/><Detail label="Type" value={details.type}/><Detail label="Status" value={details.status}/><Detail label="Timezone" value={details.timezone}/><Detail label="Start" value={details.startAt ? new Date(details.startAt).toLocaleString() : "—"}/><Detail label="End" value={details.endAt ? new Date(details.endAt).toLocaleString() : "—"}/><Detail label="Location" value={details.location}/><Detail label="Contact" value={contactName(details.contactId)}/><Detail label="Company" value={displayName(details.companyId)}/><Detail label="Deal" value={displayName(details.dealId)}/><Detail label="Assigned to" value={displayName(details.assignedTo)}/><Detail label="Booking" value={displayName(details.bookingId)}/><div className="detail-block"><span>Notes</span><p>{details.notes || "—"}</p></div></div>
    </Modal>}

    {modal && <Modal title={editingId ? "Edit calendar event" : "New calendar event"} onClose={() => setModal(false)} actions={<><button className="btn ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn primary" onClick={save}>{editingId ? "Save changes" : "Create event"}</button></>}>
      <div className="form-grid">
        <label>Title<input value={form.title} onChange={(e) => setForm({...form,title:e.target.value})}/></label>
        <label>Type<input value={form.type} onChange={(e) => setForm({...form,type:e.target.value})}/></label>
        <label>Start<input type="datetime-local" value={form.startAt} onChange={(e) => setForm({...form,startAt:e.target.value})}/></label>
        <label>End<input type="datetime-local" value={form.endAt} onChange={(e) => setForm({...form,endAt:e.target.value})}/></label>
        <label>Timezone<input value={form.timezone} onChange={(e) => setForm({...form,timezone:e.target.value})}/></label>
        <label>Location<input value={form.location} onChange={(e) => setForm({...form,location:e.target.value})}/></label>
        <label>Contact<select value={form.contactId} onChange={(e) => setForm({...form,contactId:e.target.value})}><option value="">Select contact</option>{contacts.map((c)=><option key={c._id} value={c._id}>{contactName(c)}</option>)}</select></label>
        <label>Company<select value={form.companyId} onChange={(e) => setForm({...form,companyId:e.target.value})}><option value="">Select company</option>{companies.map((c)=><option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
        <label>Deal<select value={form.dealId} onChange={(e) => setForm({...form,dealId:e.target.value})}><option value="">Select deal</option>{deals.map((d)=><option key={d._id} value={d._id}>{displayName(d)}</option>)}</select></label>
        <label>Assigned to<select value={form.assignedTo} onChange={(e) => setForm({...form,assignedTo:e.target.value})}><option value="">Select member</option>{members.map((m)=><option key={m._id} value={m._id}>{displayName(m)}</option>)}</select></label>
        <label>Booking<select value={form.bookingId} onChange={(e) => setForm({...form,bookingId:e.target.value})}><option value="">Select booking</option>{bookings.map((b)=><option key={b._id} value={b._id}>{b.resourceName || b._id} · {b.status}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={(e) => setForm({...form,status:e.target.value})}>{STATUSES.map((s)=><option key={s} value={s}>{s}</option>)}</select></label>
        <label className="form-span-2">Notes<textarea value={form.notes} onChange={(e) => setForm({...form,notes:e.target.value})}/></label>
        <label className="form-span-2">Metadata (JSON)<textarea value={form.metadata} onChange={(e) => setForm({...form,metadata:e.target.value})}/></label>
      </div>
    </Modal>}
  </Page>;
}
function Detail({label,value}) { return <div className="detail-item"><span>{label}</span><b>{value || "—"}</b></div>; }
