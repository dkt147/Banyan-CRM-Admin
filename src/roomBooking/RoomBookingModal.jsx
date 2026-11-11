import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/AuthContext";
import { personLabel } from "../utils/useLookups";
import {
  addDaysYmd, hkNow, hl, hoursText, isoDow, longDate, money, pad, roomLabel, sessionIdFromUrl,
  useRoomBookingConfig, wpApi, ymd,
} from "./roomBooking";
import "./room-booking.css";

// "New booking" for the WordPress meeting rooms: a React port of the website's booking.js
// (same DOM structure, class names and copy, so it matches the website screenshots).
// CRM changes (spec §6.3 / §7): notes carry "Booked via CRM by <staff>", there is no
// redirect to Stripe. After checkout the dialog shows "Waiting for payment" with
// Open/Copy payment link and polls WordPress /session every 3 s for up to 35 minutes.
// No card fields: payment only ever happens on Stripe's hosted page.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const BLANK_DETAILS = { first_name: "", last_name: "", email: "", phone: "+852 ", notes: "" };
const POLL_MS = 3000;

/**
 * Props:
 *  initial  { room?, date?: "YYYY-MM-DD", hour?: 9..17 }, prefill from an empty calendar slot
 *  onClose  () => void
 *  onBooked (session) => void, called once a booking is paid (after the CRM sync request)
 */
export default function RoomBookingModal(props) {
  const config = useRoomBookingConfig();
  return createPortal(config
    ? <BookingDialog {...props} config={config} />
    : <Shell title="Book a meeting room" step={1} onClose={props.onClose}>
        <div className="bnrb-result"><i className="bnrb-spin bnrb-spin-lg" aria-hidden="true" /><p>Loading booking settings…</p></div>
      </Shell>,
  document.body);
}

/* ---------- modal shell: header, steps, close, Esc, focus trap ---------- */
function Shell({ title, step, onClose, children, footer }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    const last = document.activeElement;
    document.documentElement.classList.add("bnrb-lock");
    const t = setTimeout(() => dialogRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.documentElement.classList.remove("bnrb-lock");
      if (last && last.focus) last.focus();
    };
  }, []);
  function onKeyDown(e) {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    if (e.key !== "Tab") return;
    const f = overlayRef.current.querySelectorAll("button:not([disabled]), input:not([tabindex='-1']), textarea, select, a[href]");
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  return (
    <div className="bnrb-overlay" ref={overlayRef} onKeyDown={onKeyDown} onMouseDown={(e) => e.target === overlayRef.current && onClose()}>
      <div className="bnrb-dialog" role="dialog" aria-modal="true" aria-labelledby="bnrb-title" tabIndex={-1} ref={dialogRef}>
        <button type="button" className="bnrb-close" aria-label="Close" onClick={onClose}>&times;</button>
        <div className="bnrb-head">
          <p className="bnrb-eyebrow">Meeting rooms · Quarry Bay</p>
          <h2 id="bnrb-title" className="bnrb-title">{title}</h2>
          <ol className="bnrb-steps" style={step ? undefined : { display: "none" }}>
            {["Room & time", "Your details", "Payment"].map((label, i) => (
              <li key={label} className={i + 1 < step ? "is-done" : i + 1 === step ? "is-active" : ""}>{label}</li>
            ))}
          </ol>
        </div>
        <div className="bnrb-body">{children}</div>
        <div className="bnrb-foot">{footer}</div>
      </div>
    </div>
  );
}

