import React, { useState } from "react";
import { Link } from "react-router-dom";
import { RelatedSection, TimelineItem, isChangeItem, isNoteItem } from "./RelatedRecords";
import RecordNotes from "./RecordNotes";
import RecordInvoices, { useRecordInvoices } from "./RecordInvoices";
import { recordHref } from "../utils/recordLinks";

// Contact, company and deal pages: activity, notes, emails, invoices… as tabs in the main
// column, like HubSpot (client feedback 26 Nov), instead of small buttons on the right.

const TAB_KEY = "banyan-record-tab";
const readTab = () => { try { return localStorage.getItem(TAB_KEY) || "activity"; } catch { return "activity"; } };
const keepTab = (t) => { try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };

const FILTERS = [["all", "All"], ["notes", "Notes"], ["changes", "Changes"], ["other", "Other"]];

function ActivityFeed({ related }) {
  const [filter, setFilter] = useState("all");
  const { data, loading, error } = related;
  const all = data?.sections?.activities?.items || [];
  const items = all.filter((i) => filter === "all" || (filter === "notes" ? isNoteItem(i) : filter === "changes" ? isChangeItem(i) : !isNoteItem(i) && !isChangeItem(i)));
  const total = data?.sections?.activities?.total ?? all.length;
  return (
    <>
      <div className="rt-filters" role="group" aria-label="Show">
        {FILTERS.map(([k, l]) => <button key={k} type="button" className={filter === k ? "active" : ""} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {error ? <p className="rr-empty rr-error">{error}</p>
        : loading && !data ? <p className="rr-empty">Loading activity…</p>
          : !items.length ? <p className="rr-empty">{filter === "all" ? "No activity yet." : "Nothing of this kind yet."}</p>
            : <ol className="tl tl-wide">{items.map((i) => <TimelineItem key={i.id} item={i} />)}</ol>}
      {total > all.length && <p className="rr-more">Showing the latest {all.length} of {total}.</p>}
    </>
  );
}

export default function RecordTabs({ type, id, related, legacyNotes, showLinks }) {
  const invoices = useRecordInvoices(type, id);
  const [tab, setTabState] = useState(readTab);
  const setTab = (t) => { setTabState(t); keepTab(t); };
  const count = (key) => (related.data ? related.data.sections?.[key]?.total ?? 0 : null);

  const tabs = [
    ["activity", "Activity", count("activities")],
    ["notes", "Notes", related.data?.sections?.notes?.total ?? null],
    ["emails", "Emails", count("emails")],
    ["whatsapp", "WhatsApp", count("whatsapp")],
    ["tasks", "Tasks", count("tasks")],
    type !== "deal" && ["deals", "Deals", count("deals")],
    ["bookings", "Bookings", count("bookings")],
    ["invoices", "Invoices", invoices.loading ? null : invoices.total],
    ["files", "Files", count("files")],
  ].filter(Boolean);
  const active = tabs.some(([k]) => k === tab) ? tab : "activity";

  const links = related.data?.links || {};
  const linkRows = [
    links.contact && ["Contact", recordHref.contact(links.contact.id), links.contact.label],
    links.company && ["Company", recordHref.company(links.company.id), links.company.label],
    links.deal && ["Deal", recordHref.deal(links.deal.id), links.deal.label],
  ].filter(Boolean);

  return (
    <section className="dl-card rt" aria-label="Activity and related records">
      {showLinks && linkRows.length > 0 && (
        <div className="rr-links">
          {linkRows.map(([label, href, text]) => <Link key={label} to={href} className="rr-link-chip"><span>{label}</span><b>{text}</b></Link>)}
        </div>
      )}
      <div className="rt-tabs" role="tablist">
        {tabs.map(([key, label, n]) => (
          <button key={key} type="button" role="tab" id={`rt-${key}`} aria-selected={active === key} aria-controls="rt-panel"
            className={active === key ? "active" : ""} onClick={() => setTab(key)}>
            {label}{n != null && <span className="rr-count">{n}</span>}
          </button>
        ))}
      </div>
      <div className="rt-panel" id="rt-panel" role="tabpanel" aria-labelledby={`rt-${active}`}>
        {active === "activity" && <ActivityFeed related={related} />}
        {active === "notes" && <RecordNotes type={type} id={id} legacy={legacyNotes} onChanged={related.reload} />}
        {active === "invoices" && <RecordInvoices state={invoices} />}
        {["emails", "whatsapp", "tasks", "deals", "bookings", "files"].includes(active) && <RelatedSection tab={active === "bookings" ? "bookings" : active} related={related} />}
        {active === "emails" && <p className="lk-muted rt-hint">Emails sent and received through the shared inbox. Open one to reply from the Inbox.</p>}
        {active === "whatsapp" && <p className="lk-muted rt-hint">WhatsApp conversations with this {type}. Open one to reply from the Inbox.</p>}
      </div>
    </section>
  );
}
