import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Eventbrite sign-ups for a contact, or for the people at a company (decided 27 Nov:
// connect Eventbrite rather than build our own event checkout).
// GET /event-registrations?contactId=|companyId=&limit=20 → { items, pagination }
// Each item: { _id, status, ticketClass, amount, currency, registeredAt, checkedInAt,
//              eventId: { _id, name, startAt, url }, contactId: { _id, firstName, lastName, email } }

export const REG_STATUS = { attending: "Attending", checked_in: "Checked in", cancelled: "Cancelled", refunded: "Refunded", not_attending: "Not attending" };
export const eventDate = (v, withTime = false) => {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Hong_Kong",
  });
};
export const ticketPrice = (r) => (Number(r?.amount) > 0 ? `${r.currency === "HKD" || !r.currency ? "HK$" : `${r.currency} `}${Number(r.amount).toLocaleString("en-HK", { maximumFractionDigits: 2 })}` : "Free");
const person = (c) => (c && typeof c === "object" ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email : "");

export function useRecordEvents(type, id) {
  const { request } = useAuth();
  const [state, setState] = useState({ items: [], total: null, loading: true, error: "", missing: false });
  useEffect(() => {
    if (!id || (type !== "contact" && type !== "company")) { setState((s) => ({ ...s, loading: false, total: null })); return undefined; }
    let alive = true;
    request("/event-registrations", { query: { [`${type}Id`]: id, sort: "registeredAt", order: "desc", limit: 20, page: 1 } })
      .then((r) => {
        if (!alive) return;
        const items = r.data?.items || (Array.isArray(r.data) ? r.data : []);
        setState({ items, total: r.pagination?.total ?? r.data?.pagination?.total ?? items.length, loading: false, error: "", missing: false });
      })
      .catch((e) => alive && setState({ items: [], total: null, loading: false, missing: e.status === 404, error: e.status === 404 ? "" : e.message || "Could not load events." }));
    return () => { alive = false; };
  }, [request, type, id]);
  return state;
}

export default function RecordEvents({ state, forCompany }) {
  const { items, total, loading, error, missing } = state;
  if (missing) return <p className="rr-empty">Eventbrite sign-ups need the latest server update.</p>;
  if (error) return <p className="rr-empty rr-error">{error}</p>;
  if (loading) return <p className="rr-empty">Loading events…</p>;
  if (!items.length) return <p className="rr-empty">No event sign-ups yet. Eventbrite registrations show here once Eventbrite is connected (Settings → Integrations).</p>;
  return (
    <ul className="rr-list">
      {items.map((r) => {
        const ev = r.eventId && typeof r.eventId === "object" ? r.eventId : null;
        return (
          <li key={r._id}>
            <Link to={ev ? `/events/${ev._id}` : "/events"} className="rr-item">
              <span className="rr-item-main">
                <b>{ev?.name || "Event"}</b>
                <small>{[eventDate(ev?.startAt, true), forCompany && person(r.contactId), r.ticketClass, ticketPrice(r)].filter(Boolean).join(" · ")}</small>
              </span>
              <span className="rr-item-side">
                <span className={`rr-status ev-st-${r.status}`}>{REG_STATUS[r.status] || r.status}</span>
                <time>Signed up {eventDate(r.registeredAt)}</time>
              </span>
            </Link>
          </li>
        );
      })}
      {total > items.length && <li className="rr-more">Showing the latest {items.length} of {total}.</li>}
    </ul>
  );
}
