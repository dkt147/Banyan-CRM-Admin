import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Badge from "../../components/Badge";
import { Card, DetailLayout, FieldGrid, fmtDate } from "../../components/DetailLayout";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../utils/permissions";
import { recordHref } from "../../utils/recordLinks";
import { invalidateLookups } from "../../utils/useLookups";

const ADDRESS_KEYS = ["street", "city", "country", "postalCode"];
const OPTIONAL = ["legalName", "industry", "website", "email", "phone", "notes"];

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { request } = useAuth();
  const canWrite = usePermissions().can("records.write");
  const [company, setCompany] = useState(null);
  const [contacts, setContacts] = useState({ items: [], total: 0, loading: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setCompany((await request(`/companies/${id}`)).data || null); }
    catch (e) { setError(e.status === 404 ? "This company was not found." : e.message || "Could not load the company."); }
    finally { setLoading(false); }
  }, [id, request]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    request("/contacts", { query: { companyId: id, limit: 50 } })
      .then((r) => setContacts({ items: r.data || [], total: r.pagination?.total || 0, loading: false }))
      .catch(() => setContacts({ items: [], total: 0, loading: false }));
  }, [id, request]);

  async function save(changed) {
    const body = {};
    for (const [key, value] of Object.entries(changed)) {
      if (ADDRESS_KEYS.includes(key)) continue;
      if (key === "tags") body.tags = String(value).split(",").map((t) => t.trim()).filter(Boolean);
      else body[key] = OPTIONAL.includes(key) && !String(value).trim() ? null : value;
    }
    // The address is stored as one object, so send all of it when any part changes.
    if (ADDRESS_KEYS.some((k) => k in changed))
      body.address = Object.fromEntries(ADDRESS_KEYS.map((k) => [k, (k in changed ? changed[k] : company.address?.[k]) || null]));
    const response = await request(`/companies/${id}`, { method: "PATCH", body });
    setCompany(response.data);
    invalidateLookups("companies");
  }
  async function archive() {
    if (!window.confirm(`Archive ${company.name}?`)) return;
    try { await request(`/companies/${id}/archive`, { method: "PATCH" }); await load(); }
    catch (e) { setActionError(e.message); }
  }
  async function remove() {
    if (!window.confirm(`Delete ${company.name} permanently?`)) return;
    try { await request(`/companies/${id}`, { method: "DELETE" }); invalidateLookups("companies"); navigate("/companies"); }
    catch (e) { setActionError(e.message); }
  }

  return (
    <DetailLayout
      type="company" id={id} listPath="/companies" listLabel="Companies"
      title={company?.name} subtitle={company?.industry || "Company"}
      loading={loading} error={error} onRetry={load}
      badges={company && <>{(company.tags || []).map((t) => <Badge key={t}>{t}</Badge>)}{company.isArchived && <Badge tone="warn">Archived</Badge>}</>}
      actions={canWrite && company && <>
        {!company.isArchived && <button type="button" className="btn ghost" onClick={archive}>Archive</button>}
        <button type="button" className="btn ghost" onClick={remove}>Delete</button>
      </>}
    >
      {actionError && <div className="notice error"><b>Companies</b><span>{actionError}</span></div>}
      {company && <>
        <FieldGrid
          canEdit={canWrite}
          onSave={save}
          fields={[
            { key: "name", label: "Name", value: company.name, required: true },
            { key: "legalName", label: "Legal name", value: company.legalName },
            { key: "industry", label: "Industry", value: company.industry },
            { key: "website", label: "Website", value: company.website, display: company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer">{company.website}</a> : "—" },
            { key: "email", label: "Email", type: "email", value: company.email },
            { key: "phone", label: "Phone", value: company.phone },
            { key: "street", label: "Street", value: company.address?.street },
            { key: "city", label: "City", value: company.address?.city },
            { key: "country", label: "Country", value: company.address?.country },
            { key: "postalCode", label: "Postal code", value: company.address?.postalCode },
            { key: "tags", label: "Tags (comma separated)", value: (company.tags || []).join(", ") },
            { key: "notes", label: "Notes", type: "textarea", value: company.notes, span: true },
          ]}
        />
        <Card title={`Contacts${contacts.total ? ` (${contacts.total})` : ""}`}>
          {contacts.loading ? <p className="rr-empty">Loading contacts…</p>
            : contacts.items.length === 0 ? <p className="rr-empty">No contacts linked to this company.</p>
              : (
                <ul className="rr-list">
                  {contacts.items.map((c) => (
                    <li key={c._id}>
                      <Link className="rr-item" to={recordHref.contact(c._id)}>
                        <span className="rr-item-main"><b>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</b><small>{[c.jobTitle, c.email].filter(Boolean).join(" · ")}</small></span>
                        <span className="rr-item-side">{c.bookingCount ? `${c.bookingCount} booking${c.bookingCount === 1 ? "" : "s"}` : ""}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
        </Card>
        <Card title="Record">
          <dl className="dl-fields">
            <div className="dl-field"><dt>Created</dt><dd>{fmtDate(company.createdAt)}</dd></div>
            <div className="dl-field"><dt>Updated</dt><dd>{fmtDate(company.updatedAt)}</dd></div>
          </dl>
        </Card>
      </>}
    </DetailLayout>
  );
}
