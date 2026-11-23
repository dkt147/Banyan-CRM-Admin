import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Page } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { Link } from "react-router-dom";
import { DataState, FilterChips, Pager } from "../components/ListKit";
import { recordHref } from "../utils/recordLinks";
import { TagOptions } from "../components/ContactTags";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { useLookups } from "../utils/useLookups";
import { tagLabel } from "../utils/contactTags";
import { API_BASE_URL } from "../api";
import { BANYAN_DESIGN, BrandedPreview, DesignFields, withDesign } from "../forms/formDesign";

// Intake forms (GET/POST/PATCH/DELETE /forms). A form is a list of fields, each mapped to a
// CRM contact field, plus what happens on submit: tags, an optional deal, a follow-up task
// and staff notifications. "Start from the website enquiry form" copies the form on
// banyanworkspace.com/contact-us (same services and fields).

const TYPES = [["enquiry", "Website enquiry"], ["contact", "Contact details"], ["walk_in", "Walk-in"], ["newsletter", "Newsletter sign-up"]];
const FIELD_TYPES = [["text", "Short text"], ["email", "Email"], ["tel", "Phone"], ["textarea", "Long text"], ["checkboxes", "Checkboxes"], ["select", "Dropdown"]];
const MAP_TO = [["", "Not saved to a contact field (kept with the submission)"], ["firstName", "First name"], ["lastName", "Last name"], ["email", "Email"], ["phone", "Phone"], ["company", "Company name"], ["interests", "Interested in (services)"], ["source", "Lead source (how they found us)"], ["newsletterOptIn", "Newsletter opt-in (Yes adds them to Flodesk)"], ["notes", "Notes"]];
// Flodesk segments the team uses (Audience → Segments). The backend maps each interest to its segment.
export const NEWSLETTER_INTERESTS = ["Coworking", "Serviced Office", "Virtual Office", "Event Space / Venue Hire", "Podcast Services"];
const LEAD_SOURCES = ["Website", "Search Engine", "Paid Search", "Email", "Newsletter", "Phone Call", "WhatsApp", "Referral", "Instagram", "Facebook", "LinkedIn", "Social Media", "Organic Social", "Paid Social", "Partner", "Broker", "Walk-in", "Event", "Networking", "GOP Workshop", "Other"];
const NO_FLODESK = { enabled: false };
const SERVICES = ["Virtual Office", "Flexible Day Pass", "Coworking Desks", "Serviced Offices", "Meeting Rooms", "Event Venue", "Photoshoot Space", "Podcast Studio"];

