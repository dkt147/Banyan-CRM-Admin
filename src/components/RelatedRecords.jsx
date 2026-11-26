import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";

// Connected records for a contact, company, deal, task or booking (GET /related/:type/:id).
// Shows the records it links to, then tabs for bookings, deals, tasks, emails, WhatsApp,
// files and activity. Every item links to its own detail page where one exists.

const SECTIONS = [
  ["bookings", "Bookings & purchases"],
  ["deals", "Deals"],
  ["tasks", "Tasks"],
  ["emails", "Emails"],
  ["whatsapp", "WhatsApp"],
  ["files", "Files"],
  ["activities", "Activity"],
];

const STATUS_LABELS = {
  pending_payment: "Pending payment",
  held: "Provisional hold",
  in_progress: "In progress",
  purchased: "Purchased",
};

const fmtDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const statusLabel = (s) => (s ? STATUS_LABELS[s] || String(s).replace(/_/g, " ") : "");

function itemHref(section, item) {
  if (item.kind === "purchase") return recordHref.deal(item.dealId);
  if (section === "bookings") return recordHref.booking(item.id);
  if (section === "deals") return recordHref.deal(item.id);
  if (section === "tasks") return recordHref.task(item.id);
  if (section === "emails" || section === "whatsapp") return recordHref.conversation(item.id);
  return null;
}

function ItemBody({ item }) {
  return (
    <>
      <span className="rr-item-main">
        <b>{item.title}</b>
        {item.subtitle && <small>{item.subtitle}</small>}
      </span>
      <span className="rr-item-side">
        {item.status && <span className={`rr-status rr-status-${item.status}`}>{statusLabel(item.status)}</span>}
        {item.date && <time>{fmtDate(item.date)}</time>}
      </span>
    </>
  );
}

// Purchases (day passes, packages, venue/studio hire) come from GET /related in the
// bookings section with kind: "purchase", id "deal-<id>" and dealId.

/** One GET /related/:type/:id per record, shared by the timeline and the tabs. */
export function useRelated(type, id) {
  const { request } = useAuth();
  const [state, setState] = useState({ data: null, loading: false, error: "" });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!id) { setState({ data: null, loading: false, error: "" }); return undefined; }
    let active = true;
    setState((prev) => ({ data: version ? prev.data : null, loading: true, error: "" }));
    request(`/related/${type}/${id}`)
      .then((response) => { if (active) setState({ data: response.data || null, loading: false, error: "" }); })
      .catch((e) => { if (active) setState({ data: null, loading: false, error: e.message || "Could not load connected records." }); });
    return () => { active = false; };
  }, [type, id, request, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}

