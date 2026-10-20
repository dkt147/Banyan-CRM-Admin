import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
import { listenForGoogleOAuth, openGoogleOAuth } from "../utils/googleOAuth";

// Availability screen: a five-day grid of rooms, studios and holds, with room credits,
// inbound website bookings and double-booking alerts underneath. Data comes from GET /calendar/week.

const DEFAULT_ROWS = [9, 11, 13, 15, 18];
const WEEK_DAYS = 5;
const LEGEND = [
  { key: "confirmed", label: "Confirmed booking" },
  { key: "venue", label: "Venue / studio" },
  { key: "trial", label: "Trial & viewing" },
  { key: "hold", label: "Provisional hold" },
];
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
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const rowLabel = (hour) => `${pad(Math.floor(hour))}:${pad(Math.round((hour % 1) * 60))}`;
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fromLocalInput = (value) => (value ? new Date(value) : null);
const idOf = (value) => (typeof value === "object" ? value?._id : value) || "";
const personName = (value) =>
  typeof value === "object" && value
    ? value.fullName || [value.firstName, value.lastName].filter(Boolean).join(" ") || value.email || value._id
    : value || "";
const displayName = (value) => typeof value === "object" && value ? (value.name || value.title || value.fullName || value.email || value._id) : value || "—";
const fmtHours = (n) => String(Math.round(Number(n || 0) * 100) / 100);
const monthLong = (d) => d.toLocaleDateString("en-GB", { month: "long" });
const weekdayDay = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function windowTitle(view, anchor) {
  if (view === "Month") return `${monthLong(anchor)} ${anchor.getFullYear()}`;
  if (view === "Day") return anchor.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
  const end = addDays(anchor, WEEK_DAYS - 1);
  if (anchor.getMonth() === end.getMonth()) return `${anchor.getDate()}–${end.getDate()} ${monthLong(end)}`;
  return `${anchor.getDate()} ${monthLong(anchor).slice(0, 3)} – ${end.getDate()} ${monthLong(end).slice(0, 3)}`;
}

function holdExpiryText(holdExpiresAt) {
  if (!holdExpiresAt) return "";
  const expiry = new Date(holdExpiresAt);
  if (sameDay(expiry, new Date())) return "expires today";
  return `expires ${weekdayDay(expiry)}`;
}

function buildRows(items, days) {
  const hours = new Set();
  items.forEach((item) => {
    const start = new Date(item.startAt);
    if (days.some((d) => sameDay(d, start))) hours.add(start.getHours() + start.getMinutes() / 60);
  });
  if (hours.size === 0) return DEFAULT_ROWS;
  return [...hours].sort((a, b) => a - b);
}

function rowIndexFor(date, rows) {
  const hour = date.getHours() + date.getMinutes() / 60;
  let index = 0;
  rows.forEach((row, i) => { if (row <= hour + 1e-6) index = i; });
  return index;
}