const field = (label, type, mapTo, required = false, options = []) => ({ key: mapTo || slugify(label).replace(/-/g, "_"), label, type, mapTo, required, options });
export const WEBSITE_ENQUIRY_PRESET = {
  name: "Website enquiry",
  slug: "website-enquiry",
  type: "enquiry",
  description: "Copy of the enquiry form on banyanworkspace.com/contact-us.",
  fields: [
    field("Interested in", "checkboxes", "interests", true, SERVICES),
    field("First name", "text", "firstName", true),
    field("Last name", "text", "lastName", true),
    field("Email address", "email", "email", true),
    field("Phone number", "tel", "phone"),
    field("Additional notes", "textarea", "notes"),
  ],
  consentText: "I agree to Banyan Workspace contacting me about my enquiry.",
  tagsToApply: ["website_enquiry"],
  pipelineId: "", stageId: "",
  createTask: true,
  notifyEmails: [],
  allowedOrigins: ["https://banyanworkspace.com", "https://www.banyanworkspace.com"],
  isActive: true,
  design: { ...BANYAN_DESIGN, title: "Get in touch", intro: "Tell us what you're looking for and our team will get back to you.", buttonText: "Send enquiry" },
  flodesk: NO_FLODESK,
};
const BLANK = { ...WEBSITE_ENQUIRY_PRESET, name: "", slug: "", description: "", fields: [field("First name", "text", "firstName", true), field("Email address", "email", "email", true)], tagsToApply: [], createTask: false, allowedOrigins: [], design: { ...BANYAN_DESIGN }, flodesk: NO_FLODESK };
// The walk-in form staff hand visitors on the iPad (copy of the HubSpot form in use today).
const WALK_IN_PRESET = {
  ...BLANK, name: "Walk-in visitor", slug: "walk-in", type: "walk_in",
  description: "Visitors fill this in on the iPad at reception.",
  fields: [
    field("First name", "text", "firstName", true),
    field("Last name", "text", "lastName", true),
    field("Email", "email", "email", true),
    field("Phone number", "tel", "phone"),
    field("Products / services", "checkboxes", "interests", false, ["Flexible Day Pass", "Coworking Desks", "Podcast Studio", "Meeting Rooms", "Virtual Office", "Serviced Offices"]),
    field("How did you hear about us?", "select", "source", false, LEAD_SOURCES),
    field("I'd like to sign up to the newsletter", "select", "newsletterOptIn", false, ["Yes", "No"]),
  ],
  consentText: "",
  tagsToApply: ["walk_in"],
  design: { ...BANYAN_DESIGN, title: "Welcome to Banyan Workspace", intro: "Thank you for joining us today. We hope your visit is productive. Kindly share your details with us for our records, and so we can stay in touch with you!" },
  flodesk: { enabled: true },
};
// Newsletter sign-up (website, Instagram link): contact in the CRM + subscriber in Flodesk.
const NEWSLETTER_PRESET = {
  ...BLANK, name: "Newsletter sign-up", slug: "newsletter", type: "newsletter",
  description: "Joins the Banyan newsletter (CRM contact + Flodesk subscriber).",
  fields: [
    field("First name", "text", "firstName", true),
    field("Email", "email", "email", true),
    field("What are you interested in?", "select", "interests", false, NEWSLETTER_INTERESTS),
  ],
  consentText: "Yes, I'd like to receive emails from Banyan Workspace. I can unsubscribe at any time.",
  tagsToApply: ["newsletter"],
  allowedOrigins: ["https://banyanworkspace.com", "https://www.banyanworkspace.com"],
  design: { ...BANYAN_DESIGN, title: "Join the Banyan community", intro: "News, events and member offers from Banyan Workspace, straight to your inbox.", buttonText: "Sign up" },
  flodesk: { enabled: true },
};
const TEMPLATES = [
  ["blank", "Blank form", "Start from a name and an email field.", BLANK],
  ["enquiry", "Website enquiry", "Copy of the enquiry form on banyanworkspace.com.", WEBSITE_ENQUIRY_PRESET],
  ["walk_in", "Walk-in visitor", "For the iPad at reception: details, interests, how they found us.", WALK_IN_PRESET],
  ["newsletter", "Newsletter sign-up", "Name, email, interest and consent. Adds them to Flodesk.", NEWSLETTER_PRESET],
];

