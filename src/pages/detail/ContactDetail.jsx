import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Badge from "../../components/Badge";
import { Card, DetailLayout, FieldGrid, fmtDate, fmtDateTime } from "../../components/DetailLayout";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../utils/permissions";
import { recordHref } from "../../utils/recordLinks";
import { invalidateLookups, useLookups } from "../../utils/useLookups";
import { SEGMENT_TAGS, tagLabel } from "../../utils/contactTags";
import { TagEditor } from "../../components/ContactTags";
import NewCompanyModal from "../../components/NewCompanyModal";
import NewDealModal from "../../components/NewDealModal";
import { DayPassCard } from "../../components/DayPassCredits";

// Kept for older imports; the single tag list lives in utils/contactTags.js.
export const CONTACT_TAGS = SEGMENT_TAGS;
export { tagLabel };
const LANGUAGES = [["en", "English"], ["zh", "Chinese"], ["es", "Spanish"]];

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { request } = useAuth();
  const canWrite = usePermissions().can("records.write");
  const { companies } = useLookups(["companies"]);
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [newCompany, setNewCompany] = useState(false);
  const [newDeal, setNewDeal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setContact((await request(`/contacts/${id}`)).data || null); }
    catch (e) { setError(e.status === 404 ? "This contact was not found." : e.message || "Could not load the contact."); }
    finally { setLoading(false); }
  }, [id, request]);
  useEffect(() => { load(); }, [load]);

  async function save(changed) {
    const body = { ...changed };
    if ("companyId" in body && !body.companyId) body.companyId = null;
    // The API accepts null (not "") to clear optional fields.
    for (const key of ["email", "phone", "whatsapp", "jobTitle", "source", "notes"])
      if (key in body && !String(body[key]).trim()) body[key] = null;
    const response = await request(`/contacts/${id}`, { method: "PATCH", body });
    setContact((prev) => ({ ...response.data, ownerId: prev?.ownerId }));
    invalidateLookups("contacts");
  }

  async function archive() {
    if (!window.confirm(`Archive ${name}?`)) return;
    try { await request(`/contacts/${id}/archive`, { method: "PATCH" }); await load(); }
    catch (e) { setActionError(e.message); }
  }
  async function remove() {
    if (!window.confirm(`Delete ${name} permanently?`)) return;
    try { await request(`/contacts/${id}`, { method: "DELETE" }); invalidateLookups("contacts"); navigate("/contact"); }
    catch (e) { setActionError(e.message); }
  }

  const name = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : "";
  const company = contact?.companyId && typeof contact.companyId === "object" ? contact.companyId : null;

  return (
    <DetailLayout
      type="contact" id={id} listPath="/contact" listLabel="Contacts"
      title={name} subtitle={[contact?.jobTitle, company?.name].filter(Boolean).join(" · ") || "Contact"}
      loading={loading} error={error} onRetry={load}
      badges={contact && <>
        {(contact.tags || []).map((t) => <Badge key={t}>{tagLabel(t)}</Badge>)}
        {contact.isArchived && <Badge tone="warn">Archived</Badge>}
      </>}
      actions={canWrite && contact && <>
        {!contact.isArchived && <button type="button" className="btn primary" onClick={() => setNewDeal(true)}>New deal</button>}
        <button type="button" className="btn ghost" onClick={() => setNewCompany(true)}>New company</button>
        {!contact.isArchived && <button type="button" className="btn ghost" onClick={archive}>Archive</button>}
        <button type="button" className="btn ghost" onClick={remove}>Delete</button>
      </>}
    >
      {actionError && <div className="notice error"><b>Contacts</b><span>{actionError}</span></div>}
      {contact && <>
        <FieldGrid
          canEdit={canWrite}
          onSave={save}
          fields={[
            { key: "firstName", label: "First name", value: contact.firstName, required: true },
            { key: "lastName", label: "Last name", value: contact.lastName },
            { key: "email", label: "Email", type: "email", value: contact.email, display: contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : "—" },
            { key: "phone", label: "Phone", value: contact.phone },
            { key: "whatsapp", label: "WhatsApp", value: contact.whatsapp },
            { key: "jobTitle", label: "Job title", value: contact.jobTitle },
            {
              key: "companyId", label: "Company", type: "select", value: company?._id || "",
              options: [["", "No company"], ...companies.map((c) => [c._id, c.name]), ...(company && !companies.some((c) => c._id === company._id) ? [[company._id, company.name]] : [])],
              display: company ? <Link to={recordHref.company(company._id)}>{company.name}</Link> : "—",
            },
            { key: "source", label: "Source / referral", value: contact.source },
            { key: "language", label: "Language", type: "select", value: contact.language || "en", options: LANGUAGES, display: (LANGUAGES.find(([v]) => v === contact.language) || [])[1] || contact.language },
            { key: "notes", label: "Notes", type: "textarea", value: contact.notes, span: true },
          ]}
        />
        <TagEditor tags={contact.tags || []} canEdit={canWrite} onChange={(tags) => save({ tags })} />
        <DayPassCard contact={contact} />
        <Card title="Record">
          <dl className="dl-fields">
            <div className="dl-field"><dt>Owner</dt><dd>{contact.ownerId?.name || "—"}</dd></div>
            <div className="dl-field"><dt>Created</dt><dd>{fmtDate(contact.createdAt)}</dd></div>
            <div className="dl-field"><dt>Marketing consent</dt><dd>{contact.marketingConsentAt ? `Yes · ${fmtDate(contact.marketingConsentAt)}${contact.consentSource ? ` (${contact.consentSource})` : ""}` : "Not recorded"}</dd></div>
            <div className="dl-field"><dt>Unsubscribed</dt><dd>{contact.unsubscribedAt ? fmtDate(contact.unsubscribedAt) : "No"}</dd></div>
            <div className="dl-field"><dt>WhatsApp opt-in</dt><dd>{contact.whatsappOptInAt ? fmtDate(contact.whatsappOptInAt) : "Not recorded"}</dd></div>
            <div className="dl-field"><dt>Last engaged</dt><dd>{fmtDateTime(contact.lastEngagedAt)}</dd></div>
          </dl>
        </Card>
      </>}
      {newDeal && <NewDealModal contact={contact} onClose={() => setNewDeal(false)} onCreated={(d) => { setNewDeal(false); navigate(recordHref.deal(d._id)); }} />}
      {newCompany && <NewCompanyModal
        onClose={() => setNewCompany(false)}
        onCreated={async (co) => { await save({ companyId: co._id }); setNewCompany(false); await load(); }} />}
    </DetailLayout>
  );
}
