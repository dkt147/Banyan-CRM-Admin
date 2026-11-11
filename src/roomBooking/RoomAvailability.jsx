import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  addDaysYmd, customerName, hkNow, hl, isoDow, longDate, money, pad, ymd,
} from "./roomBooking";
import { useWpLiveBlocks } from "./useWpLive";
import "./room-booking.css";

// Staff availability view, rendered inline with the website's booking calendar styles
// (spec §5.2: "In the CRM it can also be rendered inline on a page").
// Booked hours are live from WordPress /availability; names, status and refs come from
// the CRM cache (/room-bookings) when it has the booking.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHOWN = ["paid", "pending", "blocked"];

export default function RoomAvailability({ config: C, canBook, onBook, onOpenRef, refreshKey }) {
  const { request } = useAuth();
  const now = useMemo(hkNow, []);
  const [room, setRoom] = useState(C.rooms[1]?.key || C.rooms[0].key);
  const [ym, setYm] = useState(() => { const p = now.date.split("-"); return { y: +p[0], m: +p[1] - 1 }; });
  const [date, setDate] = useState(() => {
    let d = now.date;
    for (let i = 0; i < 7; i++) { const p = d.split("-").map(Number); if (C.days.includes(isoDow(p[0], p[1] - 1, p[2]))) break; d = addDaysYmd(d, 1); }
    return d;
  });
  const [rows, setRows] = useState([]);

  const monthStart = ymd(ym.y, ym.m, 1);
  const monthEnd = ymd(ym.y, ym.m, new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate());
  const live = useWpLiveBlocks(C, monthStart, monthEnd, { refreshMs: 30000 });

  // Cached rows (names, status, refs) for the month; optional, the view works without them.
  useEffect(() => {
    let active = true;
    request("/room-bookings", { query: { status: "all", range: "all", from: monthStart, to: monthEnd, limit: 500 } })
      .then((r) => active && setRows((r.data?.items || []).filter((b) => SHOWN.includes(b.status))))
      .catch(() => active && setRows([]));
    return () => { active = false; };
  }, [request, monthStart, monthEnd, live.updatedAt, refreshKey]);
  useEffect(() => { if (refreshKey) live.reload(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const booked = useMemo(() => {
    const map = {};
    live.blocks.filter((b) => b.room === room).forEach((b) => {
      for (let h = b.start; h < b.end; h++) (map[b.date] = map[b.date] || []).push(h);
    });
    return map;
  }, [live.blocks, room]);
  const rowAt = (d, h) => rows.find((b) => b.roomKey === room && b.date === d && Number(b.startTime?.slice(0, 2)) <= h && Number(b.endTime?.slice(0, 2)) > h);
  const bookingsOnDay = (d) => (booked[d] || []).length;

  const r = C.rooms.find((x) => x.key === room);
  const today = now.date;
  const slotState = (d, h) => {
    if ((booked[d] || []).includes(h)) return "booked";
    if (d < today || (d === today && h <= now.hour)) return "past";
    return "free";
  };
  const dayState = (y, m, d) => {
    const ds = ymd(y, m, d);
    if (!C.days.includes(isoDow(y, m, d))) return "closed";
    if (ds < today) return "past";
    if (ds > addDaysYmd(today, C.maxDays)) return "out";
    if (live.loading && !live.updatedAt) return "open";
    for (let h = C.open; h < C.close; h++) if (slotState(ds, h) === "free") return "open";
    return "full";
  };
  function navMonth(dir) {
    setYm(({ y, m }) => { m += dir; if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; } return { y, m }; });
  }

  const maxP = addDaysYmd(today, C.maxDays).split("-");
  const canNext = ym.y < +maxP[0] || (ym.y === +maxP[0] && ym.m < +maxP[1] - 1);
  const first = isoDow(ym.y, ym.m, 1), dim = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const dayBookings = date ? rows.filter((b) => b.roomKey === room && b.date === date) : [];

  return (
    <div className="bnrb-overlay bnrb-inline">
      <div className="bnrb-dialog">
        <div className="bnrb-head">
          <p className="bnrb-eyebrow">Meeting rooms · Quarry Bay · live from banyanworkspace.com</p>
          <h2 className="bnrb-title">Room availability</h2>
        </div>
        <div className="bnrb-body">
          {live.error && <div className="bnrb-alert bnrb-alert-err" role="alert" style={{ margin: "0 0 16px" }}>{live.error}</div>}
          <p className="bnrb-label">1. Choose a room</p>
          <div className="bnrb-rooms" role="radiogroup" aria-label="Room">
            {C.rooms.map((x) => {
              const on = room === x.key;
              const count = live.blocks.filter((b) => b.room === x.key && b.date >= today).reduce((n, b) => n + (b.end - b.start), 0);
              return (
                <button key={x.key} type="button" role="radio" aria-checked={on} className={`bnrb-room${on ? " is-on" : ""}`} onClick={() => setRoom(x.key)}>
                  <span className="bnrb-room-name">{x.name}</span><span className="bnrb-room-cap">{x.capacity}</span>
                  <span className="bnrb-room-price">{money(x.price)} <small>/ hour</small>{count > 0 && <em className="bnrb-room-count">{count}h booked this month</em>}</span>
                </button>
              );
            })}
          </div>

          <div className="bnrb-grid">
            <div className="bnrb-cal">
              <p className="bnrb-label">2. Pick a date</p>
              <div className="bnrb-cal-head">
                <button type="button" className="bnrb-nav" aria-label="Previous month" onClick={() => navMonth(-1)}>&#8249;</button>
                <span>{MONTHS[ym.m]} {ym.y}{live.loading && <> <i className="bnrb-spin" aria-hidden="true" /></>}</span>
                <button type="button" className="bnrb-nav" aria-label="Next month" disabled={!canNext} onClick={() => navMonth(1)}>&#8250;</button>
              </div>
              <div className="bnrb-week">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
              <div className="bnrb-days">
                {Array.from({ length: first - 1 }, (_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: dim }, (_, i) => {
                  const d = i + 1, ds = ymd(ym.y, ym.m, d), st = dayState(ym.y, ym.m, d), on = date === ds;
                  const has = bookingsOnDay(ds) > 0;
                  return (
                    <button key={ds} type="button" disabled={st === "closed"}
                      className={`bnrb-day is-${st}${on ? " is-on" : ""}${ds === today ? " is-today" : ""}${has ? " has-bookings" : ""}`}
                      aria-label={longDate(ds) + (has ? `, ${bookingsOnDay(ds)} hour(s) booked` : "")} aria-pressed={on || undefined}
                      onClick={() => setDate(ds)}>{d}</button>
                  );
                })}
              </div>
              <div className="bnrb-legend">
                <span><i className="is-open" />Available</span><span><i className="is-booked" />Has bookings</span>
                <span><i className="is-full" />Fully booked</span><span><i className="is-closed" />Closed</span>
              </div>
            </div>
            <div className="bnrb-slots">
              <p className="bnrb-label">3. Time slots</p>
              {!date || !date.startsWith(`${ym.y}-${pad(ym.m + 1)}`) ? <p className="bnrb-muted">Pick a date to see its time slots.</p> : <>
                <p className="bnrb-date-line">{longDate(date)}</p>
                <p className="bnrb-hint">{canBook ? "Tap a free hour to book it. Tap a booking to see its details." : "Tap a booking to see its details."}</p>
                <div className="bnrb-slot-grid">
                  {Array.from({ length: C.close - C.open }, (_, i) => {
                    const x = C.open + i, st = slotState(date, x), row = st === "booked" ? rowAt(date, x) : null;
                    const label = row ? (row.status === "blocked" ? "Blocked" : customerName(row.customer) || row.ref) : "Booked";
                    const clickable = (st === "free" && canBook) || (row && onOpenRef);
                    return (
                      <button key={x} type="button" disabled={!clickable}
                        className={`bnrb-slot is-${st}${row ? ` is-staff is-${row.status}` : ""}`}
                        title={row ? `${row.ref} · ${row.statusLabel}` : undefined}
                        onClick={() => (row ? onOpenRef(row.ref) : onBook({ room, date, hour: x }))}>
                        <span>{hl(x)} – {hl(x + 1)}</span>
                        {st === "booked" && <small>{label}{row?.status === "pending" ? " · unpaid" : ""}</small>}
                      </button>
                    );
                  })}
                </div>
                {dayBookings.length > 0 && <ul className="bnrb-daylist">
                  {dayBookings.map((b) => (
                    <li key={b.ref}>
                      <button type="button" onClick={() => onOpenRef(b.ref)}>
                        <strong>{b.startTime}–{b.endTime}</strong> {b.status === "blocked" ? "Blocked" : customerName(b.customer)}
                        <span className={`rb-status rb-status-${b.status}`}>{b.statusLabel}</span>
                        {b.payment?.isTest && <span className="rb-test">TEST</span>}
                        <small>{b.ref}</small>
                      </button>
                    </li>
                  ))}
                </ul>}
              </>}
            </div>
          </div>
        </div>
        <div className="bnrb-foot">
          <div className="bnrb-summary">
            <span className="bnrb-muted">{live.updatedAt ? `Live from the website · updated ${live.updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · refreshes every 30 s` : "Loading live availability…"}</span>
          </div>
          <button type="button" className="bnrb-btn bnrb-btn-ghost" onClick={live.reload}>Refresh</button>
          {canBook && <button type="button" className="bnrb-btn" onClick={() => onBook({ room, date })}>Book {r.name === "The Library" ? "the Library" : "this room"}</button>}
        </div>
      </div>
    </div>
  );
}
