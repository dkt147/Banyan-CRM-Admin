import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { FALLBACK_CONFIG, errorCode, hkDateTime, timeAgo } from "./roomBooking";

// Which Google Calendar each WordPress room's bookings are written to.
// GET/PUT /room-bookings/google-calendars. The rules below are enforced on the server
// and only shown here so staff know what the CRM will and won't do.

export const LIBRARY_CALENDAR_ID = "c_682acafdb6beb189d861f1a728b9c5bff9bf1d584e82cbf9d44f602ebecd952b@group.calendar.google.com";
const DEFAULTS = {
  calendars: { small: "", medium: "", library: LIBRARY_CALENDAR_ID },
  includePending: false, showPartnerEvents: true, partnerBlocks: { enabled: false, rooms: { small: true, medium: true, library: false } },
};
// Per-room blocking (client 25 Nov). The Library is off unless someone ticks it: it is the partner's live calendar.
const blockRooms = (pb) => ({ ...DEFAULTS.partnerBlocks.rooms, ...(pb?.rooms || {}) });
const CAL_RX = /^[^\s@]+@(group\.calendar\.google\.com|[a-z0-9.-]+\.[a-z]{2,})$/i;
const ERROR_HINTS = {
  ROOM_CALENDAR_NOT_ACCESSIBLE: "Share the calendar with the Google account connected on the Integrations page, then save again.",
  ROOM_CALENDAR_READ_ONLY: "The calendar is shared, but without \"Make changes to events\". Change the sharing permission in Google Calendar, then save again.",
  INVALID_CALENDAR_ID: "Copy the ID from Google Calendar → Settings and sharing → Integrate calendar.",
};

