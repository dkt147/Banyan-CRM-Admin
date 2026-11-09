import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";
import BookingsTabs from "../components/BookingsTabs";
import { usePermissions } from "../utils/permissions";
import { fromHkInput, hkAddDays, hkDate, hkDaysInMonth, hkParts, hkSameDay, hkStartOfDay, toHkInput } from "../utils/hkTime";
import { listenForGoogleOAuth, openGoogleOAuth } from "../utils/googleOAuth";

// Availability screen: a five-day grid of rooms, studios and holds, with room credits,
// inbound website bookings and double-booking alerts underneath. Data comes from GET /calendar/week.

// D2: the time axis is fixed. It used to be rebuilt from booking start times, so the grid
// changed shape whenever bookings were added or removed. Bookings are placed in the slot
// that contains their start time; earlier bookings go in the first slot.
const SLOT_ROWS = [9, 11, 13, 15, 18];
const WEEK_DAYS = 5;
// At most this many blocks are drawn side by side in one cell; the rest go behind "+N".
const MAX_BLOCKS_PER_CELL = 2;
const LEGEND = [
  { key: "confirmed", label: "Confirmed booking" },
  { key: "venue", label: "Venue / studio" },
  { key: "trial", label: "Trial & viewing" },
  { key: "hold", label: "Provisional hold" },
];
const STATUS_LABELS = {
  confirmed: "Confirmed",
  pending_payment: "Pending payment",
  held: "Provisional hold",
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  scheduled: "Scheduled",
};
const HIDDEN_STATUSES = ["cancelled", "expired"];
// Status filter chips; cancelled and expired start switched off (brief 6.2).
const STATUS_FILTERS = ["confirmed", "pending_payment", "held", "pending", "completed", "cancelled", "expired"];
const DEFAULT_STATUS_ON = STATUS_FILTERS.filter((s) => !HIDDEN_STATUSES.includes(s));
const OTHER_COLUMN = "__other";
const statusLabel = (status) => STATUS_LABELS[status] || status || "—";
const timeRange = (item) =>
  `${new Date(item.startAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}–${new Date(item.endAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
const VIEWS = ["Day", "Week", "Month"];
const BOOKING_TYPES = [
  ["meeting_room", "Meeting room"],
  ["day_pass", "Day pass"],
  ["studio", "Studio"],
  ["venue", "Venue"],
  ["photoshoot", "Photoshoot"],
  ["podcast", "Podcast"],
  ["event_space", "Event space"],
  ["trial", "Trial"],
  ["viewing", "Viewing"],
];
const EVENT_STATUSES = ["scheduled", "cancelled", "completed"];
const blankEventForm = {
  title: "", type: "meeting", startAt: "", endAt: "", timezone: "Asia/Hong_Kong", location: "",
  contactId: "", companyId: "", dealId: "", assignedTo: "", bookingId: "", status: "scheduled", notes: "", metadata: "{}",
};
const blankHoldForm = {
  title: "", resourceName: "", bookingType: "meeting_room", startAt: "", endAt: "",
  contactId: "", companyId: "", attendees: "", notes: "",
};

const pad = (n) => String(n).padStart(2, "0");
// All calendar date maths is in Hong Kong time, whatever the browser's time zone.
const startOfDay = hkStartOfDay;
const addDays = hkAddDays;
const sameDay = hkSameDay;
const rowLabel = (hour) => `${pad(Math.floor(hour))}:${pad(Math.round((hour % 1) * 60))}`;
const toLocalInput = (d) => toHkInput(d);
const fromLocalInput = fromHkInput;
const idOf = (value) => (typeof value === "object" ? value?._id : value) || "";
const personName = (value) =>
  typeof value === "object" && value
    ? value.fullName || [value.firstName, value.lastName].filter(Boolean).join(" ") || value.email || value._id
    : value || "";
const displayName = (value) => typeof value === "object" && value ? (value.name || value.title || value.fullName || value.email || value._id) : value || "—";
const fmtHours = (n) => String(Math.round(Number(n || 0) * 100) / 100);
const monthLong = (d) => d.toLocaleDateString("en-GB", { month: "long", timeZone: "Asia/Hong_Kong" });
const weekdayDay = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "Asia/Hong_Kong" });

function isoWeek(date) {
  const hp = hkParts(date);
  const d = new Date(Date.UTC(hp.year, hp.month - 1, hp.day));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function windowTitle(view, anchor) {
  const a = hkParts(anchor);
  if (view === "Month") return `${monthLong(anchor)} ${a.year}`;
  if (view === "Day") return anchor.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "Asia/Hong_Kong" });
  const end = addDays(anchor, WEEK_DAYS - 1);
  const e = hkParts(end);
  if (a.month === e.month) return `${a.day}–${e.day} ${monthLong(end)}`;
  return `${a.day} ${monthLong(anchor).slice(0, 3)} – ${e.day} ${monthLong(end).slice(0, 3)}`;
}

function holdExpiryText(holdExpiresAt) {
  if (!holdExpiresAt) return "";
  const expiry = new Date(holdExpiresAt);
  if (sameDay(expiry, new Date())) return "expires today";
  return `expires ${weekdayDay(expiry)}`;
}

function rowIndexFor(date, rows) {
  const p = hkParts(date);
  const hour = p.hour + p.minute / 60;
  let index = 0;
  rows.forEach((row, i) => { if (row <= hour + 1e-6) index = i; });
  return index;
}

export default function Calendar() {
  const { request } = useAuth();
  const canBook = usePermissions().can("bookings.write");
  const [view, setView] = useState("Week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [data, setData] = useState({ items: [], resources: [], credits: [], inbound: [], conflicts: [] });
  const [statusOn, setStatusOn] = useState(DEFAULT_STATUS_ON);
  const [resourceFilter, setResourceFilter] = useState("");
  const [cellList, setCellList] = useState(null);       // overflow list for one cell
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [deals, setDeals] = useState([]);
  const [members, setMembers] = useState([]);
  const [holdForm, setHoldForm] = useState(null);      // { ...blankHoldForm, hold: true }
  const [holdCheck, setHoldCheck] = useState(null);    // availability result inside the hold dialog
  const [details, setDetails] = useState(null);        // booking or calendar-event item
  const [eventForm, setEventForm] = useState(null);    // { id, values }
  const syncedOnce = useRef(false);

  const days = useMemo(() => {
    if (view === "Day") return [anchor];
    if (view === "Week") return Array.from({ length: WEEK_DAYS }, (_, i) => addDays(anchor, i));
    return [];
  }, [view, anchor]);

  const range = useMemo(() => {
    if (view === "Month") {
      const a = hkParts(anchor);
      return { start: hkDate(a.year, a.month, 1), days: hkDaysInMonth(a.year, a.month) };
    }
    return { start: anchor, days: view === "Day" ? 1 : WEEK_DAYS };
  }, [view, anchor]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("banyan:calendar-window", { detail: { week: isoWeek(anchor) } }));
  }, [anchor]);

  async function loadWeek() {
    setLoading(true); setError("");
    try {
      const response = await request("/calendar/week", {
        query: { from: range.start.toISOString(), days: range.days },
      });
      setData({ items: [], resources: [], credits: [], inbound: [], conflicts: [], ...(response.data || {}) });
    } catch (e) {
      setError(e.message || "Could not load availability.");
    } finally { setLoading(false); }
  }

  async function loadLookups() {
    const results = await Promise.allSettled([
      request("/contacts", { query: { page: 1, limit: 100 } }),
      request("/companies", { query: { page: 1, limit: 100, isArchived: false } }),
      request("/deals", { query: { page: 1, limit: 100 } }),
      request("/members", { query: { status: "active" } }),
    ]);
    const [c, co, d, m] = results;
    if (c.status === "fulfilled") setContacts(c.value.data?.items || c.value.data || []);
    if (co.status === "fulfilled") setCompanies(co.value.data?.items || co.value.data || []);
    if (d.status === "fulfilled") setDeals(d.value.data?.items || d.value.data || []);
    if (m.status === "fulfilled") setMembers(m.value.data?.items || m.value.data || []);
  }

  async function loadGoogleStatus() {
    try {
      const response = await request("/integrations", { query: { limit: 100 } });
      const rows = response.data?.items || response.data || [];
      const connected = Array.isArray(rows) && rows.some((row) => row.provider === "google_calendar" && row.status === "connected");
      setGoogleConnected(connected);
      return connected;
    } catch {
      setGoogleConnected(false);
      return false;
    }
  }

  async function syncFromGoogle({ silent = false } = {}) {
    if (!silent) setNotice("");
    try {
      const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
      const timeMax = new Date(Date.now() + 180 * 86400000).toISOString();
      const response = await request("/integrations/google/calendar/sync", {
        method: "POST", body: { timeMin, timeMax, maxResults: 2500 },
      });
      const result = response.data || {};
      if (!silent) setNotice(`Google Calendar synced: ${result.created || 0} created, ${result.updated || 0} updated.`);
      await loadWeek();
    } catch (e) {
      if (!silent) setError(e.message || "Google Calendar sync failed.");
    }
  }

  useEffect(() => { loadLookups().catch(() => {}); loadGoogleStatus().then((connected) => {
    if (connected && !syncedOnce.current) { syncedOnce.current = true; syncFromGoogle({ silent: true }); }
  }); }, []);
  useEffect(() => { loadWeek(); }, [range.start.getTime(), range.days]);
  useEffect(() => listenForGoogleOAuth((result) => {
    setConnectingGoogle(false);
    if (result.success) { setError(""); setNotice(result.message || "Google Calendar connected."); loadGoogleStatus(); }
    else setError(result.message || "Google authorization was not completed.");
  }), []);

  async function connectGoogle() {
    setConnectingGoogle(true); setError("");
    try { await openGoogleOAuth(request); }
    catch (e) { setConnectingGoogle(false); setError(e.message || "Could not start Google authorization."); }
  }

  // Grid: rows come from SLOT_ROWS and columns from the date range, never from the data.
  const rows = SLOT_ROWS;
  const visibleItems = useMemo(
    () => data.items.filter((item) =>
      (item.kind !== "booking" || statusOn.includes(item.status) || !STATUS_FILTERS.includes(item.status)) &&
      (!resourceFilter || item.resourceName === resourceFilter)),
    [data.items, statusOn, resourceFilter],
  );
  const statusCounts = useMemo(() => {
    const counts = {};
    data.items.forEach((item) => { if (item.kind === "booking") counts[item.status] = (counts[item.status] || 0) + 1; });
    return counts;
  }, [data.items]);
  // Columns: days in Week view; in Day view one column per configured resource plus an
  // "Other" column. Both come from the date range and the resource list, never from
  // the bookings returned (brief 6.2).
  const configuredResources = useMemo(() => (data.resources || []).filter((r) => r.configured), [data.resources]);
  const columns = useMemo(() => {
    if (view !== "Day") return days.map((day) => ({ key: day.toISOString(), day, label: weekdayDay(day), today: sameDay(day, new Date()) }));
    return [
      ...configuredResources.map((r) => ({ key: r.name, day: anchor, resourceName: r.name, label: r.name, sub: r.type ? r.type.replace(/_/g, " ") : "" })),
      { key: OTHER_COLUMN, day: anchor, resourceName: "", label: configuredResources.length ? "Other / unassigned" : "All bookings", sub: weekdayDay(anchor) },
    ];
  }, [view, days, anchor, configuredResources]);
  const cellItems = useMemo(() => {
    const map = new Map();
    const names = new Set(configuredResources.map((r) => r.name));
    visibleItems.forEach((item) => {
      const start = new Date(item.startAt);
      let colIndex;
      if (view === "Day") {
        if (!sameDay(anchor, start)) return;
        colIndex = names.has(item.resourceName) ? columns.findIndex((c) => c.key === item.resourceName) : columns.length - 1;
      } else {
        colIndex = columns.findIndex((c) => sameDay(c.day, start));
      }
      if (colIndex < 0) return;
      const key = `${colIndex}|${rowIndexFor(start, rows)}`;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [visibleItems, columns, rows, view, anchor, configuredResources]);

  function openHoldAt(day, hour, resourceName = "") {
    // `day` is Hong Kong midnight; HK has no daylight saving, so hours add exactly.
    const start = new Date(hkStartOfDay(day).getTime() + Math.round(hour * 60) * 60000);
    const end = new Date(start.getTime() + 2 * 3600000);
    setHoldCheck(null); setError("");
    setHoldForm({ ...blankHoldForm, resourceName, startAt: toLocalInput(start), endAt: toLocalInput(end) });
  }

  function openNewHold() {
    const now = hkParts(new Date());
    const start = hkDate(now.year, now.month, now.day, now.hour + 1);
    openHoldAt(start, hkParts(start).hour);
  }

  async function checkAvailability() {
    const start = fromLocalInput(holdForm.startAt), end = fromLocalInput(holdForm.endAt);
    if (!start || !end || end <= start) { setHoldCheck({ ok: false, text: "Pick a start and an end time after it." }); return; }
    try {
      const query = { startAt: start.toISOString(), endAt: end.toISOString() };
      if (holdForm.resourceName) query.resourceName = holdForm.resourceName;
      const response = await request("/calendar/availability", { query });
      const available = response.data?.available;
      setHoldCheck({ ok: available, text: available ? "Free for this time." : `Taken: ${(response.data?.conflicts || []).map((c) => c.title || c.resourceName || c.bookingType).join(", ")}` });
    } catch (e) { setHoldCheck({ ok: false, text: e.message }); }
  }

  async function placeHold({ confirm = false } = {}) {
    const start = fromLocalInput(holdForm.startAt), end = fromLocalInput(holdForm.endAt);
    if (!holdForm.title.trim() && !holdForm.resourceName.trim()) { setHoldCheck({ ok: false, text: "Add a title or a room name." }); return; }
    if (!start || !end || end <= start) { setHoldCheck({ ok: false, text: "Pick a start and an end time after it." }); return; }
    if (!holdForm.contactId) { setHoldCheck({ ok: false, text: "Select the contact this booking is for." }); return; }
    try {
      const body = {
        title: holdForm.title.trim() || holdForm.resourceName.trim(),
        resourceName: holdForm.resourceName.trim() || undefined,
        bookingType: holdForm.bookingType,
        startAt: start.toISOString(), endAt: end.toISOString(),
        contactId: holdForm.contactId || undefined, companyId: holdForm.companyId || undefined,
        attendees: holdForm.attendees ? Number(holdForm.attendees) : undefined,
        notes: holdForm.notes || undefined,
        source: "manual",
      };
      const response = await request("/calendar/hold", { method: "POST", body });
      if (confirm) await request(`/calendar/${response.data._id}/confirm`, { method: "PATCH" });
      setHoldForm(null); setHoldCheck(null);
      setNotice(confirm ? "Booking confirmed." : "Slot held. Confirm it before the hold expires.");
      await loadWeek();
    } catch (e) {
      setHoldCheck({ ok: false, text: e.status === 409 ? "That slot was just taken — pick another time." : e.message });
    }
  }

  async function releaseHold(conflict) {
    if (!conflict.releaseId) return;
    try {
      await request(`/calendar/${conflict.releaseId}/cancel`, { method: "PATCH" });
      setNotice("Hold released. The other booking keeps the room.");
      await loadWeek();
    } catch (e) { setError(e.message || "Could not release the hold."); }
  }

  async function openItem(item) {
    if (item.kind === "booking") { setDetails(item); return; }
    try {
      const response = await request(`/calendar-events/${item.id}`);
      setDetails({ ...item, event: response.data || null });
    } catch (e) { setError(e.message); }
  }

  async function confirmBooking(item) {
    try {
      await request(`/calendar/${item.id}/confirm`, { method: "PATCH" });
      setDetails(null); setNotice("Booking confirmed."); await loadWeek();
    } catch (e) { setError(e.message); }
  }

  async function cancelBooking(item) {
    if (!window.confirm("Cancel this booking and free the room?")) return;
    try {
      await request(`/calendar/${item.id}/cancel`, { method: "PATCH" });
      setDetails(null); setNotice("Booking cancelled."); await loadWeek();
    } catch (e) { setError(e.message); }
  }

  function editEvent(event) {
    setDetails(null);
    setEventForm({
      id: event._id,
      values: {
        title: event.title || "", type: event.type || "meeting", startAt: toLocalInput(new Date(event.startAt)), endAt: toLocalInput(new Date(event.endAt)),
        timezone: event.timezone || "Asia/Hong_Kong", location: event.location || "", contactId: idOf(event.contactId), companyId: idOf(event.companyId),
        dealId: idOf(event.dealId), assignedTo: idOf(event.assignedTo), bookingId: idOf(event.bookingId), status: event.status || "scheduled",
        notes: event.notes || "", metadata: JSON.stringify(event.metadata || {}, null, 2),
      },
    });
  }

  async function saveEvent() {
    const f = eventForm.values;
    if (!f.title.trim() || !f.startAt || !f.endAt) { setError("Title, start time and end time are required."); return; }
    if (fromHkInput(f.endAt) <= fromHkInput(f.startAt)) { setError("End time must be after start time."); return; }
    let metadata = {};
    try { metadata = f.metadata.trim() ? JSON.parse(f.metadata) : {}; } catch { setError("Metadata must be valid JSON."); return; }
    try {
      setError("");
      const body = {
        title: f.title, type: f.type, startAt: fromHkInput(f.startAt).toISOString(), endAt: fromHkInput(f.endAt).toISOString(), timezone: f.timezone,
        location: f.location, contactId: f.contactId || undefined, companyId: f.companyId || undefined, dealId: f.dealId || undefined,
        assignedTo: f.assignedTo || undefined, bookingId: f.bookingId || undefined, status: f.status, notes: f.notes, metadata,
      };
      const response = await request(eventForm.id ? `/calendar-events/${eventForm.id}` : "/calendar-events", { method: eventForm.id ? "PATCH" : "POST", body });
      setEventForm(null);
      if (googleConnected && response.data?._id) {
        try {
          await request(`/integrations/google/calendar/events/${response.data._id}/sync`, { method: "POST" });
          setNotice("Calendar event saved and synced to Google Calendar.");
        } catch (syncError) { setNotice(`Event saved in Banyan, but Google sync failed: ${syncError.message}`); }
      } else setNotice("Calendar event saved.");
      await loadWeek();
    } catch (e) { setError(e.message); }
  }

  async function removeEvent(event) {
    const synced = event.externalProvider === "google_calendar";
    if (!window.confirm(synced ? "Cancel this event in Banyan and Google Calendar?" : "Delete calendar event?")) return;
    try {
      if (synced) {
        if (!googleConnected) throw new Error("Reconnect Google Calendar before cancelling this synced event.");
        await request(`/calendar-events/${event._id}`, { method: "PATCH", body: { status: "cancelled" } });
        await request(`/integrations/google/calendar/events/${event._id}/sync`, { method: "POST" });
      } else {
        await request(`/calendar-events/${event._id}`, { method: "DELETE" });
      }
      setDetails(null); await loadWeek();
    } catch (e) { setError(e.message); }
  }

  function step(direction) {
    const unit = view === "Month" ? null : view === "Day" ? 1 : WEEK_DAYS;
    setAnchor((current) => unit
      ? addDays(current, unit * direction)
      : (() => { const c = hkParts(current); return hkDate(c.year, c.month + direction, 1); })());
  }

  // Month grid: Monday-first weeks covering the whole month.
  const monthWeeks = useMemo(() => {
    if (view !== "Month") return [];
    const a = hkParts(anchor);
    const first = hkDate(a.year, a.month, 1);
    const offset = (hkParts(first).weekday + 6) % 7;
    const start = addDays(first, -offset);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const lastIndex = cells.findLastIndex((d) => hkParts(d).month === a.month);
    const count = Math.max(4, Math.ceil((lastIndex + 1) / 7)) * 7;
    return Array.from({ length: count / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }, [view, anchor]);

  const itemsOnDay = (day) => visibleItems.filter((item) => sameDay(new Date(item.startAt), day));
  const resourceOptions = useMemo(
    () => [...new Set([...(data.resources || []).map((r) => r.name), ...data.items.map((i) => i.resourceName)].filter(Boolean))],
    [data.resources, data.items],
  );
  const isEmptyWeek = !loading && visibleItems.length === 0;
  const statusLine = loading
    ? "Loading availability…"
    : isEmptyWeek
      ? "Nothing booked in this window. Click an empty slot to hold it."
      : "";

  function renderBlock(item) {
    const isHold = item.category === "hold";
    const sub = isHold ? holdExpiryText(item.holdExpiresAt) : item.subtitle;
    const showStatus = item.status && item.status !== "confirmed" && item.status !== "scheduled" && !(isHold && item.status === "held");
    return <button key={item.id} type="button"
      className={`av-block av-block-${item.category} av-status-${item.status}`}
      onClick={(e) => { e.stopPropagation(); openItem(item); }}
      title={`${item.title} · ${timeRange(item)} · ${statusLabel(item.status)}`}>
      <b>{item.title}</b>
      {(showStatus || sub) && <span>{showStatus && <em className="av-status-label">{statusLabel(item.status)}</em>}{showStatus && sub ? " · " : ""}{sub}</span>}
    </button>;
  }

  return <div className="av-page">
    <BookingsTabs active="calendar" />
    <header className="av-head">
      <div>
        <span className="av-kicker">
          {googleConnected ? "Two-way sync with Google Calendar" : "Google Calendar not connected"}
          {!googleConnected && <button type="button" className="av-link" onClick={connectGoogle} disabled={connectingGoogle}>{connectingGoogle ? "Opening Google…" : "Connect"}</button>}
        </span>
        <h1>Availability · {windowTitle(view, anchor)}</h1>
      </div>
      <div className="av-head-actions">
        <div className="av-seg" role="tablist" aria-label="View">
          {VIEWS.map((v) => <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "active" : ""} onClick={() => setView(v)}>{v}</button>)}
        </div>
        {canBook && <button type="button" className="av-primary" onClick={openNewHold}>Check &amp; hold a slot</button>}
      </div>
    </header>

    <div className="av-toolbar">
      <div className="av-legend">
        {LEGEND.map((item) => <span key={item.key}><i className={`av-swatch av-swatch-${item.key}`} />{item.label}</span>)}
        <span><i className="av-swatch av-swatch-pending_payment" />Pending payment</span>
      </div>
      <div className="av-nav">
        <button type="button" onClick={() => step(-1)} aria-label="Previous"><Icon name="CaretLeft" size={14} /></button>
        <button type="button" onClick={() => setAnchor(startOfDay(new Date()))}>Today</button>
        <button type="button" onClick={() => step(1)} aria-label="Next"><Icon name="CaretRight" size={14} /></button>
      </div>
    </div>

    {/* Filters sit on their own fixed-height row so nothing above the grid depends on data. */}
    <div className="av-filters">
      <div className="av-status-chips" role="group" aria-label="Booking status">
        {STATUS_FILTERS.map((s) => {
          const on = statusOn.includes(s);
          return <button key={s} type="button" aria-pressed={on} title={`${statusCounts[s] || 0} in this window`}
            className={`av-status-chip av-status-${s} ${on ? "on" : ""}`}
            onClick={() => setStatusOn(on ? statusOn.filter((x) => x !== s) : [...statusOn, s])}>{statusLabel(s)}</button>;
        })}
      </div>
      <select aria-label="Resource" value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)}>
        <option value="">All resources</option>
        {resourceOptions.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </div>

    {error && <div className="av-notice av-notice-error"><b>Availability</b><span>{error}</span></div>}
    {notice && <div className="av-notice"><b>Update</b><span>{notice}</span></div>}

    {view !== "Month" ? <section className="av-grid-wrap">
      <div className="av-grid" style={{ gridTemplateColumns: `62px repeat(${columns.length}, minmax(0, 1fr))` }}>
        <div className="av-corner" />
        {columns.map((col) => <div key={col.key} className="av-dayhead">
          <b>{col.label}</b>
          {col.today ? <span>Today</span> : col.sub ? <span>{col.sub}</span> : null}
        </div>)}
        {rows.map((row, ri) => <React.Fragment key={`row-${row}`}>
          <div className="av-time">{rowLabel(row)}</div>
          {columns.map((col, di) => {
            const day = col.day;
            const items = cellItems.get(`${di}|${ri}`) || [];
            const shown = items.length > MAX_BLOCKS_PER_CELL ? items.slice(0, MAX_BLOCKS_PER_CELL - 1) : items;
            const more = items.length - shown.length;
            return <div key={`${di}-${ri}`} className={`av-cell ${items.length ? "has-items" : ""}`} onClick={() => canBook && items.length === 0 && openHoldAt(day, row, col.resourceName || "")}>
              {shown.map(renderBlock)}
              {more > 0 && <button type="button" className="av-more" onClick={(e) => { e.stopPropagation(); setCellList({ day, row, items }); }}>+{more}</button>}
            </div>;
          })}
        </React.Fragment>)}
      </div>
      {/* Always rendered with a fixed height so the page below never shifts. */}
      <div className="av-status-line" aria-live="polite">{statusLine}</div>
    </section> : <section className="av-month">
      <div className="av-month-days">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}</div>
      {monthWeeks.map((week) => <div key={week[0].toISOString()} className="av-month-row">
        {week.map((day) => {
          const items = itemsOnDay(day);
          const outside = hkParts(day).month !== hkParts(anchor).month;
          return <button key={day.toISOString()} type="button" className={`av-month-cell ${outside ? "outside" : ""} ${sameDay(day, new Date()) ? "today" : ""}`} onClick={() => { setAnchor(day); setView("Day"); }}>
            <b>{hkParts(day).day}</b>
            {items.slice(0, 3).map((item) => <span key={item.id} className={`av-chip av-block-${item.category} av-status-${item.status}`}>{item.title}</span>)}
            {items.length > 3 && <small>+{items.length - 3} more</small>}
          </button>;
        })}
      </div>)}
    </section>}

    <section className="av-bottom">
      <div className="av-card">
        <h3>Meeting room credits</h3>
        {data.credits.length === 0 && <p className="av-muted">No credit allowances set up yet.</p>}
        {data.credits.map((account) => <div key={account.id} className="av-credit">
          <div className="av-credit-row"><span>{account.name}</span><em>{fmtHours(account.usedHours)} / {account.limitHours} hrs</em></div>
          <div className="av-bar"><i className={account.approachingLimit ? "warn" : ""} style={{ width: `${Math.min(100, account.ratio * 100)}%` }} /></div>
          {account.approachingLimit && <small className="av-warn">Approaching the limit — offer a top-up</small>}
        </div>)}
      </div>

      <div className="av-card">
        <h3>Inbound bookings</h3>
        <p className="av-muted">When the website booking platform goes live, confirmations arrive here and create the contact and deal automatically.</p>
        {data.inbound.length === 0 && <p className="av-muted">No website bookings in the last 14 days.</p>}
        {data.inbound.map((row) => <div key={row.id} className="av-inbound">
          <span>{row.label}</span><em className={row.isNewContact ? "new" : ""}>{row.status}</em>
        </div>)}
      </div>

      {data.conflicts.length > 0 ? <div className="av-card av-card-sage">
        <h3><Icon name="WarningDiamond" size={16} /> Double-booking prevented</h3>
        {data.conflicts.map((conflict) => <div key={conflict.id} className="av-conflict">
          <p>{conflict.message}</p>
          {canBook && conflict.releaseId && <button type="button" className="av-primary small" onClick={() => releaseHold(conflict)}>Resolve</button>}
        </div>)}
      </div> : <div className="av-card av-card-sage">
        <h3><Icon name="ShieldCheck" size={16} /> No double-bookings</h3>
        <p className="av-muted">Every room in this window has one booking at a time. Overlaps from the website or Google Calendar will appear here.</p>
      </div>}
    </section>

    {details && details.kind === "booking" && <Modal title={details.title} onClose={() => setDetails(null)} actions={<>
      <Link className="btn ghost" to={recordHref.booking(details.id)}>Open booking</Link>
      {canBook && !HIDDEN_STATUSES.includes(details.status) && details.status !== "completed" && <button className="btn ghost" onClick={() => cancelBooking(details)}>Cancel booking</button>}
      {canBook && ["held", "pending", "pending_payment"].includes(details.status) && <button className="btn primary" onClick={() => confirmBooking(details)}>Confirm booking</button>}
    </>}>
      <div className="detail-grid">
        <Detail label="Room" value={details.resourceName} />
        <Detail label="Type" value={bookingTypeLabel(details.bookingType)} />
        <Detail label="Status" value={details.status === "held" ? `Provisional hold · ${holdExpiryText(details.holdExpiresAt)}` : statusLabel(details.status)} />
        <Detail label="Contact" value={details.contactId ? <Link to={recordHref.contact(details.contactId)}>{details.contactName || "Open contact"}</Link> : "Not linked"} />
        <Detail label="Payment" value={{ not_required: "Not required", unpaid: "Unpaid", paid: "Paid", refunded: "Refunded", failed: "Failed" }[details.paymentStatus] || "—"} />
        {details.holdExpiresAt && ["held", "pending_payment"].includes(details.rawStatus) && <Detail label="Hold expires" value={new Date(details.holdExpiresAt).toLocaleString()} />}
        <Detail label="Who" value={details.subtitle} />
        <Detail label="Start" value={new Date(details.startAt).toLocaleString()} />
        <Detail label="End" value={new Date(details.endAt).toLocaleString()} />
      </div>
    </Modal>}

    {details && details.kind === "event" && <Modal title={details.title} onClose={() => setDetails(null)} actions={<>
      {canBook && <button className="btn ghost" onClick={() => removeEvent(details.event || { _id: details.id, externalProvider: "" })}>{details.source === "google" ? "Cancel" : "Delete"}</button>}
      {canBook && details.event && <button className="btn primary" onClick={() => editEvent(details.event)}>Edit event</button>}
    </>}>
      <div className="detail-grid">
        <Detail label="Type" value={details.bookingType} />
        <Detail label="Status" value={details.status} />
        <Detail label="Location" value={details.resourceName} />
        <Detail label="Start" value={new Date(details.startAt).toLocaleString()} />
        <Detail label="End" value={new Date(details.endAt).toLocaleString()} />
        <Detail label="Contact" value={idOf(details.event?.contactId) ? <Link to={recordHref.contact(idOf(details.event.contactId))}>{personName(details.event.contactId)}</Link> : "Not linked"} />
        <Detail label="Notes" value={details.event?.notes} />
      </div>
    </Modal>}

    {cellList && <Modal title={`${weekdayDay(cellList.day)} · ${rowLabel(cellList.row)}`} onClose={() => setCellList(null)}>
      <div className="av-cell-list">
        {cellList.items.map((item) => <button key={item.id} type="button" className={`av-block av-block-${item.category} av-status-${item.status}`} onClick={() => { setCellList(null); openItem(item); }}>
          <b>{item.title}</b>
          <span>{timeRange(item)} · {statusLabel(item.status)}{item.subtitle ? ` · ${item.subtitle}` : ""}</span>
        </button>)}
      </div>
    </Modal>}

    {holdForm && <Modal title="Check & hold a slot" onClose={() => setHoldForm(null)} actions={<>
      <button className="btn ghost" onClick={() => setHoldForm(null)}>Cancel</button>
      <button className="btn ghost" onClick={() => placeHold({ confirm: false })}>Hold</button>
      <button className="btn primary" onClick={() => placeHold({ confirm: true })}>Book &amp; confirm</button>
    </>}>
      <div className="form-grid">
        <label>Title<input value={holdForm.title} onChange={(e) => setHoldForm({ ...holdForm, title: e.target.value })} placeholder="e.g. Aurora launch setup" /></label>
        <label>Room / resource<input list="av-resources" value={holdForm.resourceName} onChange={(e) => setHoldForm({ ...holdForm, resourceName: e.target.value })} placeholder="Harbour Room" />
          <datalist id="av-resources">{resourceOptions.map((r) => <option key={r} value={r} />)}</datalist></label>
        <label>Type<select value={holdForm.bookingType} onChange={(e) => setHoldForm({ ...holdForm, bookingType: e.target.value })}>{BOOKING_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Attendees<input type="number" min="0" value={holdForm.attendees} onChange={(e) => setHoldForm({ ...holdForm, attendees: e.target.value })} /></label>
        <label>Start<input type="datetime-local" value={holdForm.startAt} onChange={(e) => { setHoldCheck(null); setHoldForm({ ...holdForm, startAt: e.target.value }); }} /></label>
        <label>End<input type="datetime-local" value={holdForm.endAt} onChange={(e) => { setHoldCheck(null); setHoldForm({ ...holdForm, endAt: e.target.value }); }} /></label>
        <label>Contact<span className="required-mark"> *</span><select value={holdForm.contactId} onChange={(e) => setHoldForm({ ...holdForm, contactId: e.target.value })}><option value="">Select contact</option>{contacts.map((c) => <option key={c._id} value={c._id}>{personName(c)}</option>)}</select></label>
        <label>Company<select value={holdForm.companyId} onChange={(e) => setHoldForm({ ...holdForm, companyId: e.target.value })}><option value="">No company</option>{companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
        <label className="form-span-2">Notes<textarea value={holdForm.notes} onChange={(e) => setHoldForm({ ...holdForm, notes: e.target.value })} /></label>
      </div>
      <div className="av-check">
        <button type="button" className="btn ghost" onClick={checkAvailability}>Check availability</button>
        {holdCheck && <span className={holdCheck.ok ? "av-ok" : "av-warn"}>{holdCheck.text}</span>}
        <button type="button" className="av-link" onClick={() => { setHoldForm(null); setEventForm({ id: null, values: { ...blankEventForm, startAt: holdForm.startAt, endAt: holdForm.endAt, title: holdForm.title } }); }}>Create calendar event instead</button>
      </div>
    </Modal>}

    {eventForm && <Modal title={eventForm.id ? "Edit calendar event" : "New calendar event"} onClose={() => setEventForm(null)} actions={<>
      <button className="btn ghost" onClick={() => setEventForm(null)}>Cancel</button>
      <button className="btn primary" onClick={saveEvent}>{eventForm.id ? "Save changes" : "Create event"}</button>
    </>}>
      <div className="form-grid">
        {[["title", "Title"], ["type", "Type"], ["startAt", "Start", "datetime-local"], ["endAt", "End", "datetime-local"], ["timezone", "Timezone"], ["location", "Location"]].map(([key, label, type]) =>
          <label key={key}>{label}<input type={type || "text"} value={eventForm.values[key]} onChange={(e) => setEventForm({ ...eventForm, values: { ...eventForm.values, [key]: e.target.value } })} /></label>)}
        <label>Contact<select value={eventForm.values.contactId} onChange={(e) => setEventForm({ ...eventForm, values: { ...eventForm.values, contactId: e.target.value } })}><option value="">Select contact</option>{contacts.map((c) => <option key={c._id} value={c._id}>{personName(c)}</option>)}</select></label>
        <label>Company<select value={eventForm.values.companyId} onChange={(e) => setEventForm({ ...eventForm, values: { ...eventForm.values, companyId: e.target.value } })}><option value="">Select company</option>{companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
        <label>Deal<select value={eventForm.values.dealId} onChange={(e) => setEventForm({ ...eventForm, values: { ...eventForm.values, dealId: e.target.value } })}><option value="">Select deal</option>{deals.map((d) => <option key={d._id} value={d._id}>{displayName(d)}</option>)}</select></label>
        <label>Assigned to<select value={eventForm.values.assignedTo} onChange={(e) => setEventForm({ ...eventForm, values: { ...eventForm.values, assignedTo: e.target.value } })}><option value="">Select member</option>{members.map((m) => <option key={m._id} value={m._id}>{displayName(m)}</option>)}</select></label>
        <label>Status<select value={eventForm.values.status} onChange={(e) => setEventForm({ ...eventForm, values: { ...eventForm.values, status: e.target.value } })}>{EVENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="form-span-2">Notes<textarea value={eventForm.values.notes} onChange={(e) => setEventForm({ ...eventForm, values: { ...eventForm.values, notes: e.target.value } })} /></label>
      </div>
    </Modal>}
  </div>;
}

function bookingTypeLabel(type) {
  const found = BOOKING_TYPES.find(([value]) => value === type);
  return found ? found[1] : type || "—";
}

function Detail({ label, value }) {
  return <div className="detail-item"><span>{label}</span><b>{value || "—"}</b></div>;
}