function slugify(s) { return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
const lines = (s) => String(s || "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";

export default function Forms() {
  const { request } = useAuth();
  const canManage = usePermissions().can("forms.manage");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);   // { id?, values }
  const [embed, setEmbed] = useState(null);
  const [subs, setSubs] = useState(null);
  const [choosing, setChoosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows((await request("/forms", { query: { limit: 100 } })).data?.items || []); }
    catch (e) { setError(e.message || "Could not load forms."); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { load(); }, [load]);

  const open = (values, id) => setEditing({ id, values: JSON.parse(JSON.stringify(values)) });
  const fromRow = (f) => ({ ...BLANK, ...f, pipelineId: idOf(f.pipelineId), stageId: idOf(f.stageId), fields: f.fields || [], design: withDesign(f.design), flodesk: { ...NO_FLODESK, ...(f.flodesk || {}) } });

  async function remove(f) {
    if (!window.confirm(`Delete the form "${f.name}"? Websites using it will stop sending submissions.`)) return;
    try {
      const r = await request(`/forms/${f._id}`, { method: "DELETE" });
      setNotice(r?.data?.deactivated ? `"${f.name}" has submissions, so it was deactivated instead of deleted (the submissions are kept).` : "Form deleted.");
      load();
    }
    catch (e) { setError(notBuilt(e) || e.message); }
  }

  return (
    <Page title="Forms" kicker="Website, walk-in and newsletter intake"
      actions={canManage && <>
        <button type="button" className="btn primary" onClick={() => setChoosing(true)}>New form</button>
      </>}>
      <section className="panel fm-howto">
        <h3>How forms work</h3>
        <ol>
          <li><b>Create the form.</b> Start from a copy of the website enquiry form, or a blank form. Add the fields you need and choose which contact field each one fills.</li>
          <li><b>Decide what happens on submit.</b> Tags to add, an optional deal in a pipeline stage, a follow-up task, and who gets an email.</li>
          <li><b>Style it.</b> Title, introduction, button and colours. It starts in the Banyan style; the preview shows how it will look.</li>
          <li><b>Put it online.</b> Under "Share", create its own page on banyanworkspace.com (a link for the iPad, an event or Instagram), or copy the code. Submissions create or update the contact (matched by email, then phone) and appear on their timeline.</li>
        </ol>
      </section>
      {notice && <div className="notice"><b>Forms</b><span>{notice}</span></div>}
      <section className="panel lk-table-wrap">
        <DataState loading={loading} error={error} onRetry={load} empty={rows.length === 0}
          emptyText="No forms yet. Click “New form” to start from a template.">
          <table className="lk-table">
            <thead><tr><th>Form</th><th>Type</th><th>Fields</th><th>Tags applied</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f._id}>
                  <td><b>{f.name}</b><small><code>{f.slug}</code>{f.description ? ` · ${f.description}` : ""}</small>{f.page?.url && <small><a href={f.page.url} target="_blank" rel="noreferrer">{f.page.url.replace(/^https?:\/\//, "")}</a></small>}</td>
                  <td>{(TYPES.find(([v]) => v === f.type) || [])[1] || f.type}</td>
                  <td>{(f.fields || []).length}</td>
                  <td>{(f.tagsToApply || []).map(tagLabel).join(", ") || "—"}</td>
                  <td><Badge tone={f.isActive ? "good" : ""}>{f.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td className="fm-actions">
                    <button type="button" className="btn ghost small" onClick={() => setSubs(f)}>Submissions</button>
                    <button type="button" className="btn ghost small" onClick={() => setEmbed(f)}>Share</button>
                    {canManage && <>
                      <button type="button" className="btn ghost small" onClick={() => open(fromRow(f), f._id)}>Edit</button>
                      <button type="button" className="btn ghost small" onClick={() => open({ ...fromRow(f), name: `${f.name} copy`, slug: `${f.slug}-copy` })}>Duplicate</button>
                      <button type="button" className="btn ghost small" onClick={() => remove(f)}>Delete</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </section>
      {editing && <FormEditor editing={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); setNotice(msg); load(); }} />}
      {embed && <EmbedModal form={embed} canManage={canManage} onClose={() => setEmbed(null)} onRotated={(f) => { setEmbed(f); load(); }} />}
      {subs && <SubmissionsModal form={subs} onClose={() => setSubs(null)} />}
      {choosing && (
        <Modal className="fm-choose" title="New form" onClose={() => setChoosing(false)}>
          <div className="fm-templates">
            {TEMPLATES.map(([key, label, help, preset]) => (
              <button key={key} type="button" className="fm-template" onClick={() => { setChoosing(false); open(preset); }}>
                <b>{label}</b><span>{help}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </Page>
  );
}

const notBuilt = (e) => ([404, 405].includes(e.status) ? "Saving forms needs the backend update (create/edit/delete for /forms). It's listed in the backend handoff." : "");

function FormEditor({ editing, onClose, onSaved }) {
  const { request } = useAuth();
  const { pipelines } = useLookups(["pipelines"]);
  const [v, setV] = useState(editing.values);
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(editing.id));
  const set = (patch) => setV((x) => ({ ...x, ...patch }));
  const setField = (i, patch) => set({ fields: v.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const moveField = (i, d) => { const f = [...v.fields]; const [x] = f.splice(i, 1); f.splice(i + d, 0, x); set({ fields: f }); };

  useEffect(() => {
    if (!v.pipelineId) { setStages([]); return; }
    request(`/pipelines/${v.pipelineId}/stages`, { query: { isActive: true, sort: "sortOrder", order: "asc" } })
      .then((r) => setStages(r.data?.items || r.data || [])).catch(() => setStages([]));
  }, [v.pipelineId, request]);

  async function save() {
    if (!v.name.trim()) { setError("Give the form a name."); return; }
    if (!v.slug.trim()) { setError("Give the form a slug (used in its web address)."); return; }
    if (!v.fields.length) { setError("Add at least one field."); return; }
    if (!v.fields.some((f) => f.mapTo === "email" || f.mapTo === "phone")) { setError("Add an Email or Phone field so the submission can be matched to a contact."); return; }
    const bad = v.fields.find((f) => !f.label.trim() || (["checkboxes", "select"].includes(f.type) && !f.options.length));
    if (bad) { setError(bad.label.trim() ? `"${bad.label}" needs at least one option.` : "Every field needs a label."); return; }
    const keys = v.fields.map((f) => f.key);
    if (new Set(keys).size !== keys.length) { setError("Two fields have the same key. Rename one of them."); return; }
    setSaving(true); setError("");
    const body = {
      name: v.name.trim(), slug: slugify(v.slug), type: v.type, description: v.description || "",
      fields: v.fields.map((f) => ({ key: f.key, label: f.label.trim(), type: f.type, mapTo: f.mapTo || null, required: Boolean(f.required), options: f.options || [] })),
      consentText: v.consentText || "", tagsToApply: v.tagsToApply || [],
      pipelineId: v.pipelineId || null, stageId: v.pipelineId ? v.stageId || null : null,
      createTask: Boolean(v.createTask), notifyEmails: v.notifyEmails || [], allowedOrigins: v.allowedOrigins || [], isActive: Boolean(v.isActive),
      design: withDesign(v.design),
      flodesk: { enabled: Boolean(v.flodesk?.enabled) },
    };
    try {
      await request(editing.id ? `/forms/${editing.id}` : "/forms", { method: editing.id ? "PATCH" : "POST", body });
      onSaved(editing.id ? "Form saved." : "Form created. Use “Share” to put it on the website.");
    } catch (e) { setError(notBuilt(e) || e.message || "Could not save the form."); setSaving(false); }
  }

  return (
    <Modal className="fm-modal" title={editing.id ? `Edit form · ${editing.values.name}` : "New form"} onClose={() => !saving && onClose()} actions={<>
      <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
      <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save form"}</button>
    </>}>
      {error && <div className="notice error"><b>Form</b><span>{error}</span></div>}
      <div className="fm-editor">
        <div className="fm-left">
          <h4>Settings</h4>
          <div className="form-grid">
            <label>Name<span className="required-mark"> *</span><input value={v.name} onChange={(e) => set({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })} /></label>
            <label>Slug<span className="required-mark"> *</span><input value={v.slug} onChange={(e) => { setSlugTouched(true); set({ slug: e.target.value }); }} /></label>
            <label>Type<select value={v.type} onChange={(e) => set({ type: e.target.value })}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label>Status<select value={v.isActive ? "1" : "0"} onChange={(e) => set({ isActive: e.target.value === "1" })}><option value="1">Active</option><option value="0">Inactive</option></select></label>
            <label className="form-span-2">Description<input value={v.description || ""} onChange={(e) => set({ description: e.target.value })} /></label>
          </div>

          <h4>Fields</h4>
          <ol className="fm-fields">
            {v.fields.map((f, i) => (
              <li key={i}>
                <div className="fm-field-row">
                  <input aria-label="Label" value={f.label} placeholder="Label" onChange={(e) => setField(i, { label: e.target.value, ...(f.mapTo ? {} : { key: slugify(e.target.value).replace(/-/g, "_") }) })} />
                  <select aria-label="Field type" value={f.type} onChange={(e) => setField(i, { type: e.target.value })}>{FIELD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <label className="fm-inline"><input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Required</label>
                  <span className="fm-field-tools">
                    <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => moveField(i, -1)}>↑</button>
                    <button type="button" className="icon-btn" aria-label="Move down" disabled={i === v.fields.length - 1} onClick={() => moveField(i, 1)}>↓</button>
                    <button type="button" className="icon-btn" aria-label="Remove field" onClick={() => set({ fields: v.fields.filter((_, j) => j !== i) })}>×</button>
                  </span>
                </div>
                <div className="fm-field-row">
                  <label className="fm-inline">Saves to
                    <select value={f.mapTo || ""} onChange={(e) => setField(i, { mapTo: e.target.value, key: e.target.value || slugify(f.label).replace(/-/g, "_") })}>{MAP_TO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  </label>
                  {["checkboxes", "select"].includes(f.type) && (
                    <label className="fm-inline fm-grow">Options (one per line)
                      <textarea rows={3} value={(f.options || []).join("\n")} onChange={(e) => setField(i, { options: lines(e.target.value) })} />
                    </label>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="btn ghost" onClick={() => set({ fields: [...v.fields, field(`Field ${v.fields.length + 1}`, "text", "")] })}>Add field</button>

          <h4>Design</h4>
          <DesignFields design={v.design} onChange={(design) => set({ design })} />

          <h4>When someone submits</h4>
          <div className="form-grid">
            <label className="form-span-2">Tags to add
              <span className="fm-chips">
                {(v.tagsToApply || []).map((t) => <span key={t} className="tag-chip">{tagLabel(t)}<button type="button" aria-label={`Remove ${tagLabel(t)}`} onClick={() => set({ tagsToApply: v.tagsToApply.filter((x) => x !== t) })}>×</button></span>)}
                <select value="" onChange={(e) => e.target.value && set({ tagsToApply: [...new Set([...(v.tagsToApply || []), e.target.value])] })}><option value="">Add tag…</option><TagOptions exclude={v.tagsToApply || []} /></select>
              </span>
            </label>
            <label>Create a deal in<select value={v.pipelineId || ""} onChange={(e) => set({ pipelineId: e.target.value, stageId: "" })}><option value="">No deal (enquiry form picks the pipeline from the service)</option>{pipelines.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
            <label>Stage<select value={v.stageId || ""} disabled={!v.pipelineId} onChange={(e) => set({ stageId: e.target.value })}><option value="">First stage</option>{stages.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
            <label className="fm-inline form-span-2"><input type="checkbox" checked={Boolean(v.createTask)} onChange={(e) => set({ createTask: e.target.checked })} /> Create a follow-up task for the deal owner</label>
            <label>Email these people<textarea rows={2} placeholder="one email per line" value={(v.notifyEmails || []).join("\n")} onChange={(e) => set({ notifyEmails: lines(e.target.value) })} /></label>
            <label>Websites allowed to send it<textarea rows={2} placeholder="https://banyanworkspace.com" value={(v.allowedOrigins || []).join("\n")} onChange={(e) => set({ allowedOrigins: lines(e.target.value) })} /></label>
            <label className="form-span-2">Consent text (shown above the submit button)<textarea rows={2} value={v.consentText || ""} onChange={(e) => set({ consentText: e.target.value })} /></label>
            <label className="fm-inline form-span-2"><input type="checkbox" checked={Boolean(v.flodesk?.enabled)} onChange={(e) => set({ flodesk: { ...(v.flodesk || {}), enabled: e.target.checked } })} /> Add to the Flodesk newsletter</label>
            {v.flodesk?.enabled && <p className="lk-muted form-span-2">
              The person is added to Flodesk in the segment for their interest ({NEWSLETTER_INTERESTS.join(", ")}; anything else goes to "No Product").
              {v.fields.some((f) => f.mapTo === "newsletterOptIn") ? " Only when they answer Yes to the newsletter question." : v.consentText ? " Only when they tick the consent box." : " Add consent text or a newsletter opt-in question so people agree to emails."}
            </p>}
          </div>
        </div>
        <aside className="fm-right" aria-label="Preview">
          <h4>Preview</h4>
          <BrandedPreview form={v} />
        </aside>
      </div>
    </Modal>
  );
}

const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HONEYPOT = `<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">`;

function EmbedModal({ form, canManage, onClose, onRotated }) {
  const { request } = useAuth();
  const endpoint = `${API_BASE_URL}/public/forms/${form.slug}`;
  const snippet = useMemo(() => {
    const inputs = (form.fields || []).map((f) => {
      const req = f.required ? " required" : "";
      const label = esc(f.label), name = esc(f.key);
      if (f.type === "textarea") return `  <label>${label}<textarea name="${name}"${req}></textarea></label>`;
      if (f.type === "checkboxes") return `  <fieldset><legend>${label}</legend>\n${(f.options || []).map((o) => `    <label><input type="checkbox" name="${name}[]" value="${esc(o)}"> ${esc(o)}</label>`).join("\n")}\n  </fieldset>`;
      if (f.type === "select") return `  <label>${label}<select name="${name}"${req}>${(f.options || []).map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`;
      return `  <label>${label}<input type="${f.type}" name="${name}"${req}></label>`;
    }).join("\n");
    return [
      `<form action="${endpoint}" method="POST">`,
      `  <input type="hidden" name="publicKey" value="${esc(form.publicKey || "<form public key>")}">`,
      `  <!-- Brings the visitor back to this page after sending -->`,
      `  <input type="hidden" name="_return_url" value="">`,
      `  <script>document.currentScript.previousElementSibling.value = location.href;</script>`,
      `  <!-- Spam trap: keep this hidden and empty -->`,
      `  ${HONEYPOT}`,
      inputs,
      form.consentText ? `  <label><input type="checkbox" name="consent" value="yes" required> ${esc(form.consentText)}</label>` : null,
      `  <button type="submit">${esc(withDesign(form.design).buttonText || "Send")}</button>`,
      `</form>`,
    ].filter((x) => x !== null).join("\n");
  }, [form, endpoint]);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState("");

  // Its own page on banyanworkspace.com: the CRM asks WordPress to create (or update) a page
  // that shows this form in the Banyan design. POST/DELETE /forms/:id/page.
  const [pagePath, setPagePath] = useState(form.page?.path || `forms/${form.slug}`);
  const [pageBusy, setPageBusy] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  async function publishPage() {
    setPageBusy("publish"); setError("");
    try {
      const r = await request(`/forms/${form._id}/page`, { method: "POST", body: { path: pagePath.replace(/^\/+|\/+$/g, "") } });
      onRotated?.({ ...form, page: r.data?.page || r.data });
    } catch (e) { setError([404, 405].includes(e.status) && !e.payload?.code ? "Creating website pages needs the backend and WordPress update. It's in the handoff." : e.message); }
    finally { setPageBusy(""); }
  }
  async function removePage() {
    if (!window.confirm("Take this page off banyanworkspace.com? Anyone with the link will no longer see the form.")) return;
    setPageBusy("remove"); setError("");
    try { await request(`/forms/${form._id}/page`, { method: "DELETE" }); onRotated?.({ ...form, page: null }); }
    catch (e) { setError(e.message); }
    finally { setPageBusy(""); }
  }

  async function rotate() {
    if (!window.confirm("Regenerate this form's key?\n\nEvery website that already has this form embedded stops working until its code is replaced with the new snippet.")) return;
    setRotating(true); setError("");
    try { const r = await request(`/forms/${form._id}/rotate-key`, { method: "POST", body: {} }); setCopied(false); onRotated?.(r.data || form); }
    catch (e) { setError(e.message); }
    finally { setRotating(false); }
  }

  return (
    <Modal className="fm-modal" title={`Share · ${form.name}`} onClose={onClose} actions={<>
      {canManage && <button type="button" className="btn ghost" onClick={rotate} disabled={rotating}>{rotating ? "Regenerating…" : "Regenerate key"}</button>}
      <button type="button" className="btn primary" onClick={onClose}>Done</button>
    </>}>
      {error && <div className="notice error"><b>Form</b><span>{error}</span></div>}
      {!form.isActive && <div className="notice"><b>Inactive</b><span>This form is switched off, so submissions are refused until it's made active again.</span></div>}

      <h4>Its own page on banyanworkspace.com</h4>
      <p className="lk-muted">For the iPad at reception, an event sign-up or the Instagram link: a page with the website's header and footer and this form in the Banyan design.</p>
      {form.page?.url ? (
        <div className="fm-page-live">
          <a href={form.page.url} target="_blank" rel="noreferrer" className="fm-page-url">{form.page.url}</a>
          <div className="fm-page-actions">
            <button type="button" className="btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(form.page.url); setLinkCopied(true); } catch { /* ignore */ } }}>{linkCopied ? "Link copied" : "Copy link"}</button>
            <a className="btn ghost" href={form.page.url} target="_blank" rel="noreferrer">Open page</a>
            {canManage && <button type="button" className="btn ghost" onClick={publishPage} disabled={Boolean(pageBusy)}>{pageBusy === "publish" ? "Updating…" : "Update page"}</button>}
            {canManage && <button type="button" className="btn ghost" onClick={removePage} disabled={Boolean(pageBusy)}>{pageBusy === "remove" ? "Removing…" : "Remove page"}</button>}
          </div>
          {form.page.error && <p className="lk-warn-text">{form.page.error}</p>}
          <p className="lk-muted">"Update page" applies changes to the title, introduction or design. Field changes show on the page straight away.</p>
        </div>
      ) : canManage ? (
        <div className="fm-page-new">
          <label>Page address
            <span className="fm-page-path"><span>banyanworkspace.com/</span><input value={pagePath} onChange={(e) => setPagePath(e.target.value.toLowerCase().replace(/[^a-z0-9/-]+/g, "-"))} /></span>
          </label>
          <button type="button" className="btn primary" onClick={publishPage} disabled={Boolean(pageBusy) || !form.isActive}>{pageBusy === "publish" ? "Creating page…" : "Create page"}</button>
        </div>
      ) : <p className="lk-muted">No page yet. An admin can create one.</p>}

      <h4>On an existing banyanworkspace.com page</h4>
      <p>Put the shortcode <code>[banyan_crm_form slug="{form.slug}"]</code> on the page in WordPress. It shows this form in the same design.</p>

      <details className="fm-embed-details">
        <summary>Embed code for other websites</summary>
        <p>Paste this into the page (or send it to the web developer). Submissions go to <code>{endpoint}</code> and are only accepted from the websites listed on the form (banyanworkspace.com when the list is empty).</p>
        <button type="button" className="btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied(true); } catch { /* ignore */ } }}>{copied ? "Copied" : "Copy code"}</button>
        <pre className="fm-snippet">{snippet}</pre>
      <h4>After someone presses Send</h4>
      <ul className="fm-embed-notes">
        <li>The visitor comes back to the same page with <code>?submitted=1</code> in the address. Show a thank-you message when it's there. The hidden <code>_return_url</code> field and its one-line script make this work; without them the visitor may land on the site's home page.</li>
        <li>If something was missing or wrong, they come back with <code>?form_error=…</code> holding the message. Show it near the form.</li>
        <li>The hidden <code>website</code> field catches spam bots. Keep it in the code and don't make it visible.</li>
        <li>Every submission, including failed and spam ones, is listed under <b>Submissions</b>.</li>
        {canManage && <li><b>Regenerate key</b> only if the key has leaked: existing embeds stop working until they get the new code.</li>}
      </ul>
      </details>
      <p className="lk-muted">The existing enquiry pop-up on banyanworkspace.com already posts to the CRM and stays as it is.</p>
    </Modal>
  );
}

const SUB_STATUSES = [["", "All"], ["processed", "Processed"], ["failed", "Failed"], ["spam", "Spam"]];
const SUB_TONE = { processed: "good", failed: "warn" };
const FLODESK_TONE = { added: "good", failed: "warn" };
const FLODESK_LABEL = { pending: "Sending…", added: "Added", skipped: "Not added", failed: "Failed" };
const fmtWhen = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" }) : "—");
const showValue = (v) => (Array.isArray(v) ? v.join(", ") : v && typeof v === "object" ? JSON.stringify(v) : String(v ?? ""));

function SubmissionsModal({ form, onClose }) {
  const { request } = useAuth();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ items: [], total: 0, pages: 1, loading: true, error: "" });
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await request(`/forms/${form._id}/submissions`, { query: { status, page, limit: 25 } });
      setState({ items: r.data?.items || [], total: r.data?.pagination?.total || 0, pages: r.data?.pagination?.pages || 1, loading: false, error: "" });
    } catch (e) { setState((s) => ({ ...s, loading: false, error: e.message })); }
  }, [request, form._id, status, page]);
  useEffect(() => { load(); }, [load]);

  const labelOf = (key) => (form.fields || []).find((f) => f.key === key)?.label || key;
  return (
    <Modal className="fm-modal" title={`Submissions · ${form.name}`} onClose={onClose} actions={<button type="button" className="btn primary" onClick={onClose}>Close</button>}>
      <FilterChips label="Status" chips={SUB_STATUSES.map(([key, label]) => ({ key, label, active: status === key }))} onToggle={(k) => { setStatus(k); setPage(1); }} />
      <DataState loading={state.loading} error={state.error} onRetry={load} empty={state.items.length === 0} emptyText="No submissions yet.">
        <table className="lk-table fm-subs">
          <thead><tr><th>Received (HK)</th><th>Contact</th><th>Status</th><th>Deal</th>{form.flodesk?.enabled && <th>Flodesk</th>}<th aria-label="Details" /></tr></thead>
          <tbody>
            {state.items.map((sub) => {
              const c = sub.contactId && typeof sub.contactId === "object" ? sub.contactId : null;
              // dealIds (all deals, e.g. a walk-in for two services) from the 24 Nov backend; dealId is the first.
              const deals = (Array.isArray(sub.dealIds) && sub.dealIds.length ? sub.dealIds : [sub.dealId]).filter((x) => x && typeof x === "object");
              const p = sub.payload || {};
              const who = c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email
                : [p.firstName || p.first_name, p.lastName || p.last_name].filter(Boolean).join(" ") || p.email || "—";
              const open = openId === sub._id;
              return (
                <React.Fragment key={sub._id}>
                  <tr>
                    <td className="rb-nowrap">{fmtWhen(sub.createdAt)}</td>
                    <td>{c ? <Link to={recordHref.contact(c._id)}>{who}</Link> : who}{c?.email && <small>{c.email}</small>}</td>
                    <td><Badge tone={SUB_TONE[sub.status] || ""}>{sub.status}</Badge>{sub.error && <small className="lk-warn-text">{sub.error}</small>}</td>
                    <td>{deals.length ? deals.map((d, i) => <React.Fragment key={d._id}>{i > 0 && <br />}<Link to={recordHref.deal(d._id)}>{d.title || "Deal"}</Link></React.Fragment>) : "—"}</td>
                    {form.flodesk?.enabled && <td>{sub.flodesk ? <>
                      <Badge tone={FLODESK_TONE[sub.flodesk.status] || ""}>{FLODESK_LABEL[sub.flodesk.status] || sub.flodesk.status}</Badge>
                      {(sub.flodesk.segments || []).length > 0 && <small>{sub.flodesk.segments.join(", ")}</small>}
                      {sub.flodesk.reason && <small className={sub.flodesk.status === "failed" ? "lk-warn-text" : "lk-muted"}>{sub.flodesk.reason}</small>}
                    </> : "—"}</td>}
                    <td><button type="button" className="btn ghost small" onClick={() => setOpenId(open ? null : sub._id)}>{open ? "Hide" : "View"}</button></td>
                  </tr>
                  {open && (
                    <tr className="fm-sub-detail"><td colSpan={form.flodesk?.enabled ? 6 : 5}>
                      <dl>
                        {Object.entries(p).filter(([k]) => !["publicKey", "website"].includes(k)).map(([k, v]) => <React.Fragment key={k}><dt>{labelOf(k)}</dt><dd>{showValue(v) || "—"}</dd></React.Fragment>)}
                        {sub.sourceUrl && <><dt>Sent from</dt><dd>{sub.sourceUrl}</dd></>}
                      </dl>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </DataState>
      <Pager page={page} pages={state.pages} total={state.total} loading={state.loading} onPage={setPage} />
    </Modal>
  );
}
