import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";
import { customerName, stripeUrl } from "./roomBooking";

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

export default function RoomBookingPanel({ bookingRef, onClose }) {
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

  const blocked = row?.status === "blocked";
  const payment = row?.payment;
  const link = stripeUrl(payment);
  const contactId = row?.contact?.id;

  return (
    <div className="rb-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer rb-drawer" role="dialog" aria-modal="true" aria-labelledby="rb-drawer-title">
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Meeting room booking</span>
            <h2 id="rb-drawer-title">{bookingRef}</h2>
            {row && <div className="rb-drawer-badges"><RoomStatusBadge status={row.status} label={row.statusLabel} />{payment?.isTest && <TestBadge />}{row.viaCrm && <span className="rb-source">CRM</span>}</div>}
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
              <dt>Source</dt><dd>{row.channel === "admin" ? "WP Admin" : "Website checkout"}{row.viaCrm ? " · booked via CRM" : ""}</dd>
              <dt>Created</dt><dd>{fmt(row.createdAt)}</dd>
              <dt>Last synced</dt><dd>{fmt(row.syncedAt)}</dd>
            </dl>

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
                <dt>Amount</dt><dd>{payment.amountLabel || "—"} {payment.currency}{payment.isTest && <> <TestBadge /></>}</dd>
                <dt>Status</dt><dd>{payment.status || "—"}</dd>
                <dt>Paid at</dt><dd>{fmt(payment.paidAt)}</dd>
                <dt>Mode</dt><dd>{payment.mode === "test" ? "Test (excluded from revenue)" : payment.mode === "live" ? "Live" : "—"}</dd>
                {payment.stripePaymentIntent && <><dt>Payment intent</dt><dd className="rb-mono">{payment.stripePaymentIntent}</dd></>}
                {payment.stripeSessionId && <><dt>Checkout session</dt><dd className="rb-mono">{payment.stripeSessionId}</dd></>}
              </dl>
            </>}

            <div className="notice rb-readonly"><b>Managed in WordPress</b><span>To cancel, reschedule or block time, use WP Admin → Room Bookings. Refunds are issued in Stripe.</span></div>
          </>}
        </div>
        <div className="drawer-actions">
          {link && <a className="btn primary" href={link} target="_blank" rel="noreferrer">View in Stripe</a>}
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </aside>
    </div>
  );
}
