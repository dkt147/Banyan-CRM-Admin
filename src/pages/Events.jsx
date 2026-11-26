import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";
import { REG_STATUS, eventDate, ticketPrice } from "../components/RecordEvents";

// Events from Eventbrite (decided 27 Nov: connect Eventbrite, option 1 of the client's note).
// Eventbrite stays the place to create events and sell tickets; the CRM reads events and
// sign-ups, creates or updates the contact for every attendee and tags them "eventbrite".
//   GET /events?when=upcoming|past|all&search=&page=&limit=  → { items, pagination }
//   GET /events/:id                                         → event
//   GET /event-registrations?eventId=&limit=200             → { items, pagination }

const WHEN = [["upcoming", "Upcoming"], ["past", "Past"], ["all", "All"]];
const EVENT_STATUS = { live: "On sale", started: "Happening now", ended: "Ended", completed: "Ended", canceled: "Cancelled", draft: "Draft" };

function MissingServer() {
  return <div className="notice"><b>Events</b><span>Events need the latest server update. Once it's live, connect Eventbrite in Settings → Integrations.</span></div>;
}

export default function Events() {
  const { request } = useAuth();
  const [when, setWhen] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ items: [], pagination: null, loading: true, error: "", missing: false });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    request("/events", { query: { when, search: term || undefined, page, limit: 25, sort: "startAt", order: when === "past" ? "desc" : "asc" } })
      .then((r) => alive && setState({ items: r.data?.items || [], pagination: r.pagination || r.data?.pagination || null, loading: false, error: "", missing: false }))
      .catch((e) => alive && setState({ items: [], pagination: null, loading: false, missing: e.status === 404, error: e.status === 404 ? "" : e.message || "Could not load events." }));
    return () => { alive = false; };
  }, [request, when, term, page]);

  const pages = state.pagination?.pages || state.pagination?.totalPages || 1;

  return (
    <Page title="Events" kicker="Eventbrite events and who signed up"
      actions={<Link className="btn ghost" to="/integrations">Eventbrite connection</Link>}>
      {state.missing ? <MissingServer /> : (
        <>
          <div className="ev-toolbar">
            <div className="rt-filters" role="group" aria-label="Show">
              {WHEN.map(([k, l]) => <button key={k} type="button" className={when === k ? "active" : ""} aria-pressed={when === k} onClick={() => { setWhen(k); setPage(1); }}>{l}</button>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setTerm(search.trim()); setPage(1); }} className="ev-search">
              <input type="search" placeholder="Search events" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search events" />
              <button type="submit" className="btn ghost">Search</button>
            </form>
          </div>
          {state.error && <div className="notice error"><b>Events</b><span>{state.error}</span></div>}
          <section className="panel table-wrap">
            <table>
              <thead><tr><th>Event</th><th>Date</th><th>Status</th><th>Sign-ups</th><th>Checked in</th></tr></thead>
              <tbody>
                {state.items.map((ev) => (
                  <tr key={ev._id}>
                    <td><Link to={`/events/${ev._id}`}><b>{ev.name}</b></Link>{ev.venue ? <div className="lk-muted">{ev.venue}</div> : null}</td>
                    <td>{eventDate(ev.startAt, true)}</td>
                    <td><Badge tone={ev.status === "canceled" ? "warn" : ev.status === "live" ? "success" : ""}>{EVENT_STATUS[ev.status] || ev.status || "—"}</Badge></td>
                    <td>{ev.registrationCount ?? ev.ticketsSold ?? 0}{ev.capacity ? ` / ${ev.capacity}` : ""}</td>
                    <td>{ev.checkedInCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.loading && <p className="rr-empty">Loading events…</p>}
            {!state.loading && !state.items.length && !state.error && <Empty text={when === "upcoming" ? "No upcoming events. Events appear here after the Eventbrite sync." : "No events found."} />}
          </section>
          {pages > 1 && (
            <div className="ev-pager">
              <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {page} of {pages}</span>
              <button type="button" className="btn ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

export function EventDetail() {
  const { id } = useParams();
  const { request } = useAuth();
  const [event, setEvent] = useState(null);
  const [regs, setRegs] = useState([]);
  const [state, setState] = useState({ loading: true, error: "", missing: false });
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setState({ loading: true, error: "", missing: false });
    try {
      const [e, r] = await Promise.all([
        request(`/events/${id}`),
        request("/event-registrations", { query: { eventId: id, limit: 200, page: 1, sort: "registeredAt", order: "asc" } }),
      ]);
      setEvent(e.data || null);
      setRegs(r.data?.items || []);
      setState({ loading: false, error: "", missing: false });
    } catch (e) {
      setState({ loading: false, missing: false, error: e.status === 404 ? "This event was not found, or events need the latest server update." : e.message || "Could not load the event." });
    }
  }, [id, request]);
  useEffect(() => { load(); }, [load]);

  const shown = regs.filter((r) => filter === "all" || r.status === filter);
  const counts = regs.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});

  return (
    <Page title={event?.name || "Event"} kicker={event ? [eventDate(event.startAt, true), event.venue].filter(Boolean).join(" · ") : "Eventbrite event"}
      actions={<>
        <Link className="btn ghost" to="/events">All events</Link>
        {event?.url && <a className="btn ghost" href={event.url} target="_blank" rel="noopener noreferrer">Open in Eventbrite</a>}
      </>}>
      {state.loading && <p className="rr-empty">Loading…</p>}
      {state.error && <div className="notice error"><b>Events</b><span>{state.error}</span></div>}
      {event && (
        <>
          <div className="ev-stats">
            <div><span>Signed up</span><b>{regs.length}{event.capacity ? ` / ${event.capacity}` : ""}</b></div>
            <div><span>Checked in</span><b>{counts.checked_in || 0}</b></div>
            <div><span>Cancelled or refunded</span><b>{(counts.cancelled || 0) + (counts.refunded || 0)}</b></div>
            <div><span>New contacts</span><b>{regs.filter((r) => r.contactCreated).length}</b></div>
          </div>
          <div className="rt-filters" role="group" aria-label="Show">
            {[["all", "All"], ["attending", "Attending"], ["checked_in", "Checked in"], ["cancelled", "Cancelled"], ["refunded", "Refunded"]].map(([k, l]) => (
              <button key={k} type="button" className={filter === k ? "active" : ""} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}{k !== "all" && counts[k] ? ` (${counts[k]})` : ""}</button>
            ))}
          </div>
          <section className="panel table-wrap">
            <table>
              <thead><tr><th>Attendee</th><th>Ticket</th><th>Status</th><th>Signed up</th></tr></thead>
              <tbody>
                {shown.map((r) => {
                  const c = r.contactId && typeof r.contactId === "object" ? r.contactId : null;
                  const label = c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email : r.name || r.email || "Attendee";
                  return (
                    <tr key={r._id}>
                      <td>
                        {c ? <Link to={recordHref.contact(c._id)}><b>{label}</b></Link> : <b>{label}</b>}
                        {r.contactCreated && <> <Badge tone="info">New contact</Badge></>}
                        <div className="lk-muted">{c?.email || r.email}</div>
                      </td>
                      <td>{[r.ticketClass, ticketPrice(r)].filter(Boolean).join(" · ")}</td>
                      <td><span className={`rr-status ev-st-${r.status}`}>{REG_STATUS[r.status] || r.status}</span></td>
                      <td>{eventDate(r.registeredAt, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!shown.length && <Empty text="No sign-ups of this kind." />}
          </section>
        </>
      )}
    </Page>
  );
}