function BookingDialog({ config: C, initial, onClose, onBooked }) {
  const { request } = useAuth();
  const init = useMemo(() => {
    const now = hkNow();
    const room = initial?.room && C.rooms.some((r) => r.key === initial.room) ? initial.room : null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(initial?.date || "") ? initial.date : null;
    const p = (date || now.date).split("-");
    const hour = Number.isInteger(initial?.hour) && initial.hour >= C.open && initial.hour < C.close ? initial.hour : null;
    return { now, room, date, y: +p[0], m: +p[1] - 1, hour };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [room, setRoom] = useState(init.room);
  const [ym, setYm] = useState({ y: init.y, m: init.m });
  const [date, setDate] = useState(init.date);
  const [sel, setSel] = useState(init.room && init.date && init.hour !== null ? { start: init.hour, end: init.hour + 1 } : null);
  // Prefilled hour without a room (Week view slot): applied when the first room is chosen.
  const prefillHour = useRef(init.room ? null : init.hour);
  const [booked, setBooked] = useState({});
  const [today, setToday] = useState(init.now.date);
  const [nowHour, setNowHour] = useState(init.now.hour);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState(1);              // 1 | 2 | 3 (waiting for payment)
  const [details, setDetails] = useState(BLANK_DETAILS);
  const [invalid, setInvalid] = useState([]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkout, setCheckout] = useState(null);    // { ref, url, sessionId, createdAt, ... }
  const [result, setResult] = useState(null);        // { kind: success|released|error, data, note }
  const [syncState, setSyncState] = useState("");    // "" | syncing | ok | failed
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const cache = useRef({});

  const r = C.rooms.find((x) => x.key === room) || null;
  const monthKey = `${ym.y}-${pad(ym.m + 1)}`;
  const hours = sel && r ? sel.end - sel.start : 0;

  /* ---------- data ---------- */
  useEffect(() => {
    if (!room) return undefined;
    const key = `${room}|${monthKey}`;
    if (cache.current[key]) { setBooked(cache.current[key]); setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    wpApi(C, `availability?room=${encodeURIComponent(room)}&month=${monthKey}`)
      .then((j) => {
        const map = {};
        Object.entries(j.booked || {}).forEach(([d, hs]) => { map[d] = (hs || []).map(Number); });
        cache.current[key] = map;
        if (j.today) { setToday(j.today); setNowHour(Number(j.now_hour)); }
        if (active) setBooked(map);
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [room, monthKey, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const bookedOn = (d) => booked[d] || [];
  const slotState = (d, h) => {
    if (bookedOn(d).includes(h)) return "booked";
    if (d === today && h <= nowHour) return "past";
    return "free";
  };
  const dayState = (y, m, d) => {
    const ds = ymd(y, m, d);
    if (ds < today) return "past";
    if (ds > addDaysYmd(today, C.maxDays)) return "out";
    if (!C.days.includes(isoDow(y, m, d))) return "closed";
    if (!room || loading) return "open";
    for (let h = C.open; h < C.close; h++) if (slotState(ds, h) === "free") return "open";
    return "full";
  };
  const rangeFree = (a, b) => { for (let x = a; x <= b; x++) if (slotState(date, x) !== "free") return false; return true; };

  // A prefilled date or hour (from a calendar slot) must still be bookable once availability arrives.
  useEffect(() => {
    if (!room || loading || !date || !date.startsWith(monthKey)) return;
    const [y, m, d] = date.split("-").map(Number);
    if (dayState(y, m - 1, d) !== "open") { setDate(null); setSel(null); return; }
    if (sel && !rangeFree(sel.start, sel.end - 1)) setSel(null);
  }, [room, loading, booked, today, nowHour]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- step 1 actions ---------- */
  function selectRoom(key) {
    if (room === key) return;
    const h = prefillHour.current;
    prefillHour.current = null;
    setRoom(key); setSel(date && h !== null ? { start: h, end: h + 1 } : null); setBooked({}); setError("");
  }
  function navMonth(dir) {
    setYm(({ y, m }) => {
      m += dir;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      return { y, m };
    });
  }
  function pickHour(x) {
    setError("");
    if (!sel || sel.end - sel.start > 1) setSel({ start: x, end: x + 1 });
    else if (x === sel.start) setSel(null);
    else if (x > sel.start && rangeFree(sel.start, x)) setSel({ start: sel.start, end: x + 1 });
    else if (x > sel.start) setError("That range includes a booked hour. Please choose a shorter time.");
    else setSel({ start: x, end: x + 1 });
  }

  /* ---------- step 2: submit to WordPress /checkout (from the staff browser) ---------- */
  const setField = (name, value) => setDetails((d) => ({ ...d, [name]: value }));
  const notesRoom = Math.max(0, 1000 - C.notesPrefix.length - 3);
  async function submit() {
    const d = details, bad = [];
    let msg = "";
    if (!d.first_name.trim()) { bad.push("first_name"); msg = msg || "Please enter your first name."; }
    if (!d.last_name.trim()) { bad.push("last_name"); msg = msg || "Please enter your last name."; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) { bad.push("email"); msg = msg || "Please enter a valid email address."; }
    if (d.phone.replace(/\D/g, "").length < 6) { bad.push("phone"); msg = msg || "Please enter a valid phone number."; }
    setInvalid(bad); setFormError(msg);
    if (msg) return;
    setSubmitting(true);
    try {
      const j = await wpApi(C, "checkout", {
        method: "POST",
        body: {
          room, date, start: sel.start, hours,
          first_name: d.first_name.trim(), last_name: d.last_name.trim(), email: d.email.trim(), phone: d.phone.trim(),
          notes: [C.notesPrefix, d.notes.trim()].filter(Boolean).join(" – ").slice(0, 1000),
          website: "",
          return_url: C.returnUrl,
        },
      });
      setCheckout({
        ref: j.ref, url: j.url, sessionId: sessionIdFromUrl(j.url), createdAt: Date.now(),
        roomLabel: roomLabel(r), date, start: sel.start, end: sel.end, hours, amount: r.price * hours, email: d.email.trim(),
      });
      setStep(3);
    } catch (e) {
      if (e.status === 409) {
        cache.current = {}; setSel(null); setError(e.message); setStep(1); setReload((n) => n + 1);
      } else setFormError(e.message);
    } finally { setSubmitting(false); }
  }

  /* ---------- step 3: watch the Stripe session ---------- */
  useEffect(() => {
    if (step !== 3 || result || !checkout?.sessionId) return undefined;
    let active = true, timer;
    const deadline = checkout.createdAt + (C.holdMinutes || 35) * 60000;
    async function poll() {
      try {
        const b = await wpApi(C, `session?session_id=${encodeURIComponent(checkout.sessionId)}`);
        if (!active) return;
        if (b.status === "paid") { paid(b); return; }
        if (b.status === "expired" || b.status === "cancelled") { setResult({ kind: "released", data: b }); return; }
        if (b.status === "error") { setResult({ kind: "error", note: "Stripe reported a problem with this payment. Check the booking in WP Admin → Room Bookings." }); return; }
      } catch { /* network blip or not visible yet: keep checking until the hold ends */ }
      if (!active) return;
      if (Date.now() >= deadline) { setResult({ kind: "released" }); return; }
      timer = setTimeout(poll, POLL_MS);
    }
    timer = setTimeout(poll, POLL_MS);
    return () => { active = false; clearTimeout(timer); };
  }, [step, checkout, result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 3 || result) return undefined;
    const t = setInterval(() => setTick(Date.now()), 15000);
    return () => clearInterval(t);
  }, [step, result]);

  async function paid(session) {
    setResult({ kind: "success", data: session });
    setSyncState("syncing");
    try {
      await request("/room-bookings/sync", { method: "POST", body: { from: checkout.date, to: checkout.date } });
      setSyncState("ok");
    } catch { setSyncState("failed"); }
    onBooked?.(session);
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(checkout.url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt("Copy the payment link:", checkout.url); }
  }

  function chooseAnotherTime() {
    cache.current = {}; setResult(null); setCheckout(null); setSel(null); setError(""); setStep(1); setReload((n) => n + 1);
  }

  function requestClose() {
    if (step === 3 && !result && !window.confirm("Payment has not been confirmed yet. If you close this, the CRM stops checking for it. The booking still completes in WordPress if the customer pays. Close anyway?")) return;
    onClose();
  }

  /* ---------- render ---------- */
  if (result) return <ResultView result={result} checkout={checkout} syncState={syncState} onClose={onClose} onAgain={chooseAnotherTime} />;

  if (step === 3) {
    const holdEnds = checkout.createdAt + (C.holdMinutes || 35) * 60000;
    const minsLeft = Math.max(0, Math.ceil((holdEnds - tick) / 60000));
    const until = new Date(holdEnds).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" });
    return (
      <Shell title="Secure payment" step={3} onClose={requestClose} footer={<>
        <div className="bnrb-summary">
          {checkout.sessionId
            ? <span className="bnrb-muted"><i className="bnrb-spin" aria-hidden="true" /> Checking for payment…</span>
            : <span className="bnrb-muted">Payment can't be tracked here. Check the bookings list once the customer has paid.</span>}
          {copied && <span className="bnrb-copied" role="status">Link copied</span>}
        </div>
        <button type="button" className="bnrb-btn bnrb-btn-ghost" onClick={copyLink}>Copy payment link</button>
        <button type="button" className="bnrb-btn" onClick={() => window.open(checkout.url, "_blank", "noopener")}>Open payment page</button>
      </>}>
        <div className="bnrb-result">
          <div className="bnrb-check is-wait" aria-hidden="true">&hellip;</div>
          <h3>Waiting for payment – {checkout.ref}</h3>
          <p>Open the payment page, or copy the link and send it to the customer by email or WhatsApp. Card details are entered on Stripe's page only.</p>
          <div className="bnrb-wait-meta" aria-live="polite">
            <span>Slot held until <strong>{until}</strong> ({minsLeft} min left)</span>
            <span>The payment link expires after {C.checkoutExpiresMinutes || 31} minutes</span>
          </div>
          <dl className="bnrb-dl">
            <dt>Reference</dt><dd>{checkout.ref}</dd>
            <dt>Room</dt><dd>{checkout.roomLabel}</dd>
            <dt>Date</dt><dd>{longDate(checkout.date)}</dd>
            <dt>Time</dt><dd>{hl(checkout.start)} – {hl(checkout.end)} ({hoursText(checkout.hours)})</dd>
            <dt>Customer email</dt><dd>{checkout.email}</dd>
            <dt>Amount due</dt><dd>{money(checkout.amount)}</dd>
          </dl>
          <p className="bnrb-note">Phone bookings: keying in a customer's card yourself is a card-not-present (MOTO) payment, which Stripe has to allow on the account. Sending the link to the customer is the safest default.</p>
        </div>
      </Shell>
    );
  }

  if (step === 2) {
    return (
      <Shell title="Your details" step={2} onClose={requestClose} footer={<>
        <button type="button" className="bnrb-btn bnrb-btn-ghost bnrb-back" onClick={() => setStep(1)}>Back</button>
        <div className="bnrb-summary"><span>Total</span><span className="bnrb-total">{money(r.price * hours)}</span></div>
        <button type="button" className="bnrb-btn bnrb-pay" onClick={submit} disabled={submitting}>
          {submitting ? <><i className="bnrb-spin" aria-hidden="true" /> Redirecting to secure payment…</> : "Continue to payment"}
        </button>
      </>}>
        <div className="bnrb-recap">
          <div><strong>{r.name} · {r.capacity}</strong><span>{longDate(date)}, {hl(sel.start)}–{hl(sel.end)} ({hoursText(hours)})</span></div>
          <button type="button" className="bnrb-link bnrb-edit" onClick={() => setStep(1)}>Change</button>
        </div>
        <ContactPicker onPick={(c) => setDetails((d) => ({
          ...d,
          first_name: c.firstName || (c.fullName || "").split(" ")[0] || d.first_name,
          last_name: c.lastName || (c.fullName || "").split(" ").slice(1).join(" ") || d.last_name,
          email: c.email || d.email,
          phone: c.phone || c.mobile || d.phone,
        }))} />
        <form className="bnrb-form" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field name="first_name" label="First name" type="text" details={details} onChange={setField} invalid={invalid} autoFocus />
          <Field name="last_name" label="Last name" type="text" details={details} onChange={setField} invalid={invalid} />
          <Field name="email" label="Email address" type="email" details={details} onChange={setField} invalid={invalid} />
          <Field name="phone" label="Phone number" type="tel" details={details} onChange={setField} invalid={invalid} />
          <div className="bnrb-field bnrb-f-notes">
            <label htmlFor="bnrb-notes">Additional notes</label>
            <textarea id="bnrb-notes" name="notes" rows={3} maxLength={notesRoom} placeholder="Layout, catering, number of guests…" value={details.notes} onChange={(e) => setField("notes", e.target.value)} />
            <p className="bnrb-prefix">Saved as "{C.notesPrefix}{details.notes.trim() ? " – …" : ""}" so the booking can be traced to you.</p>
          </div>
          <div className="bnrb-hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>
        </form>
        {formError && <div className="bnrb-alert bnrb-alert-err" role="alert">{formError}</div>}
      </Shell>
    );
  }

  /* step 1 */
  const nowP = today.split("-"), maxP = addDaysYmd(today, C.maxDays).split("-");
  const canPrev = ym.y > +nowP[0] || (ym.y === +nowP[0] && ym.m > +nowP[1] - 1);
  const canNext = ym.y < +maxP[0] || (ym.y === +maxP[0] && ym.m < +maxP[1] - 1);
  const first = isoDow(ym.y, ym.m, 1), daysInMonth = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();

  return (
    <Shell title="Book a meeting room" step={1} onClose={requestClose} footer={<>
      <div className="bnrb-summary">
        {hours
          ? <><strong>{r.name} · {r.capacity}</strong><span>{longDate(date)}, {hl(sel.start)}–{hl(sel.end)} · {hoursText(hours)}</span><span className="bnrb-total">{money(r.price * hours)}</span></>
          : <span className="bnrb-muted">{room ? (date ? "Select a start time." : "Pick a date to see available times.") : "Choose a room to see availability."}</span>}
      </div>
      <button type="button" className="bnrb-btn bnrb-next" disabled={!(hours && C.enabled)} onClick={() => { setFormError(""); setInvalid([]); setStep(2); }}>Continue</button>
    </>}>
      {!C.enabled && <div className="bnrb-alert">Online booking is switched off in WordPress (Room Bookings → Settings).</div>}
      <p className="bnrb-label">1. Choose a room</p>
      <div className="bnrb-rooms" role="radiogroup" aria-label="Room">
        {C.rooms.map((x) => {
          const on = room === x.key;
          return (
            <button key={x.key} type="button" role="radio" aria-checked={on} className={`bnrb-room${on ? " is-on" : ""}`} onClick={() => selectRoom(x.key)}>
              <span className="bnrb-room-name">{x.name}</span><span className="bnrb-room-cap">{x.capacity}</span>
              <span className="bnrb-room-price">{money(x.price)} <small>/ hour</small></span>
            </button>
          );
        })}
      </div>

      <div className={`bnrb-grid${room ? "" : " is-disabled"}`}>
        <div className="bnrb-cal">
          <p className="bnrb-label">2. Pick a date</p>
          <div className="bnrb-cal-head">
            <button type="button" className="bnrb-nav" aria-label="Previous month" disabled={!canPrev} onClick={() => navMonth(-1)}>&#8249;</button>
            <span>{MONTHS[ym.m]} {ym.y}{loading && <> <i className="bnrb-spin" aria-hidden="true" /></>}</span>
            <button type="button" className="bnrb-nav" aria-label="Next month" disabled={!canNext} onClick={() => navMonth(1)}>&#8250;</button>
          </div>
          <div className="bnrb-week">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="bnrb-days">
            {Array.from({ length: first - 1 }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1, ds = ymd(ym.y, ym.m, d), st = dayState(ym.y, ym.m, d), on = date === ds;
              const usable = st === "open" && room;
              return (
                <button key={ds} type="button" disabled={!usable}
                  className={`bnrb-day is-${st}${on ? " is-on" : ""}${ds === today ? " is-today" : ""}`}
                  aria-label={longDate(ds) + (st === "full" ? ", fully booked" : "")} aria-pressed={on || undefined}
                  onClick={() => { setDate(ds); setSel(null); setError(""); }}>{d}</button>
              );
            })}
          </div>
          <div className="bnrb-legend"><span><i className="is-open" />Available</span><span><i className="is-full" />Fully booked</span><span><i className="is-closed" />Closed</span></div>
        </div>
        <div className="bnrb-slots">
          <p className="bnrb-label">3. Select your time</p>
          {!room ? <p className="bnrb-muted">Choose a room first.</p>
            : !date ? <p className="bnrb-muted">Pick a date to see available times.</p>
              : <>
                <p className="bnrb-date-line">{longDate(date)}</p>
                <p className="bnrb-hint">Tap a start time. To book more than one hour, tap the last hour you need.</p>
                <div className="bnrb-slot-grid">
                  {Array.from({ length: C.close - C.open }, (_, i) => {
                    const x = C.open + i, st = slotState(date, x), on = Boolean(sel && x >= sel.start && x < sel.end);
                    const cls = `bnrb-slot is-${st}${on ? " is-on" : ""}${on && x === sel.start ? " is-first" : ""}${on && x === sel.end - 1 ? " is-last" : ""}`;
                    return (
                      <button key={x} type="button" className={cls} disabled={st !== "free"} aria-pressed={on} onClick={() => pickHour(x)}>
                        <span>{hl(x)} – {hl(x + 1)}</span>{st === "booked" && <small>Booked</small>}
                      </button>
                    );
                  })}
                </div>
              </>}
        </div>
      </div>
      {error && <div className="bnrb-alert bnrb-alert-err" role="alert">{error}</div>}
    </Shell>
  );
}

// Required customer field. Autocomplete is off: these are the customer's details, not the staff member's.
function Field({ name, label, type, details, onChange, invalid, autoFocus }) {
  return (
    <div className={`bnrb-field bnrb-f-${name}${invalid.includes(name) ? " is-invalid" : ""}`}>
      <label htmlFor={`bnrb-${name}`}>{label} <em>*</em></label>
      <input id={`bnrb-${name}`} name={name} type={type} value={details[name]} required autoComplete="off" autoFocus={autoFocus}
        onChange={(e) => onChange(name, e.target.value)} />
    </div>
  );
}

/* Optional: fill the customer's details from a CRM contact. */
function ContactPicker({ onPick }) {
  const { request } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows(null); return undefined; }
    let active = true;
    const t = setTimeout(() => {
      request("/contacts", { query: { search: term, page: 1, limit: 6 } })
        .then((res) => active && setRows(res.data?.items || res.data || []))
        .catch(() => active && setRows([]));
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q, request]);
  return (
    <div className="bnrb-picker" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <label htmlFor="bnrb-contact">Fill from a CRM contact <span className="bnrb-muted">(optional)</span></label>
      <input id="bnrb-contact" type="search" value={q} placeholder="Search name, email or phone" autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && rows && (
        <ul className="bnrb-picker-list">
          {rows.length === 0 && <li className="bnrb-picker-empty">No matching contacts.</li>}
          {rows.map((c) => (
            <li key={c._id}>
              <button type="button" onClick={() => { onPick(c); setQ(personLabel(c)); setOpen(false); }}>
                <span>{personLabel(c)}</span><small>{[c.email, c.phone].filter(Boolean).join(" · ")}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultView({ result, checkout, syncState, onClose, onAgain }) {
  const { kind, data: b } = result;
  const title = kind === "success" ? "Booking confirmed" : kind === "released" ? "Booking not completed" : "Your booking";
  const footer = kind === "released"
    ? <button type="button" className="bnrb-btn bnrb-again" onClick={onAgain}>Choose another time</button>
    : <button type="button" className="bnrb-btn bnrb-done" onClick={onClose}>Done</button>;
  return (
    <Shell title={title} step={0} onClose={onClose} footer={footer}>
      {kind === "success" && (
        <div className="bnrb-result">
          <div className="bnrb-check" aria-hidden="true">&#10003;</div>
          <h3>Payment successful</h3>
          <p>Your room is booked. A confirmation has been sent to <strong>{b.email}</strong>.</p>
          <dl className="bnrb-dl">
            <dt>Reference</dt><dd>{b.ref}</dd>
            <dt>Room</dt><dd>{b.room_label}</dd>
            <dt>Date</dt><dd>{b.date_label}</dd>
            <dt>Time</dt><dd>{b.start} – {b.end} ({hoursText(b.hours)})</dd>
            <dt>Amount paid</dt><dd>{b.amount}</dd>
          </dl>
          <p className="bnrb-sync" aria-live="polite">
            {syncState === "syncing" && <><i className="bnrb-spin" aria-hidden="true" /> Updating the CRM bookings list…</>}
            {syncState === "ok" && "The CRM bookings list and calendar are up to date."}
            {syncState === "failed" && "Saved in WordPress. The CRM list will catch up within 10 minutes."}
          </p>
        </div>
      )}
      {kind === "released" && (
        <div className="bnrb-result">
          <div className="bnrb-check is-x" aria-hidden="true">&times;</div>
          <h3>Payment not completed – slot released</h3>
          <p>{checkout?.ref ? `${checkout.ref} was not paid. ` : ""}The customer has not been charged and the time slot is free again.</p>
        </div>
      )}
      {kind === "error" && (
        <div className="bnrb-result">
          <div className="bnrb-check is-x" aria-hidden="true">!</div>
          <h3>We could not confirm this booking</h3>
          <p>{result.note || "Please contact us and we will sort it out."}</p>
        </div>
      )}
    </Shell>
  );
}