export default function Calendar() {
  const { request } = useAuth();
  const [view, setView] = useState("Week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [data, setData] = useState({ items: [], credits: [], inbound: [], conflicts: [] });
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
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
      return { start, days: count };
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
      setData({ items: [], credits: [], inbound: [], conflicts: [], ...(response.data || {}) });
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

  // Grid
  const rows = useMemo(() => buildRows(data.items, days), [data.items, days]);
  const cellItems = useMemo(() => {
    const map = new Map();
    data.items.forEach((item) => {
      const start = new Date(item.startAt);
      const dayIndex = days.findIndex((d) => sameDay(d, start));
      if (dayIndex < 0) return;
      const key = `${dayIndex}|${rowIndexFor(start, rows)}`;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [data.items, days, rows]);

  function openHoldAt(day, hour) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(hour), Math.round((hour % 1) * 60));
    const end = new Date(start.getTime() + 2 * 3600000);
    setHoldCheck(null); setError("");
    setHoldForm({ ...blankHoldForm, startAt: toLocalInput(start), endAt: toLocalInput(end) });
  }

  function openNewHold() {
    const start = new Date(); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1);
    openHoldAt(start, start.getHours());
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
    if (new Date(f.endAt) <= new Date(f.startAt)) { setError("End time must be after start time."); return; }
    let metadata = {};
    try { metadata = f.metadata.trim() ? JSON.parse(f.metadata) : {}; } catch { setError("Metadata must be valid JSON."); return; }
    try {
      setError("");
      const body = {
        title: f.title, type: f.type, startAt: new Date(f.startAt).toISOString(), endAt: new Date(f.endAt).toISOString(), timezone: f.timezone,
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
      : new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  // Month grid: Monday-first weeks covering the whole month.
  const monthWeeks = useMemo(() => {
    if (view !== "Month") return [];
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = addDays(first, -offset);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const lastIndex = cells.findLastIndex((d) => d.getMonth() === anchor.getMonth());
    const count = Math.max(4, Math.ceil((lastIndex + 1) / 7)) * 7;
    return Array.from({ length: count / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }, [view, anchor]);

  const itemsOnDay = (day) => data.items.filter((item) => sameDay(new Date(item.startAt), day));
  const resourceOptions = useMemo(() => [...new Set(data.items.map((i) => i.resourceName).filter(Boolean))], [data.items]);
  const isEmptyWeek = !loading && data.items.length === 0;

  return <div className="av-page">
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
        <button type="button" className="av-primary" onClick={openNewHold}>Check &amp; hold a slot</button>
      </div>
    </header>

    <div className="av-toolbar">
      <div className="av-legend">
        {LEGEND.map((item) => <span key={item.key}><i className={`av-swatch av-swatch-${item.key}`} />{item.label}</span>)}
      </div>
      <div className="av-nav">
        <button type="button" onClick={() => step(-1)} aria-label="Previous"><Icon name="CaretLeft" size={14} /></button>
        <button type="button" onClick={() => setAnchor(startOfDay(new Date()))}>Today</button>
        <button type="button" onClick={() => step(1)} aria-label="Next"><Icon name="CaretRight" size={14} /></button>
      </div>
    </div>

    {error && <div className="av-notice av-notice-error"><b>Availability</b><span>{error}</span></div>}
    {notice && <div className="av-notice"><b>Update</b><span>{notice}</span></div>}

    {view !== "Month" ? <section className="av-grid-wrap">
      <div className="av-grid" style={{ gridTemplateColumns: `62px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="av-corner" />
        {days.map((day) => <div key={day.toISOString()} className="av-dayhead">
          <b>{weekdayDay(day)}</b>
          {sameDay(day, new Date()) && <span>Today</span>}
        </div>)}
        {rows.map((row, ri) => <React.Fragment key={`row-${row}`}>
          <div className="av-time">{rowLabel(row)}</div>
          {days.map((day, di) => {
            const items = cellItems.get(`${di}|${ri}`) || [];
            return <div key={`${di}-${ri}`} className="av-cell" onClick={() => items.length === 0 && openHoldAt(day, row)}>
              {items.map((item) => {
                const isHold = item.category === "hold";
                const sub = isHold ? holdExpiryText(item.holdExpiresAt) : item.subtitle;
                return <button key={item.id} type="button" className={`av-block av-block-${item.category}`} onClick={(e) => { e.stopPropagation(); openItem(item); }} title={item.title}>
                  <b>{item.title}</b>
                  {sub && <span>{sub}</span>}
                </button>;
              })}
            </div>;
          })}
        </React.Fragment>)}
      </div>
      {isEmptyWeek && <div className="av-empty">Nothing booked in this window. Click an empty slot to hold it.</div>}
      {loading && <div className="av-loading">Loading availability…</div>}
    </section> : <section className="av-month">
      <div className="av-month-days">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}</div>
      {monthWeeks.map((week) => <div key={week[0].toISOString()} className="av-month-row">
        {week.map((day) => {
          const items = itemsOnDay(day);
          const outside = day.getMonth() !== anchor.getMonth();
          return <button key={day.toISOString()} type="button" className={`av-month-cell ${outside ? "outside" : ""} ${sameDay(day, new Date()) ? "today" : ""}`} onClick={() => { setAnchor(day); setView("Day"); }}>
            <b>{day.getDate()}</b>
            {items.slice(0, 3).map((item) => <span key={item.id} className={`av-chip av-block-${item.category}`}>{item.title}</span>)}
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
          {conflict.releaseId && <button type="button" className="av-primary small" onClick={() => releaseHold(conflict)}>Resolve</button>}
        </div>)}
      </div> : <div className="av-card av-card-sage">
        <h3><Icon name="ShieldCheck" size={16} /> No double-bookings</h3>
        <p className="av-muted">Every room in this window has one booking at a time. Overlaps from the website or Google Calendar will appear here.</p>
      </div>}
    </section>

    {details && details.kind === "booking" && <Modal title={details.title} onClose={() => setDetails(null)} actions={<>
      <button className="btn ghost" onClick={() => cancelBooking(details)}>Cancel booking</button>
      {details.status === "held" && <button className="btn primary" onClick={() => confirmBooking(details)}>Confirm booking</button>}
    </>}>
      <div className="detail-grid">
        <Detail label="Room" value={details.resourceName} />
        <Detail label="Type" value={bookingTypeLabel(details.bookingType)} />
        <Detail label="Status" value={details.status === "held" ? `Provisional hold · ${holdExpiryText(details.holdExpiresAt)}` : details.status} />
        <Detail label="Who" value={details.subtitle} />
        <Detail label="Start" value={new Date(details.startAt).toLocaleString()} />
        <Detail label="End" value={new Date(details.endAt).toLocaleString()} />
      </div>
    </Modal>}

    {details && details.kind === "event" && <Modal title={details.title} onClose={() => setDetails(null)} actions={<>
      <button className="btn ghost" onClick={() => removeEvent(details.event || { _id: details.id, externalProvider: "" })}>{details.source === "google" ? "Cancel" : "Delete"}</button>
      {details.event && <button className="btn primary" onClick={() => editEvent(details.event)}>Edit event</button>}
    </>}>
      <div className="detail-grid">
        <Detail label="Type" value={details.bookingType} />
        <Detail label="Status" value={details.status} />
        <Detail label="Location" value={details.resourceName} />
        <Detail label="Start" value={new Date(details.startAt).toLocaleString()} />
        <Detail label="End" value={new Date(details.endAt).toLocaleString()} />
        <Detail label="Contact" value={personName(details.event?.contactId)} />
        <Detail label="Notes" value={details.event?.notes} />
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
        <label>Contact<select value={holdForm.contactId} onChange={(e) => setHoldForm({ ...holdForm, contactId: e.target.value })}><option value="">No contact</option>{contacts.map((c) => <option key={c._id} value={c._id}>{personName(c)}</option>)}</select></label>
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
