import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Invoices (Xero and CRM) for a contact, company or deal (client feedback 26 Nov).
// GET /invoices?contactId=|companyId=|dealId=&sort=createdAt&order=desc&limit=20
// Invoices synced from Xero open in Xero; others open the Invoices page.

const STATUS = { draft: "Draft", awaiting: "Awaiting payment", overdue: "Overdue", paid: "Paid", cancelled: "Cancelled" };
const money = (v, cur = "HKD") => `${cur === "HKD" ? "HK$" : `${cur} `}${Number(v || 0).toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const day = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Hong_Kong" }) : "";
};
export const xeroUrl = (inv) =>
  inv?.metadata?.onlineInvoiceUrl || inv?.metadata?.xeroUrl
  || (inv?.provider === "xero" && inv?.externalId ? `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${encodeURIComponent(inv.externalId)}` : "");

export function useRecordInvoices(type, id) {
  const { request } = useAuth();
  const [state, setState] = useState({ items: [], total: null, loading: true, error: "" });
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    request("/invoices", { query: { [`${type}Id`]: id, sort: "createdAt", order: "desc", limit: 20, page: 1 } })
      .then((r) => {
        if (!alive) return;
        const items = r.data?.items || (Array.isArray(r.data) ? r.data : []);
        const total = r.pagination?.total ?? r.data?.pagination?.total ?? items.length;
        setState({ items, total, loading: false, error: "" });
      })
      .catch((e) => alive && setState({ items: [], total: 0, loading: false, error: e.status === 403 ? "You don't have access to invoices." : e.message || "Could not load invoices." }));
    return () => { alive = false; };
  }, [request, type, id]);
  return state;
}

export default function RecordInvoices({ state }) {
  const { items, total, loading, error } = state;
  if (error) return <p className="rr-empty rr-error">{error}</p>;
  if (loading) return <p className="rr-empty">Loading invoices…</p>;
  if (!items.length) return <p className="rr-empty">No invoices yet. Invoices created in Xero show here once they're synced and linked.</p>;
  const outstanding = items.filter((i) => i.status === "awaiting" || i.status === "overdue").reduce((s, i) => s + Number(i.total || 0), 0);
  return (
    <>
      {outstanding > 0 && <p className="inv-due">Outstanding: <b>{money(outstanding, items[0]?.currency)}</b></p>}
      <ul className="rr-list">
        {items.map((inv) => {
          const url = xeroUrl(inv);
          const body = (
            <>
              <span className="rr-item-main">
                <b>{inv.invoiceNumber || "Invoice"} · {money(inv.total, inv.currency)}</b>
                <small>{[inv.description, inv.provider === "xero" ? "Xero" : "CRM"].filter(Boolean).join(" · ")}</small>
              </span>
              <span className="rr-item-side">
                <span className={`rr-status inv-st-${inv.status}`}>{STATUS[inv.status] || inv.status}</span>
                <time>{inv.status === "paid" && inv.paidAt ? `Paid ${day(inv.paidAt)}` : inv.dueAt ? `Due ${day(inv.dueAt)}` : day(inv.createdAt)}</time>
              </span>
            </>
          );
          return (
            <li key={inv._id}>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="rr-item" title="Open in Xero">{body}</a>
                : <Link to="/invoices" className="rr-item">{body}</Link>}
            </li>
          );
        })}
        {total > items.length && <li className="rr-more">Showing the latest {items.length} of {total}. <Link to="/invoices">All invoices</Link></li>}
      </ul>
    </>
  );
}
