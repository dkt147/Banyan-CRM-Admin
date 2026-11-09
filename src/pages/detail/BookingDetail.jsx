import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Badge from "../../components/Badge";
import { Card, DetailLayout, FieldGrid, fmtDateTime } from "../../components/DetailLayout";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../utils/permissions";
import { recordHref } from "../../utils/recordLinks";
import { personLabel, useLookups } from "../../utils/useLookups";
import { fromHkInput } from "../../utils/hkTime";

export const BOOKING_STATUSES = [
  ["pending_payment", "Pending payment"], ["held", "Provisional hold"], ["pending", "Pending"], ["confirmed", "Confirmed"],
  ["completed", "Completed"], ["cancelled", "Cancelled"], ["expired", "Expired"], ["no_show", "No-show"], ["refunded", "Refunded"],
];
export const bookingStatusLabel = (s) => (BOOKING_STATUSES.find(([v]) => v === s) || [])[1] || s || "—";
export const BOOKING_TYPES = [["meeting_room", "Meeting room"], ["day_pass", "Day pass"], ["studio", "Studio"], ["venue", "Venue"], ["photoshoot", "Photoshoot"], ["podcast", "Podcast"], ["event_space", "Event space"], ["trial", "Trial"], ["viewing", "Viewing"]];
const PAYMENT = { not_required: "Not required", unpaid: "Unpaid", paid: "Paid", refunded: "Refunded", failed: "Failed" };
const EXPIRING = ["held", "pending_payment"];
export const effectiveStatus = (b) => b?.displayStatus || (EXPIRING.includes(b?.status) && b?.holdExpiresAt && new Date(b.holdExpiresAt) <= new Date() ? "expired" : b?.status);

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { request } = useAuth();
  const canWrite = usePermissions().can("bookings.write");
  const { contacts, companies, deals } = useLookups(["contacts", "companies", "deals"]);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setBooking((await request(`/bookings/${id}`)).data || null); }
    catch (e) { setError(e.status === 404 ? "This booking was not found." : e.message || "Could not load the booking."); }
    finally { setLoading(false); }
  }, [id, request]);
  useEffect(() => { load(); }, [load]);

  async function save(changed) {
    const body = { ...changed };
    for (const key of ["startAt", "endAt"]) if (key in body) body[key] = fromHkInput(body[key]).toISOString();
    const start = new Date(body.startAt || booking.startAt), end = new Date(body.endAt || booking.endAt);
    if (end <= start) throw new Error("End time must be after start time.");
    if ("price" in body) body.price = Number(body.price) || 0;
    if ("attendees" in body) body.attendees = body.attendees === "" ? null : Number(body.attendees);
    for (const key of ["companyId", "dealId"]) if (key in body && !body[key]) body[key] = null;
    await request(`/bookings/${id}`, { method: "PATCH", body });
    await load();
  }
  async function act(kind) {
    if (kind === "cancel" && !window.confirm("Cancel this booking and free the room?")) return;
    setActionError("");
    try { await request(`/calendar/${id}/${kind}`, { method: "PATCH" }); await load(); }
    catch (e) { setActionError(e.message); }
  }
  async function remove() {
    if (!window.confirm("Delete this booking permanently?")) return;
    try { await request(`/bookings/${id}`, { method: "DELETE" }); navigate("/bookings"); }
    catch (e) { setActionError(e.message); }
  }

  const status = effectiveStatus(booking);
  const contact = booking?.contactId && typeof booking.contactId === "object" ? booking.contactId : null;
  const company = booking?.companyId && typeof booking.companyId === "object" ? booking.companyId : null;
  const deal = booking?.dealId && typeof booking.dealId === "object" ? booking.dealId : null;
  const withCurrent = (rows, current) => current && !rows.some((r) => r._id === current._id) ? [...rows, current] : rows;
  const contactRequired = booking?.source !== "google";

  return (
    <DetailLayout
      type="booking" id={id} listPath="/bookings" listLabel="Bookings"
      title={booking ? booking.title || booking.resourceName || "Booking" : ""}
      subtitle={booking ? `${fmtDateTime(booking.startAt)} – ${new Date(booking.endAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
      loading={loading} error={error} onRetry={load}
      badges={booking && <><span className={`status-pill status-${status}`}>{bookingStatusLabel(status)}</span>{!contact && <Badge tone="warn">Unlinked</Badge>}<Badge>{booking.source === "website" ? "Website" : booking.source === "google" ? "Google Calendar" : "CRM"}</Badge></>}
      actions={canWrite && booking && <>
        {["held", "pending", "pending_payment"].includes(booking.status) && <button type="button" className="btn primary" onClick={() => act("confirm")}>Confirm</button>}
        {!["cancelled", "completed", "refunded"].includes(booking.status) && <button type="button" className="btn ghost" onClick={() => act("cancel")}>Cancel booking</button>}
        <button type="button" className="btn ghost" onClick={remove}>Delete</button>
      </>}
    >
      {actionError && <div className="notice error"><b>Bookings</b><span>{actionError}</span></div>}
      {booking && <>
        <Card title="Linked records">
          <dl className="dl-fields">
            <div className="dl-field"><dt>Contact</dt><dd>{contact ? <Link to={recordHref.contact(contact._id)}>{personLabel(contact)}</Link> : "Not linked — choose a contact below"}</dd></div>
            <div className="dl-field"><dt>Company</dt><dd>{company ? <Link to={recordHref.company(company._id)}>{company.name}</Link> : "—"}</dd></div>
            <div className="dl-field"><dt>Deal</dt><dd>{deal ? <Link to={recordHref.deal(deal._id)}>{deal.title}</Link> : "—"}</dd></div>
            <div className="dl-field"><dt>Payment</dt><dd>{PAYMENT[booking.paymentStatus] || "—"}{booking.amountMinor != null ? ` · ${(booking.amountMinor / 100).toLocaleString("en-HK", { style: "currency", currency: booking.currency || "HKD" })}` : ""}</dd></div>
            {EXPIRING.includes(booking.status) && <div className="dl-field"><dt>Hold expires</dt><dd>{fmtDateTime(booking.holdExpiresAt)}</dd></div>}
          </dl>
        </Card>
        <FieldGrid
          canEdit={canWrite}
          onSave={save}
          fields={[
            { key: "title", label: "Title", value: booking.title, span: true },
            { key: "resourceName", label: "Room / resource", value: booking.resourceName },
            { key: "bookingType", label: "Type", type: "select", value: booking.bookingType || "meeting_room", options: withCurrent(BOOKING_TYPES.map(([v, l]) => ({ _id: v, l })), booking.bookingType ? { _id: booking.bookingType, l: booking.bookingType } : null).map((o) => [o._id, o.l]), display: (BOOKING_TYPES.find(([v]) => v === booking.bookingType) || [])[1] || booking.bookingType },
            { key: "startAt", label: "Start", type: "datetime-local", value: booking.startAt, required: true, display: fmtDateTime(booking.startAt) },
            { key: "endAt", label: "End", type: "datetime-local", value: booking.endAt, required: true, display: fmtDateTime(booking.endAt) },
            { key: "status", label: "Status", type: "select", value: booking.status, options: BOOKING_STATUSES, display: bookingStatusLabel(status) },
            { key: "attendees", label: "Attendees", type: "number", value: booking.attendees },
            { key: "contactId", label: "Contact", type: "select", required: contactRequired, value: contact?._id || "", options: [["", "Select contact"], ...withCurrent(contacts, contact).map((c) => [c._id, personLabel(c)])], display: contact ? personLabel(contact) : "—" },
            { key: "companyId", label: "Company", type: "select", value: company?._id || "", options: [["", "No company"], ...withCurrent(companies, company).map((c) => [c._id, c.name])], display: company?.name || "—" },
            { key: "dealId", label: "Deal", type: "select", value: deal?._id || "", options: [["", "No deal"], ...withCurrent(deals, deal).map((d) => [d._id, d.title])], display: deal?.title || "—" },
            { key: "price", label: `Price (${booking.currency || "HKD"})`, type: "number", value: booking.price ?? 0 },
            { key: "notes", label: "Notes", type: "textarea", value: booking.notes, span: true },
          ]}
        />
        <Card title="Record">
          <dl className="dl-fields">
            <div className="dl-field"><dt>Created by</dt><dd>{booking.createdBy?.name || "—"}</dd></div>
            <div className="dl-field"><dt>Created</dt><dd>{fmtDateTime(booking.createdAt)}</dd></div>
          </dl>
        </Card>
      </>}
    </DetailLayout>
  );
}