/** onChange(status) lets the partner-blocks panel follow the toggle without refetching. */
export default function RoomCalendarSettings({ onChange }) {
  const { request } = useAuth();
  const canManage = usePermissions().can("workspace.manage");
  const [v, setV] = useState(DEFAULTS);
  const [status, setStatus] = useState({ loading: true, available: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [backfill, setBackfill] = useState(null);   // null | "loading" | { note, items } | { error }

  function apply(d) {
    setV({
      ...DEFAULTS, includePending: Boolean(d.includePending), showPartnerEvents: d.showPartnerEvents !== false,
      partnerBlocks: { enabled: Boolean(d.partnerBlocks?.enabled), rooms: blockRooms(d.partnerBlocks) },
      calendars: { ...DEFAULTS.calendars, ...(d.calendars || {}) },
    });
    setStatus({ loading: false, available: true, saved: d.saved, connected: d.connected ?? null, lastSync: d.lastSync || null, lastError: d.lastError || null, pushFrom: d.pushFrom || {} });
    onChange?.(d);
  }

  useEffect(() => {
    request("/room-bookings/google-calendars")
      .then((r) => apply(r.data || {}))
      .catch((e) => setStatus({ loading: false, available: ![404, 405].includes(e.status), loadError: [404, 405].includes(e.status) ? "" : e.message }));
  }, [request]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCal = (room, id) => setV((x) => ({ ...x, calendars: { ...x.calendars, [room]: id.trim() } }));
  async function save() {
    const bad = Object.entries(v.calendars).find(([, id]) => id && !CAL_RX.test(id));
    if (bad) { setMsg({ error: true, text: `"${bad[1]}" doesn't look like a Google Calendar ID (it should end in @group.calendar.google.com).` }); return; }
    setSaving(true); setMsg(null);
    try {
      const r = await request("/room-bookings/google-calendars", {
        method: "PUT",
        body: { calendars: v.calendars, includePending: v.includePending, showPartnerEvents: v.showPartnerEvents, partnerBlocks: v.partnerBlocks },
      });
      const d = r.data || {};
      apply(d);
      setMsg({ text: "Saved. New paid bookings will be added to these calendars.", warnings: d.warnings || [] });
    } catch (e) {
      if ([404, 405].includes(e.status)) setMsg({ error: true, text: "Saving needs the backend update (Google Calendar for room bookings)." });
      else setMsg({ error: true, text: e.message, hint: ERROR_HINTS[errorCode(e)] });
    } finally { setSaving(false); }
  }

  async function previewBackfill() {
    setBackfill("loading");
    try { const r = await request("/room-bookings/google-calendars/backfill-preview"); setBackfill(r.data || { items: [] }); }
    catch (e) { setBackfill({ error: e.message }); }
  }

  const roomName = (key) => FALLBACK_CONFIG.rooms.find((r) => r.key === key)?.name || key;
  const summaryText = [
    v.calendars.library ? "Library → partner calendar" : "Library not set",
    v.calendars.small || v.calendars.medium ? "Meeting rooms → calendar set" : "Meeting rooms calendar not set",
    v.partnerBlocks.enabled ? `Website blocking on: ${FALLBACK_CONFIG.rooms.filter((r) => v.partnerBlocks.rooms[r.key]).map((r) => r.key === "library" ? "Library" : r.key === "small" ? "small room" : "large room").join(", ") || "no rooms"}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <details className="panel rb-gcal" open={status.saved === false || undefined}>
      <summary>
        <b>Google Calendar for room bookings</b>
        <span className="lk-muted">{summaryText}</span>
      </summary>
      {!status.available && <div className="notice"><b>Not active yet</b><span>The backend part of this feature hasn't been deployed. You can review the settings; saving will work after the update.</span></div>}
      {status.loadError && <div className="notice error"><b>Google Calendar</b><span>{status.loadError}</span></div>}
      {status.saved === false && <div className="notice"><b>Not saved yet</b><span>Nothing is added to Google Calendar until these settings are saved once.</span></div>}
      {status.connected === false && <div className="notice error"><b>Google not connected</b><span>Connect Google Workspace + Calendar on <Link to="/integrations">Settings → Integrations → Google</Link> with an account that can edit these calendars.</span></div>}
      {status.lastError && <div className="notice error"><b>Last calendar error</b><span>{status.lastError}</span></div>}

      <div className="form-grid">
        {FALLBACK_CONFIG.rooms.map((r) => (
          <label key={r.key} className={r.key === "library" ? "form-span-2" : ""}>{r.name} ({r.capacity})
            <input value={v.calendars[r.key] || ""} disabled={!canManage} placeholder="xxxx@group.calendar.google.com" onChange={(e) => setCal(r.key, e.target.value)} />
            {v.calendars[r.key] && status.pushFrom?.[r.key] && <small className="lk-muted">Adding bookings since {hkDateTime(status.pushFrom[r.key])}</small>}
          </label>
        ))}
        <label className="fm-inline form-span-2"><input type="checkbox" disabled={!canManage} checked={v.includePending} onChange={(e) => setV({ ...v, includePending: e.target.checked })} /> Also add bookings that are still awaiting payment (removed if the hold expires)</label>
        <label className="fm-inline form-span-2"><input type="checkbox" disabled={!canManage} checked={v.showPartnerEvents} onChange={(e) => setV({ ...v, showPartnerEvents: e.target.checked })} /> Show the other events already in these calendars on the CRM calendar (read-only)</label>
        <label className="fm-inline form-span-2 rb-gcal-toggle">
          <input type="checkbox" disabled={!canManage} checked={v.partnerBlocks.enabled} onChange={(e) => setV({ ...v, partnerBlocks: { ...v.partnerBlocks, enabled: e.target.checked } })} />
          <span><b>Block the website when a room is booked directly in Google Calendar</b><br /><small className="lk-muted">Anything added by hand to a room calendar (by your team or your partner) blocks that time on the website and in the CRM within a few minutes, so nobody can book over it. Google Calendar itself is never changed.</small></span>
        </label>
        {v.partnerBlocks.enabled && <fieldset className="form-span-2 rb-block-rooms">
          <legend>Which room calendars block the website</legend>
          {FALLBACK_CONFIG.rooms.map((r) => (
            <label key={r.key} className="fm-inline">
              <input type="checkbox" disabled={!canManage || !v.calendars[r.key]} checked={Boolean(v.partnerBlocks.rooms[r.key]) && Boolean(v.calendars[r.key])}
                onChange={(e) => setV({ ...v, partnerBlocks: { ...v.partnerBlocks, rooms: { ...v.partnerBlocks.rooms, [r.key]: e.target.checked } } })} />
              {r.name} ({r.capacity}){!v.calendars[r.key] ? " · no calendar set" : ""}{r.key === "library" ? " · your partner's live calendar: run the preview below first" : ""}
            </label>
          ))}
        </fieldset>}
      </div>

      <h4>What the CRM will do</h4>
      <ul className="rb-gcal-rules">
        <li>Add one event per <b>paid</b> booking to the room's calendar, in <b>Hong Kong time</b>, titled like "Library – Jane Chan (BNY-7K3Q9P)".</li>
        <li><b>No guests and no invitations</b> are ever added, so nobody gets an email from Google.</li>
        <li>Only change or remove <b>events it created itself</b> (marked with the booking reference), e.g. when a booking is cancelled in WordPress.</li>
        <li><b>Never edit or delete</b> any other event, including your partner's meetings and test events.</li>
        <li>Bookings made <b>before</b> a calendar is saved are not added. Use "Preview older bookings" to see which ones those are.</li>
      </ul>
      {status.lastSync && <p className="lk-muted">Last calendar update: {timeAgo(status.lastSync)} ({hkDateTime(status.lastSync)})</p>}

      {msg && <div className={`notice ${msg.error ? "error" : ""}`}><b>Google Calendar</b><span>{msg.text}{msg.hint && <><br />{msg.hint}</>}</span></div>}
      {msg?.warnings?.map((w) => <div key={w} className="notice error"><b>Warning</b><span>{w}</span></div>)}

      <div className="rb-gcal-actions">
        {canManage && <button type="button" className="btn primary" onClick={save} disabled={saving || status.loading}>{saving ? "Saving…" : "Save calendar settings"}</button>}
        {status.available && <button type="button" className="btn ghost" onClick={previewBackfill} disabled={backfill === "loading"}>{backfill === "loading" ? "Loading…" : "Preview older bookings"}</button>}
      </div>

      {backfill && backfill !== "loading" && (
        <div className="rb-backfill">
          {backfill.error ? <div className="notice error"><b>Older bookings</b><span>{backfill.error}</span></div> : <>
            {backfill.note && <p className="lk-muted">{backfill.note}</p>}
            {(backfill.items || []).length === 0 ? <p className="lk-muted">No upcoming bookings are missing from the calendars.</p> : (
              <table className="lk-table">
                <thead><tr><th>Ref</th><th>Room</th><th>When (HK)</th><th>Status</th><th>Would be titled</th></tr></thead>
                <tbody>
                  {backfill.items.map((it) => (
                    <tr key={it.ref}><td className="rb-mono">{it.ref}</td><td>{roomName(it.roomKey)}</td>
                      <td className="rb-nowrap">{hkDateTime(it.startAt)}–{it.endAt ? new Date(it.endAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" }) : ""}</td>
                      <td>{it.status}</td><td>{it.summary}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </>}
        </div>
      )}
    </details>
  );
}
