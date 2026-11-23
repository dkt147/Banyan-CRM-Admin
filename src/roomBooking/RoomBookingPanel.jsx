import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";
import { usePermissions } from "../utils/permissions";
import { amountText, channelText, customerName, isPartnerBlock, partnerTitle, stripeUrl } from "./roomBooking";

// Read-only side panel for one WordPress room booking (GET /room-bookings/:ref).
// WordPress owns the booking: cancel, reschedule and refunds happen in WP Admin and Stripe.

export function RoomStatusBadge({ status, label }) {
  const text = label || { paid: "Paid", pending: "Awaiting payment", blocked: "Blocked", cancelled: "Cancelled", expired: "Expired", error: "Error" }[status] || status;
  return <span className={`rb-status rb-status-${status}`}>{text}</span>;
}

export function TestBadge() {
  return <span className="rb-test" title="Stripe test mode, not counted in revenue">TEST</span>;
}

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" }) : "—");

export default function RoomBookingPanel({ bookingRef, onClose, onChanged }) {
  const { request } = useAuth();
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setRow(null); setError("");
    request(`/room-bookings/${encodeURIComponent(bookingRef)}`)
      .then((r) => active && setRow(r.data))
      .catch((e) => active && setError(e.status === 404 ? "This booking is not in the CRM yet. It appears after the next sync." : e.message));
    return () => { active = false; };
  }, [bookingRef, request]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const perms = usePermissions();
  const canWrite = perms.can("bookings.write");
  const canRefund = perms.can("bookings.refund");
  const [retrying, setRetrying] = useState(false);
  const [cancel, setCancel] = useState(null);   // null | { reason, refund, busy, error }
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // POST /room-bookings/:ref/cancel → WordPress cancels (and refunds in Stripe), then the CRM re-syncs.
  async function submitCancel() {
    setCancel((c) => ({ ...c, busy: true, error: "" }));
    try {
      await request(`/room-bookings/${encodeURIComponent(bookingRef)}/cancel`, {
        method: "POST",
        body: { refund: Boolean(cancel.refund), reason: cancel.reason.trim() || undefined },
      });
      const fresh = await request(`/room-bookings/${encodeURIComponent(bookingRef)}`).catch(() => null);
      if (fresh?.data) setRow(fresh.data); else setRow((x) => ({ ...x, status: "cancelled", statusLabel: "Cancelled" }));
      setCancel(null);
      onChanged?.();
      // The calendar removal runs just after the cancel response: reload once more shortly after.
      setTimeout(() => {
        request(`/room-bookings/${encodeURIComponent(bookingRef)}`)
          .then((r) => { if (mounted.current && r?.data) setRow(r.data); })
          .catch(() => {});
      }, 2500);
    } catch (e) {
      setCancel((c) => ({ ...c, busy: false, error: e.message || "Could not cancel the booking." }));
    }
  }
  async function retryCalendar() {
    setRetrying(true);
    try {
      const r = await request(`/room-bookings/${encodeURIComponent(bookingRef)}/google-calendar-sync`, { method: "POST", body: {} });
      const fresh = await request(`/room-bookings/${encodeURIComponent(bookingRef)}`).catch(() => null);
      setRow((x) => fresh?.data || { ...x, googleCalendar: r.data?.googleCalendar || r.data || x.googleCalendar });
    } catch (e) {
      setRow((x) => ({ ...x, googleCalendar: { ...(x.googleCalendar || {}), error: e.message, status: "error", retry: true, label: `Calendar update failed: ${e.message}` } }));
    } finally { setRetrying(false); }
  }

  const blocked = row?.status === "blocked";
  const partner = blocked && isPartnerBlock(row);
  const gcal = row?.googleCalendar;
  const roomShort = row?.roomKey === "library" || /library/i.test(row?.roomName || "") ? "Library" : "room";
  const payment = row?.payment;
  const link = stripeUrl(payment);
  const byCredits = payment?.method === "credits";
  const contactId = row?.contact?.id;
  // Backend (24 Nov) sends googleCalendar.status/label/retry; older rows fall back to eventId/error.
  const gcalLabel = gcal?.label || (gcal?.error ? null : gcal?.eventId ? `In ${roomShort} calendar`
    : gcal?.action === "removed" ? `Removed from ${roomShort} calendar${gcal.reason === "status_cancelled" ? " (cancelled)" : ""}`
      : "Not in the room calendar");
  const gcalFailed = gcal?.status ? gcal.status === "error" : Boolean(gcal?.error);
  const showRetry = gcal && (typeof gcal.retry === "boolean" ? gcal.retry : Boolean(gcal.error));

  return (
    <div className="rb-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer rb-drawer" role="dialog" aria-modal="true" aria-labelledby="rb-drawer-title">
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Meeting room booking</span>
            <h2 id="rb-drawer-title">{bookingRef}</h2>
            {row && <div className="rb-drawer-badges"><RoomStatusBadge status={row.status} label={row.statusLabel} />{payment?.isTest && !byCredits && <TestBadge />}{row.viaCrm && <span className="rb-source">CRM</span>}</div>}
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          {error && <div className="notice error"><b>Booking</b><span>{error}</span></div>}
          {!row && !error && <p className="rb-muted">Loading…</p>}
          {row && <>
            <h3 className="rb-section">Booking</h3>
            <dl>
              <dt>Room</dt><dd>{row.roomName}</dd>
              <dt>Date</dt><dd>{row.dateLabel}</dd>
              <dt>Time</dt><dd>{row.startTime}–{row.endTime} ({row.hours}h)</dd>
              {row.status === "pending" && row.holdExpiresAt && <><dt>Hold ends</dt><dd>{fmt(row.holdExpiresAt)}</dd></>}
              <dt>Source</dt><dd>{partner ? "Partner (calendar) · blocked from the room's Google Calendar" : channelText(row)}</dd>
              {row.status === "cancelled" && (row.cancelledAt || row.cancelledBy || row.cancelReason) && <>
                <dt>Cancelled</dt><dd>{fmt(row.cancelledAt)}{row.cancelledBy ? ` by ${row.cancelledBy}` : ""}</dd>
                {row.cancelReason && <><dt>Reason</dt><dd>{row.cancelReason}</dd></>}
              </>}
              <dt>Created</dt><dd>{fmt(row.createdAt)}</dd>
              <dt>Last synced</dt><dd>{fmt(row.syncedAt)}</dd>
            </dl>

            <h3 className="rb-section">Google Calendar</h3>
            {partner ? <p className="rb-muted">This block comes from your partner's meeting "{partnerTitle(row)}", which is already in the room calendar. It is removed automatically when that meeting is moved or deleted.</p>
              : !gcal ? <p className="rb-muted">Not in Google Calendar (no calendar is set for this room, the booking predates the setting, or it isn't paid).</p>
                : <dl>
                  <dt>Status</dt><dd>{gcalFailed && !gcal.label ? <span className="rb-error">{gcal.error}</span> : gcalFailed ? <span className="rb-error">{gcalLabel}</span> : gcalLabel}</dd>
                  {gcal.syncedAt && <><dt>Updated</dt><dd>{fmt(gcal.syncedAt)}</dd></>}
                </dl>}
            {!partner && canWrite && showRetry && (
              <button type="button" className="btn ghost rb-retry" onClick={retryCalendar} disabled={retrying}>{retrying ? "Retrying…" : "Retry calendar update"}</button>
            )}

            <h3 className="rb-section">{blocked ? "Reason" : "Customer"}</h3>
            <dl>
              {!blocked && <>
                <dt>Name</dt><dd>{customerName(row.customer) || "—"}</dd>
                <dt>Email</dt><dd>{row.customer?.email ? <a href={`mailto:${row.customer.email}`}>{row.customer.email}</a> : "—"}</dd>
                <dt>Phone</dt><dd>{row.customer?.phone ? <a href={`tel:${row.customer.phone.replace(/\s/g, "")}`}>{row.customer.phone}</a> : "—"}</dd>
                <dt>CRM contact</dt><dd>{contactId ? <Link to={recordHref.contact(contactId)}>{customerName(row.contact) || "Open contact"}</Link> : "Not linked"}</dd>
              </>}
              <dt>Notes</dt><dd className="rb-notes">{row.notes || row.customer?.notes || "—"}</dd>
            </dl>

            {!blocked && payment && <>
              <h3 className="rb-section">Payment</h3>
              <dl>
                <dt>Amount</dt><dd>{byCredits ? amountText(row) : <>{payment.amountLabel || "—"} {payment.currency}</>}{payment.isTest && !byCredits && <> <TestBadge /></>}</dd>
                <dt>Status</dt><dd>{payment.status || "—"}</dd>
                <dt>Paid at</dt><dd>{fmt(payment.paidAt)}</dd>
                {payment.refund && <><dt>Refund</dt><dd>
                  {payment.refund.status === "succeeded" ? "Refunded" : `Refund ${payment.refund.status || "requested"}`}
                  {payment.refund.amount != null ? ` HK$${Number(payment.refund.amount).toLocaleString("en-HK")}` : ""}
                  {payment.refund.id && <span className="rb-mono"> · {payment.refund.id}</span>}
                </dd></>}
                <dt>Mode</dt><dd>{byCredits ? "Meeting room credits (not revenue)" : payment.mode === "test" ? "Test (excluded from revenue)" : payment.mode === "live" ? "Live" : "—"}</dd>
                {payment.stripePaymentIntent && <><dt>Payment intent</dt><dd className="rb-mono">{payment.stripePaymentIntent}</dd></>}
                {payment.stripeSessionId && <><dt>Checkout session</dt><dd className="rb-mono">{payment.stripeSessionId}</dd></>}
              </dl>
            </>}

            {Array.isArray(row.timeline) && row.timeline.length > 0 && <>
              <h3 className="rb-section">History</h3>
              <ol className="rb-timeline">
                {row.timeline.map((t, i) => (
                  <li key={`${t.at}-${i}`}>
                    <time>{fmt(t.at)}</time>
                    <span>{t.text}{t.by ? ` · ${t.by}` : ""}</span>
                  </li>
                ))}
              </ol>
            </>}

            {cancel && (
              <div className="rb-cancel" role="group" aria-label="Cancel booking">
                <h3 className="rb-section">Cancel {bookingRef}</h3>
                <p>The time is freed on the website and the customer gets the normal cancellation email. The event is removed from Google Calendar.</p>
                <label>Reason (optional)
                  <textarea rows={2} maxLength={500} value={cancel.reason} disabled={cancel.busy} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })} placeholder="e.g. Customer moved to next week" />
                </label>
                {canRefund && row.status === "paid" && !byCredits && (
                  <label className="fm-inline"><input type="checkbox" checked={cancel.refund} disabled={cancel.busy} onChange={(e) => setCancel({ ...cancel, refund: e.target.checked })} /> Refund in full ({payment?.amountLabel || "the amount paid"}) through Stripe{payment?.isTest ? " (test mode)" : ""}</label>
                )}
                {byCredits && <p className="rb-muted">Paid with meeting room credits: the {row.hours} h go back to the company's credits for that month.</p>}
                {!canRefund && row.status === "paid" && !byCredits && <p className="rb-muted">Only an admin can refund. Cancelling here doesn't refund the payment.</p>}
                {cancel.error && <div className="notice error"><b>Not cancelled</b><span>{cancel.error}</span></div>}
              </div>
            )}

            <div className="notice rb-readonly"><b>Managed in WordPress</b><span>To reschedule or block time, use WP Admin → Room Bookings.{canWrite && ["paid", "pending"].includes(row.status) ? " Cancel below; the change is made in WordPress." : ""}</span></div>
          </>}
        </div>
        <div className="drawer-actions">
          {cancel ? <>
            <button type="button" className="btn danger" onClick={submitCancel} disabled={cancel.busy}>
              {cancel.busy ? "Cancelling…" : cancel.refund ? "Cancel and refund" : "Cancel booking"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setCancel(null)} disabled={cancel.busy}>Keep booking</button>
          </> : <>
            {link && <a className="btn primary" href={link} target="_blank" rel="noreferrer">View in Stripe</a>}
            {canWrite && row && !partner && ["paid", "pending"].includes(row.status) && (
              <button type="button" className="btn ghost" onClick={() => setCancel({ reason: "", refund: false, busy: false, error: "" })}>{row.status === "pending" ? "Cancel hold" : "Cancel booking"}</button>
            )}
            <button type="button" className="btn ghost" onClick={onClose}>Close</button>
          </>}
        </div>
      </aside>
    </div>
  );
}