// Field names the server may send in "changed" when it doesn't send before/after values yet.
const FIELD_LABELS = {
  stageId: "Stage", pipelineId: "Pipeline", status: "Status", value: "Value", title: "Title", ownerId: "Owner",
  contactId: "Contact", companyId: "Company", expectedCloseDate: "Expected close", productType: "Product",
  source: "Source", description: "Description", lostReason: "Lost reason", paymentReceivedConfirmed: "Payment received",
  firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", whatsapp: "WhatsApp", tags: "Tags",
  jobTitle: "Job title", language: "Language", birthday: "Birthday", name: "Name", website: "Website", industry: "Industry",
  dueAt: "Due", priority: "Priority", assignedTo: "Assigned to",
};
const fieldLabel = (f) => FIELD_LABELS[f] || String(f).replace(/Id$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (c) => c.toUpperCase());
const showValue = (v) => (v === null || v === undefined || v === "" ? "empty" : Array.isArray(v) ? v.join(", ") || "none" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

export const isNoteItem = (item) => item?.type === "note";
export const isChangeItem = (item) => /(_updated|_changed|stage|status)/.test(String(item?.type || "")) || Boolean(item?.changes?.length || item?.changed?.length);

/** One timeline entry: what happened, who did it, and (for edits) each field's old → new value. */
export function TimelineItem({ item }) {
  const who = item.user?.name || item.userName;
  const changes = Array.isArray(item.changes) ? item.changes : [];
  const changedOnly = !changes.length && Array.isArray(item.changed) ? item.changed.filter((f) => f !== "updatedAt") : [];
  return (
    <li className={isNoteItem(item) ? "tl-note" : ""}>
      <span className="tl-dot" />
      <div>
        <b>{item.title}</b>
        {changes.length > 0 && (
          <ul className="tl-changes">
            {changes.map((c, i) => (
              <li key={`${c.field}-${i}`}>
                <span>{c.label || fieldLabel(c.field)}:</span> <s>{showValue(c.from)}</s> → <b>{showValue(c.to)}</b>
              </li>
            ))}
          </ul>
        )}
        {changedOnly.length > 0 && <p>Changed: {changedOnly.map(fieldLabel).join(", ")}</p>}
        {isNoteItem(item) && item.body ? <p className="tl-body">{item.body}</p> : item.subtitle && <p>{item.subtitle}</p>}
        <time>{fmtDate(item.date)}{who ? ` · by ${who}` : ""}</time>
      </div>
    </li>
  );
}

/** Activity timeline (right column of task and booking pages). */
export function ActivityTimeline({ related }) {
  const { data, loading, error } = related;
  const items = data?.sections?.activities?.items || [];
  return (
    <section className="dl-card" aria-label="Activity timeline">
      <h3 className="dl-card-title">Timeline</h3>
      {error ? <p className="rr-empty rr-error">{error}</p>
        : loading && !data ? <p className="rr-empty">Loading timeline…</p>
          : items.length === 0 ? <p className="rr-empty">No activity yet.</p>
            : <ol className="tl">{items.map((item) => <TimelineItem key={item.id} item={item} />)}</ol>}
    </section>
  );
}

/** The list for one related section (bookings, deals, tasks, emails, whatsapp, files). */
export function RelatedSection({ tab, related }) {
  const { data, loading, error } = related;
  const current = data?.sections?.[tab] || { total: 0, items: [] };
  const label = (SECTIONS.find(([k]) => k === tab) || [tab, tab])[1].toLowerCase();
  if (error) return <p className="rr-empty rr-error">{error}</p>;
  if (loading && !data) return <p className="rr-empty">Loading…</p>;
  if (!current.items.length) return <p className="rr-empty">No {label} linked yet.</p>;
  return (
    <ul className="rr-list">
      {current.items.map((item) => {
        const href = itemHref(tab, item);
        return (
          <li key={item.id}>
            {href ? <Link to={href} className="rr-item"><ItemBody item={item} /></Link>
              : tab === "files" && item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="rr-item"><ItemBody item={item} /></a>
                : tab === "files" ? <Link to="/documents" className="rr-item"><ItemBody item={item} /></Link>
                  : <div className="rr-item rr-item-static"><ItemBody item={item} /></div>}
          </li>
        );
      })}
      {current.total > current.items.length && <li className="rr-more">Showing {current.items.length} of {current.total}</li>}
    </ul>
  );
}

export default function RelatedRecords({ type, id, showLinks = true, related: shared }) {
  const own = useRelated(shared ? null : type, shared ? null : id);
  const { data, loading, error } = shared || own;
  const [tab, setTab] = useState("bookings");

  const links = data?.links || {};
  const linkRows = [
    links.contact && ["Contact", recordHref.contact(links.contact.id), links.contact.label],
    links.company && ["Company", recordHref.company(links.company.id), links.company.label],
    links.deal && ["Deal", recordHref.deal(links.deal.id), links.deal.label],
  ].filter(Boolean);
  const sectionOf = (key) => data?.sections?.[key] || { total: 0, items: [] };
  const current = sectionOf(tab);

  return (
    <section className="rr" aria-label="Connected records">
      {showLinks && linkRows.length > 0 && (
        <div className="rr-links">
          {linkRows.map(([label, href, text]) => (
            <Link key={label} to={href} className="rr-link-chip">
              <span>{label}</span>
              <b>{text}</b>
            </Link>
          ))}
        </div>
      )}

      <div className="rr-tabs" role="tablist">
        {SECTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
            <span className="rr-count">{data ? sectionOf(key).total ?? 0 : "–"}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="rr-empty rr-error">{error}</p>
      ) : loading && !data ? (
        <p className="rr-empty">Loading connected records…</p>
      ) : current.items.length === 0 ? (
        <p className="rr-empty">No {SECTIONS.find(([k]) => k === tab)[1].toLowerCase()} linked yet.</p>
      ) : (
        <ul className="rr-list">
          {current.items.map((item) => {
            const href = itemHref(tab, item);
            return (
              <li key={item.id}>
                {href ? (
                  <Link to={href} className="rr-item">
                    <ItemBody item={item} />
                  </Link>
                ) : tab === "files" && item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="rr-item">
                    <ItemBody item={item} />
                  </a>
                ) : tab === "files" ? (
                  <Link to="/documents" className="rr-item">
                    <ItemBody item={item} />
                  </Link>
                ) : (
                  <div className="rr-item rr-item-static">
                    <ItemBody item={item} />
                  </div>
                )}
              </li>
            );
          })}
          {current.total > current.items.length && (
            <li className="rr-more">Showing {current.items.length} of {current.total}</li>
          )}
        </ul>
      )}
    </section>
  );
}
