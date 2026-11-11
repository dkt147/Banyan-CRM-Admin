import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "./Dashboard";
import BookingsTabs from "../components/BookingsTabs";
import { DataState, FilterChips, Pager, SearchBox } from "../components/ListKit";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { recordHref } from "../utils/recordLinks";
import RoomBookingModal from "../roomBooking/RoomBookingModal";
import RoomBookingPanel, { RoomStatusBadge, TestBadge } from "../roomBooking/RoomBookingPanel";
import RoomAvailability from "../roomBooking/RoomAvailability";
import { FALLBACK_CONFIG, customerName, stripeUrl, useRoomBookingConfig } from "../roomBooking/roomBooking";

/** Shown while the CRM server can't read WordPress bookings (no BANYAN_CRM_TOKEN). */
export function SyncWarning({ config }) {
  if (!config || config.syncConfigured !== false) return null;
  return (
    <div className="notice error rb-sync-warning">
      <b>WordPress sync is off</b>
      <span>The CRM server can't read WordPress bookings yet (BANYAN_CRM_TOKEN isn't set, or the room-booking backend isn't deployed), so customer names, payments and the bookings list can't be loaded.
        Booked hours below come live from the website, and new bookings still work.</span>
    </div>
  );
}

// Meeting-room bookings from WordPress (spec §6.1). Rows come from the CRM cache
// (GET /room-bookings), kept fresh by the WordPress webhook and the 10-minute sync.

const PAGE_SIZE = 50;
const STATUS_FILTERS = [["active", "Active"], ["paid", "Paid"], ["blocked", "Blocked"], ["pending", "Awaiting payment"], ["cancelled", "Cancelled"], ["expired", "Expired"]];
const RANGES = [["upcoming", "Upcoming"], ["past", "Past"], ["all", "All"]];

export default function RoomBookings() {
  const { request } = useAuth();
  const canWrite = usePermissions().can("bookings.write");
  const [status, setStatus] = useState("active");
  const [range, setRange] = useState("upcoming");
  const [room, setRoom] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [newBooking, setNewBooking] = useState(null);   // prefill { room, date, hour } or {}
  const [openRef, setOpenRef] = useState(null);
  const [bookedTick, setBookedTick] = useState(0);
  const config = useRoomBookingConfig();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await request("/room-bookings", { query: { status, range, room, search, page, limit: PAGE_SIZE } });
      setRows(r.data?.items || []);
      setMeta({ total: r.data?.pagination?.total || 0, pages: r.data?.pagination?.pages || 1 });
    } catch (e) { setError(e.message || "Failed to load room bookings."); setRows([]); }
    finally { setLoading(false); }
  }, [request, status, range, room, search, page]);
  useEffect(() => { load(); }, [load]);

  async function syncNow() {
    setSyncing(true); setNotice("");
    try {
      const r = await request("/room-bookings/sync", { method: "POST", body: {} });
      const d = r.data || {};
      const counts = ["created", "updated"].filter((k) => d[k] != null).map((k) => `${d[k]} ${k}`).join(", ");
      setNotice(`Synced with WordPress${counts ? `: ${counts}` : ""}.`);
      await load();
    } catch (e) { setNotice(e.message || "Sync failed."); }
    finally { setSyncing(false); }
  }

  const reset = (fn) => (v) => { fn(v); setPage(1); };

  return (
    <Page title="Bookings and Calendar" kicker={`${meta.total} meeting room booking${meta.total === 1 ? "" : "s"}`}
      actions={canWrite && <>
        <button type="button" className="btn ghost" onClick={syncNow} disabled={syncing}>{syncing ? "Syncing…" : "Sync from WordPress"}</button>
        <button type="button" className="btn primary" onClick={() => setNewBooking({})}>New booking</button>
      </>}>
      <BookingsTabs active="rooms" />
      <SyncWarning config={config} />
      {config && <RoomAvailability config={config} canBook={canWrite} onBook={setNewBooking} onOpenRef={setOpenRef} refreshKey={bookedTick} />}
      <h2 className="rb-list-title">All meeting room bookings</h2>
      <section className="lk-toolbar">
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search name, email, phone or BNY- reference" />
        <select aria-label="Room" value={room} onChange={(e) => reset(setRoom)(e.target.value)}>
          <option value="">All rooms</option>
          {FALLBACK_CONFIG.rooms.map((r) => <option key={r.key} value={r.key}>{r.name} ({r.capacity})</option>)}
        </select>
      </section>
      <section className="lk-filterbar">
        <FilterChips label="Status" chips={STATUS_FILTERS.map(([key, label]) => ({ key, label, active: status === key }))} onToggle={reset(setStatus)} />
        <FilterChips label="When" chips={RANGES.map(([key, label]) => ({ key, label, active: range === key }))} onToggle={reset(setRange)} />
      </section>
      {notice && <div className="notice"><b>Room bookings</b><span>{notice}</span></div>}

      <section className="panel lk-table-wrap">
        <DataState loading={loading} error={error} onRetry={load} empty={rows.length === 0} emptyText="No meeting room bookings match these filters.">
          <table className="lk-table rb-table">
            <thead>
              <tr><th>Ref</th><th>Room</th><th>Date</th><th>Time</th><th>Customer</th><th>Amount</th><th>Status</th><th>Source</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody className={loading ? "lk-dim" : ""}>
              {rows.map((b) => {
                const blocked = b.status === "blocked";
                const link = stripeUrl(b.payment);
                const notes = b.customer?.notes || "";
                return (
                  <tr key={b.ref} className="lk-row" onClick={() => setOpenRef(b.ref)}>
                    <td><button type="button" className="lk-primary rb-ref" onClick={(e) => { e.stopPropagation(); setOpenRef(b.ref); }}>{b.ref}</button></td>
                    <td>{b.roomName}</td>
                    <td className="rb-nowrap">{b.dateLabel}</td>
                    <td className="rb-nowrap">{b.startTime}–{b.endTime}<small>{b.hours}h</small></td>
                    <td className="rb-customer">
                      {blocked ? <b>Blocked</b> : b.contact?.id
                        ? <Link to={recordHref.contact(b.contact.id)} onClick={(e) => e.stopPropagation()}><b>{customerName(b.customer)}</b></Link>
                        : <b>{customerName(b.customer) || "—"}</b>}
                      {!blocked && (b.customer?.email || b.customer?.phone) && <small>
                        {b.customer?.email && <a href={`mailto:${b.customer.email}`} onClick={(e) => e.stopPropagation()}>{b.customer.email}</a>}
                        {b.customer?.email && b.customer?.phone && " · "}{b.customer?.phone}
                      </small>}
                      {notes && <small className="rb-truncate" title={notes}>{notes}</small>}
                    </td>
                    <td className="rb-nowrap">{blocked ? "—" : <>{b.payment?.amountLabel || "—"}{b.payment?.isTest && <> <TestBadge /></>}</>}</td>
                    <td><RoomStatusBadge status={b.status} label={b.statusLabel} /></td>
                    <td className="rb-nowrap">{b.channel || "—"}{b.viaCrm && <span className="rb-source">CRM</span>}</td>
                    <td className="rb-nowrap">{link && <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>View in Stripe</a>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
        <Pager page={page} pages={meta.pages} total={meta.total} loading={loading} onPage={setPage} />
      </section>

      {newBooking && <RoomBookingModal initial={newBooking} onClose={() => setNewBooking(null)} onBooked={() => { load(); setBookedTick((n) => n + 1); }} />}
      {openRef && <RoomBookingPanel bookingRef={openRef} onClose={() => setOpenRef(null)} />}
    </Page>
  );
}
