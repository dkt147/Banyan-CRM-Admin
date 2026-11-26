import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Card } from "./DetailLayout";

// "If the contact is an active member we should see what membership they use" (client, 26 Nov).
// GET /memberships?contactId=|companyId=&sort=createdAt&order=desc → current ones first.

const LIVE = ["active", "trial", "paused"];
const STATUS = { active: "Active", trial: "Trial", paused: "Paused", expired: "Ended", cancelled: "Cancelled" };
const day = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Hong_Kong" }) : "";
};
const money = (v, cur = "HKD") => `${cur === "HKD" ? "HK$" : `${cur} `}${Number(v || 0).toLocaleString("en-HK")}`;
export const planName = (m) => (m?.planId && typeof m.planId === "object" ? m.planId.name : "") || m?.metadata?.planName || "Membership";

export function useMemberships(type, id) {
  const { request } = useAuth();
  const [state, setState] = useState({ items: [], loading: true, error: "" });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    request("/memberships", { query: { [`${type}Id`]: id, sort: "createdAt", order: "desc", limit: 20 } })
      .then((r) => alive && setState({ items: r.data?.items || (Array.isArray(r.data) ? r.data : []), loading: false, error: "" }))
      .catch((e) => alive && setState({ items: [], loading: false, error: e.status === 403 ? "" : e.message || "Could not load memberships." }));
    return () => { alive = false; };
  }, [request, type, id, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}

export default function MembershipCard({ state, forCompany = false, onAdd }) {
  const { items, loading, error } = state;
  const current = items.filter((m) => LIVE.includes(m.status));
  const past = items.filter((m) => !LIVE.includes(m.status));
  if (loading) return null;
  return (
    <Card title={forCompany ? "Memberships" : "Membership"} actions={<>{onAdd && <button type="button" className="av-link" onClick={onAdd}>Add membership</button>}{onAdd && " · "}<Link className="av-link" to="/memberships">All memberships</Link></>}>
      {error && <p className="lk-warn-text">{error}</p>}
      {!current.length && <p className="lk-muted">{past.length ? `Not a member now. Last membership: ${planName(past[0])} (${STATUS[past[0].status] || past[0].status}${past[0].endAt ? `, ended ${day(past[0].endAt)}` : ""}).` : forCompany ? "No memberships for this company." : "Not a member."}</p>}
      {current.map((m) => (
        <div key={m._id} className="ms-row">
          <div className="ms-head">
            <b>{planName(m)}</b>
            <span className={`ms-status ms-${m.status}`}>{STATUS[m.status] || m.status}</span>
          </div>
          <dl className="dl-fields">
            {forCompany && m.contactId && typeof m.contactId === "object" && <div className="dl-field"><dt>Member</dt><dd>{[m.contactId.firstName, m.contactId.lastName].filter(Boolean).join(" ") || m.contactId.email}</dd></div>}
            <div className="dl-field"><dt>Since</dt><dd>{day(m.startAt) || "—"}</dd></div>
            <div className="dl-field"><dt>{m.endAt ? "Ends" : "Renews"}</dt><dd>{day(m.endAt || m.renewalAt) || "—"}</dd></div>
            <div className="dl-field"><dt>Monthly</dt><dd>{m.monthlyValue ? money(m.monthlyValue, m.currency) : "—"}</dd></div>
            <div className="dl-field"><dt>Seats</dt><dd>{m.seats || 1}</dd></div>
            {m.memberCode && <div className="dl-field"><dt>Member code</dt><dd>{m.memberCode}</dd></div>}
          </dl>
        </div>
      ))}
    </Card>
  );
}
