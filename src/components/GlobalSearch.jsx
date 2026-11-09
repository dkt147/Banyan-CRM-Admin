import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";

const STATUS = { pending_payment: "Pending payment", held: "Hold" };
const fmt = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "");

// Global search (GET /search): contacts with their company, bookings and deals,
// plus companies, deals and bookings that match directly.
export default function GlobalSearch() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ data: null, loading: false, error: "" });
  const wrap = useRef(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setState({ data: null, loading: false, error: "" }); return undefined; }
    let active = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const timer = setTimeout(() => {
      request("/search", { query: { q: term } })
        .then((r) => active && setState({ data: r.data, loading: false, error: "" }))
        .catch((e) => active && setState({ data: null, loading: false, error: e.message || "Search failed." }));
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [q, request]);

  useEffect(() => {
    const close = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (href) => { setOpen(false); setQ(""); navigate(href); };
  const d = state.data;
  const empty = d && !d.contacts.length && !d.companies.length && !d.deals.length && !d.bookings.length;

  return (
    <div className="gs" ref={wrap}>
      <label className="gs-input">
        <Icon name="MagnifyingGlass" size={15} weight="regular" />
        <input type="search" value={q} placeholder="Search contacts, bookings, deals…" aria-label="Global search"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
      </label>
      {open && q.trim().length >= 2 && (
        <div className="gs-panel" role="listbox">
          {state.error && <p className="gs-empty">{state.error}</p>}
          {state.loading && !d && <p className="gs-empty">Searching…</p>}
          {empty && <p className="gs-empty">No matches for “{q.trim()}”.</p>}
          {d?.contacts.length > 0 && <Group title="Contacts">
            {d.contacts.map((c) => (
              <div key={c.id} className="gs-contact">
                <button type="button" className="gs-item" onClick={() => go(recordHref.contact(c.id))}>
                  <b>{c.label}</b>
                  <small>{[c.email, c.company?.label].filter(Boolean).join(" · ")}</small>
                </button>
                <div className="gs-facts">
                  <button type="button" onClick={() => go(`/bookings?contactId=${c.id}`)}>{c.bookingCount} booking{c.bookingCount === 1 ? "" : "s"}{c.nextBookingAt ? ` · next ${fmt(c.nextBookingAt)}` : ""}</button>
                  <span>{c.dealCount} deal{c.dealCount === 1 ? "" : "s"}</span>
                  {c.company && <button type="button" onClick={() => go(recordHref.company(c.company.id))}>{c.company.label}</button>}
                </div>
              </div>
            ))}
          </Group>}
          {d?.bookings.length > 0 && <Group title="Bookings">{d.bookings.map((b) => <Item key={b.id} label={b.label} sub={`${fmt(b.date)} · ${STATUS[b.status] || b.status}${b.sublabel ? ` · ${b.sublabel}` : ""}`} onClick={() => go(recordHref.booking(b.id))} />)}</Group>}
          {d?.deals.length > 0 && <Group title="Deals">{d.deals.map((x) => <Item key={x.id} label={x.label} sub={[x.dealNumber && `#${x.dealNumber}`, x.sublabel, x.status].filter(Boolean).join(" · ")} onClick={() => go(recordHref.deal(x.id))} />)}</Group>}
          {d?.companies.length > 0 && <Group title="Companies">{d.companies.map((x) => <Item key={x.id} label={x.label} sub={x.sublabel} onClick={() => go(recordHref.company(x.id))} />)}</Group>}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }) {
  return <div className="gs-group"><span className="gs-group-title">{title}</span>{children}</div>;
}
function Item({ label, sub, onClick }) {
  return <button type="button" className="gs-item" onClick={onClick}><b>{label}</b>{sub && <small>{sub}</small>}</button>;
}
