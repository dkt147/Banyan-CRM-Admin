import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";
import { formatBirthday, turningAge } from "../utils/birthday";

// Dashboard: "birthdays of the day" (client feedback 26 Nov), plus the next 7 days so the
// team can prepare. GET /contacts/birthdays?days=7 →
//   { date: "YYYY-MM-DD", today: [contact], upcoming: [{ ...contact, nextBirthday: "YYYY-MM-DD", inDays }] }
// HK dates. Archived contacts are left out by the server.

const name = (c) => [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Contact";
const weekday = (iso) => {
  const d = new Date(`${iso}T12:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Hong_Kong" });
};

function Person({ c, when }) {
  const age = turningAge(c.birthday);
  const company = c.companyId && typeof c.companyId === "object" ? c.companyId.name : "";
  return (
    <li>
      <Link to={recordHref.contact(c._id)} className="rr-item">
        <span className="rr-item-main">
          <b>{name(c)}</b>
          <small>{[company, c.email].filter(Boolean).join(" · ")}</small>
        </span>
        <span className="rr-item-side">
          <span>{when}</span>
          {age ? <small>turns {age}</small> : null}
        </span>
      </Link>
    </li>
  );
}

export default function BirthdaysPanel() {
  const { request } = useAuth();
  const [state, setState] = useState({ data: null, loading: true, error: "", missing: false });

  useEffect(() => {
    let alive = true;
    request("/contacts/birthdays", { query: { days: 7 } })
      .then((r) => alive && setState({ data: r.data || {}, loading: false, error: "", missing: false }))
      .catch((e) => alive && setState({ data: null, loading: false, error: e.status === 404 ? "" : e.message || "Could not load birthdays.", missing: e.status === 404 }));
    return () => { alive = false; };
  }, [request]);

  const today = state.data?.today || [];
  const upcoming = (state.data?.upcoming || []).filter((c) => c.inDays > 0);

  return (
    <section className="panel dashboard-panel bd-panel" aria-label="Birthdays">
      <div className="dashboard-panel-head">
        <h2>Birthdays today</h2>
        <span>{today.length ? `${today.length} today` : ""}{upcoming.length ? `${today.length ? " · " : ""}${upcoming.length} this week` : ""}</span>
      </div>
      {state.loading ? <p className="rr-empty">Loading…</p>
        : state.missing ? <p className="rr-empty">Birthdays need the latest server update.</p>
          : state.error ? <p className="rr-empty rr-error">{state.error}</p>
            : (
              <>
                {today.length ? <ul className="rr-list">{today.map((c) => <Person key={c._id} c={c} when={formatBirthday(c.birthday).replace(/ \d{4}$/, "")} />)}</ul>
                  : <p className="rr-empty">No birthdays today.</p>}
                {upcoming.length > 0 && (
                  <>
                    <h3 className="bd-sub">Next 7 days</h3>
                    <ul className="rr-list">{upcoming.map((c) => <Person key={c._id} c={c} when={weekday(c.nextBirthday)} />)}</ul>
                  </>
                )}
                <p className="lk-muted bd-hint">Add birthdays on the contact page (Details → Edit → Birthday).</p>
              </>
            )}
    </section>
  );
}
