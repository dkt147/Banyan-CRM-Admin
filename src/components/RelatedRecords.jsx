import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";

// Connected records for a contact, company, deal, task or booking (GET /related/:type/:id).
// Shows the records it links to, then tabs for bookings, deals, tasks, emails, WhatsApp,
// files and activity. Every item links to its own detail page where one exists.

const SECTIONS = [
  ["bookings", "Bookings"],
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

/** Activity timeline (right column of detail pages). */
export function ActivityTimeline({ related }) {
  const { data, loading, error } = related;
  const items = data?.sections?.activities?.items || [];
  return (
    <section className="dl-card" aria-label="Activity timeline">
      <h3 className="dl-card-title">Timeline</h3>
      {error ? <p className="rr-empty rr-error">{error}</p>
        : loading && !data ? <p className="rr-empty">Loading timeline…</p>
          : items.length === 0 ? <p className="rr-empty">No activity yet.</p>
            : (
              <ol className="tl">
                {items.map((item) => (
                  <li key={item.id}>
                    <span className="tl-dot" />
                    <div>
                      <b>{item.title}</b>
                      {item.subtitle && <p>{item.subtitle}</p>}
                      <time>{fmtDate(item.date)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
    </section>
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
  const current = data?.sections?.[tab] || { total: 0, items: [] };

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
            <span className="rr-count">{data ? data.sections?.[key]?.total ?? 0 : "–"}</span>
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
