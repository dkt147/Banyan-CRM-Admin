import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { useAuth } from "../auth/AuthContext";
import { invalidateLookups, personLabel, useLookups } from "../utils/useLookups";

// "New deal" from a contact or company page (and the Deals list). POST /deals.
//   contact  – fixed contact (contact page)
//   contacts – contacts to choose from (company page: the company's people)
//   company  – company to link the deal to
export const PRODUCT_TYPES = [
  ["membership", "Coworking membership"], ["private_office", "Private office"], ["virtual_office", "Virtual office"],
  ["venue_hire", "Venue hire"], ["event_space", "Event space"], ["meeting_room", "Meeting room"], ["day_pass", "Day pass"],
  ["day_pass_package", "Day pass package"], ["podcast", "Podcast studio"], ["other", "Other"],
];
export const DEAL_SOURCES = [
  ["website", "Website"], ["walk_in", "Walk-in"], ["referral", "Referral"], ["broker", "Broker"], ["instagram", "Instagram"],
  ["facebook", "Facebook"], ["linkedin", "LinkedIn"], ["email", "Email"], ["phone", "Phone call"], ["event", "Event"], ["other", "Other"],
];

export default function NewDealModal({ contact = null, contacts = null, company = null, onClose, onCreated }) {
  const { request } = useAuth();
  const lookups = useLookups(contact || contacts ? ["pipelines"] : ["pipelines", "contacts"]);
  const pipelines = lookups.pipelines || [];
  const contactOptions = contact ? [contact] : contacts || lookups.contacts || [];
  const [v, setV] = useState({
    title: "", contactId: contact?._id || contacts?.[0]?._id || "", pipelineId: "", stageId: "",
    value: "", productType: "membership", source: "", expectedCloseDate: "",
  });
  const [stages, setStages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Default pipeline: Membership if there is one, otherwise the first.
  useEffect(() => {
    if (v.pipelineId || !pipelines.length) return;
    const p = pipelines.find((x) => x.key === "membership") || pipelines[0];
    setV((x) => ({ ...x, pipelineId: p._id }));
  }, [pipelines, v.pipelineId]);
  useEffect(() => {
    if (!v.pipelineId) return;
    let alive = true;
    request(`/pipelines/${v.pipelineId}/stages`, { query: { isActive: true, sort: "sortOrder", order: "asc" } })
      .then((r) => {
        if (!alive) return;
        const rows = r.data?.items || r.data || [];
        setStages(rows);
        setV((x) => ({ ...x, stageId: rows.some((s) => s._id === x.stageId) ? x.stageId : rows[0]?._id || "" }));
      })
      .catch((e) => alive && setError(e.message || "Could not load the stages."));
    return () => { alive = false; };
  }, [v.pipelineId, request]);
  useEffect(() => { if (!v.contactId && contactOptions[0]) setV((x) => ({ ...x, contactId: contactOptions[0]._id })); }, [contactOptions, v.contactId]);

  async function submit(e) {
    e.preventDefault();
    if (!v.title.trim()) { setError("Give the deal a title, e.g. “Private office for 4 – Jan 2027”."); return; }
    if (!v.contactId) { setError(company ? "Add a contact to this company first: every deal needs a contact." : "Choose a contact."); return; }
    if (!v.pipelineId || !v.stageId) { setError("Choose a pipeline and stage."); return; }
    const value = v.value === "" ? 0 : Number(v.value);
    if (!Number.isFinite(value) || value < 0) { setError("Value must be 0 or more."); return; }
    setBusy(true); setError("");
    try {
      const body = { title: v.title.trim(), contactId: v.contactId, pipelineId: v.pipelineId, stageId: v.stageId, value, productType: v.productType };
      const picked = contactOptions.find((c) => c._id === v.contactId);
      const companyId = company?._id || (picked?.companyId && typeof picked.companyId === "object" ? picked.companyId._id : picked?.companyId);
      if (companyId) body.companyId = companyId;
      if (v.source) body.source = v.source;
      if (v.expectedCloseDate) body.expectedCloseDate = new Date(`${v.expectedCloseDate}T12:00:00+08:00`).toISOString();
      const r = await request("/deals", { method: "POST", body });
      invalidateLookups("deals");
      onCreated(r.data);
    } catch (err) { setError(err.message || "The deal could not be created."); setBusy(false); }
  }

  return (
    <Modal title="New deal" onClose={onClose} actions={<>
      <button type="submit" form="new-deal-form" className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create deal"}</button>
      <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
    </>}>
      <form id="new-deal-form" className="form-grid" onSubmit={submit}>
        <label className="form-span-2">Title<input autoFocus value={v.title} maxLength={200} disabled={busy} placeholder="e.g. Private office for 4 – Jan 2027" onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <label>Contact
          {contact ? <input value={personLabel(contact)} disabled readOnly />
            : <select value={v.contactId} disabled={busy} onChange={(e) => setV({ ...v, contactId: e.target.value })}>
              {!contactOptions.length && <option value="">No contacts</option>}
              {contactOptions.map((c) => <option key={c._id} value={c._id}>{personLabel(c)}</option>)}
            </select>}
        </label>
        <label>Company<input value={company?.name || (contact?.companyId && typeof contact.companyId === "object" ? contact.companyId.name : "") || "From the contact"} disabled readOnly /></label>
        <label>Pipeline
          <select value={v.pipelineId} disabled={busy} onChange={(e) => setV({ ...v, pipelineId: e.target.value, stageId: "" })}>
            {pipelines.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </label>
        <label>Stage
          <select value={v.stageId} disabled={busy} onChange={(e) => setV({ ...v, stageId: e.target.value })}>
            {stages.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </label>
        <label>Value (HK$)<input type="number" min={0} step={100} value={v.value} disabled={busy} placeholder="0" onChange={(e) => setV({ ...v, value: e.target.value })} /></label>
        <label>Product
          <select value={v.productType} disabled={busy} onChange={(e) => setV({ ...v, productType: e.target.value })}>
            {PRODUCT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>Lead source
          <select value={v.source} disabled={busy} onChange={(e) => setV({ ...v, source: e.target.value })}>
            <option value="">{contact?.source ? `Same as contact (${contact.source})` : "Not set"}</option>
            {DEAL_SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>Expected close<input type="date" value={v.expectedCloseDate} disabled={busy} onChange={(e) => setV({ ...v, expectedCloseDate: e.target.value })} /></label>
        {error && <p className="lk-warn-text form-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
