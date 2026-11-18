import React, { useEffect, useRef, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";

// Email and message templates. Two ways to make one:
//  1. Write it here: plain text or simple HTML, with {{variables}} filled in when sent.
//  2. Design it in an email tool (Brevo, Mailchimp, Canva…), export the HTML and import it.
// Both are stored the same way (subject + body); the preview shows sample data.

const CATEGORIES = ["membership", "renewal_reminder", "day_pass", "meeting_rooms", "events", "virtual_office", "follow_up", "general"];
const catLabel = (c) => String(c || "general").replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
const CATEGORY_HELP = {
  renewal_reminder: "Used for automatic membership renewal emails: the newest active template in this category is sent. It can also use {{endDate}} and {{daysLeft}}.",
};
export const VARIABLES = [
  ["firstName", "First name", "Jane"], ["lastName", "Last name", "Chan"], ["fullName", "Full name", "Jane Chan"],
  ["email", "Email", "jane@example.com"], ["companyName", "Company", "Harbour Ventures Ltd"],
  ["dealTitle", "Deal", "Virtual office – Harbour Ventures"], ["bookingDate", "Booking date", "Fri, 13 Nov 2026"],
  ["bookingTime", "Booking time", "13:00–16:00"], ["roomName", "Room", "Meeting Room (14 people)"],
  ["staffName", "Your name", "Felicia"], ["staffEmail", "Your email", "hello@banyanworkspace.com"],
];
// Only filled in for renewal reminders.
const RENEWAL_VARIABLES = [["endDate", "End date", "31 Dec 2026"], ["daysLeft", "Days left", "14"]];
const SAMPLE = Object.fromEntries([...VARIABLES, ...RENEWAL_VARIABLES].map(([k, , v]) => [k, v]));
// The backend stores at most 512,000 characters of body.
const MAX_BODY = 512000;
const TOO_LARGE = "This message is over 500 KB, the most an email can be. Usually that means images are embedded in the HTML: host them online and link to them, then try again.";

const empty = { name: "", subject: "", body: "", category: "general", triggerStage: "", variables: [], followUp: { enabled: false, delayDays: 0 }, isActive: true };

const isHtml = (s) => /<\s*(html|body|table|div|p|br|h[1-6]|a|img|span)\b/i.test(String(s || ""));
const fill = (s) => String(s || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => SAMPLE[k] ?? m);
const usedVariables = (...texts) => [...new Set(texts.join(" ").match(/\{\{\s*(\w+)\s*\}\}/g)?.map((m) => m.replace(/[{}\s]/g, "")) || [])];

function Preview({ subject, body }) {
  return (
    <div className="tp-preview">
      <div className="tp-preview-subject"><span>Subject</span><b>{fill(subject) || "—"}</b></div>
      {isHtml(body)
        ? <iframe title="Email preview" className="tp-frame" sandbox="" srcDoc={fill(body)} />
        : <div className="template-preview">{fill(body) || <span className="lk-muted">Nothing written yet.</span>}</div>}
    </div>
  );
}

export default function Templates() {
  const { request } = useAuth();
  // Admin manages; Sales can view and use (brief section 7).
  const canManage = usePermissions().can("templates.manage");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);   // "new" | "edit"
  const [error, setError] = useState("");

  async function load(selectId) {
    try {
      const r = await request("/templates", { query: { limit: 100 } });
      const x = r.data?.items || [];
      setRows(x);
      setSelected((s) => x.find((t) => t._id === (selectId || s?._id)) || x[0] || null);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    if (!selected || !window.confirm(`Delete the template "${selected.name}"?`)) return;
    try { await request(`/templates/${selected._id}`, { method: "DELETE" }); setSelected(null); load(); }
    catch (e) { setError(e.message); }
  }
  async function duplicate() {
    if (!selected) return;
    try {
      const { name, subject, body, category, variables, triggerStage, followUp, isActive } = selected;
      const r = await request("/templates", { method: "POST", body: { name: `${name} copy`, subject, body, category, variables: variables || [], triggerStage, followUp, isActive } });
      load(r.data?._id);
    } catch (e) { setError(e.message); }
  }

  return (
    <Page title="Templates" kicker="Reusable customer communication" actions={canManage && <button className="btn primary" onClick={() => setModal("new")}>New template</button>}>
      {error && <div className="notice error"><b>Templates</b><span>{error}</span></div>}
      <details className="panel tp-guide">
        <summary>How to design a template</summary>
        <div className="tp-guide-grid">
          <div>
            <h4>Write it here (recommended for most emails)</h4>
            <p>Plain, personal emails get the best replies. Click <b>New template</b>, write the subject and message, and use the variable buttons to add the customer's name, room, date and so on. They're filled in when the email is sent.</p>
          </div>
          <div>
            <h4>Design it elsewhere and import</h4>
            <p>For branded newsletters with images and buttons, design the email in Brevo, Mailchimp or Canva, export or download it as <b>HTML</b>, then use <b>Import HTML file</b> in the editor. You can still add variables like <code>{"{{firstName}}"}</code> to the imported HTML. HTML templates are sent as HTML with a plain-text copy, up to 500 KB.</p>
          </div>
        </div>
      </details>
      <div className="contact-grid">
        <section className="panel contact-list">
          {rows.length === 0 ? <Empty text="No templates yet." /> : rows.map((t) => (
            <button key={t._id} className={`contact-row ${selected?._id === t._id ? "selected" : ""}`} onClick={() => setSelected(t)}>
              <div><b>{t.name}</b><span>{catLabel(t.category)} · {t.isActive ? "Active" : "Inactive"}{isHtml(t.body) ? " · HTML" : ""}</span></div>
            </button>
          ))}
        </section>
        <section className="panel contact-detail">
          {!selected ? <Empty text="Select a template." /> : <>
            <div className="profile-head">
              <div><span className="eyebrow">{catLabel(selected.category)}</span><h2>{selected.name}</h2></div>
              {canManage && <div className="actions">
                <button className="btn ghost" onClick={duplicate}>Duplicate</button>
                <button className="btn ghost" onClick={() => setModal("edit")}>Edit</button>
                <button className="btn ghost" onClick={remove}>Delete</button>
              </div>}
            </div>
            <p className="lk-muted">Preview with sample data{(selected.variables || []).length ? ` · uses ${selected.variables.map((v) => `{{${v}}}`).join(", ")}` : ""}</p>
            <Preview subject={selected.subject} body={selected.body} />
          </>}
        </section>
      </div>
      {modal && <TemplateEditor initial={modal === "edit" ? selected : empty} isNew={modal === "new"}
        onClose={() => setModal(null)} onSaved={(id) => { setModal(null); load(id); }} />}
    </Page>
  );
}

function TemplateEditor({ initial, isNew, onClose, onSaved }) {
  const { request } = useAuth();
  const [form, setForm] = useState({ ...empty, ...initial, category: initial.category || "general" });
  const [tab, setTab] = useState("write");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);
  const fileRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function insertVariable(key) {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    if (!el) { set({ body: form.body + token }); return; }
    const start = el.selectionStart ?? form.body.length, end = el.selectionEnd ?? start;
    set({ body: form.body.slice(0, start) + token + form.body.slice(end) });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  }
  async function importHtml(file) {
    if (!file) return;
    if (file.size > 500 * 1024) { setError("That file is over 500 KB, the most an email can be. Host the images online (not embedded) and export the email again."); return; }
    const text = await file.text();
    const title = text.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    set({ body: text, subject: form.subject || title || "", name: form.name || file.name.replace(/\.html?$/i, "") });
    setTab("preview");
  }
  async function save() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) { setError("Name, subject and message are required."); return; }
    if (form.body.length > MAX_BODY) { setError(TOO_LARGE); return; }
    setSaving(true); setError("");
    const body = {
      name: form.name.trim(), subject: form.subject, body: form.body, category: form.category,
      variables: usedVariables(form.subject, form.body), triggerStage: form.triggerStage || "",
      followUp: form.followUp || { enabled: false, delayDays: 0 }, isActive: Boolean(form.isActive),
    };
    try {
      const r = await request(isNew ? "/templates" : `/templates/${initial._id}`, { method: isNew ? "POST" : "PATCH", body });
      onSaved(r.data?._id || initial._id);
    } catch (e) {
      // 413 TEMPLATE_TOO_LARGE carries its own message (body or subject); older servers sent a raw Mongo maxlength error.
      const legacyTooLarge = /longer than the maximum allowed length/i.test(e.message || "");
      setError(e.status === 409 ? "A template with this name already exists." : e.status === 413 ? (e.message || TOO_LARGE) : legacyTooLarge ? TOO_LARGE : e.message);
      setSaving(false);
    }
  }

  return (
    <Modal className="tp-modal" title={isNew ? "New template" : `Edit · ${initial.name}`} onClose={() => !saving && onClose()} actions={<>
      <button className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
      <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save template"}</button>
    </>}>
      {error && <div className="notice error"><b>Template</b><span>{error}</span></div>}
      <div className="form-grid">
        <label>Name<input value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label>Category<select value={form.category} onChange={(e) => set({ category: e.target.value })}>
          {[...new Set([...CATEGORIES, form.category])].map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
        </select></label>
        <label className="form-span-2">Subject<input value={form.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="e.g. Your meeting room booking on {{bookingDate}}" /></label>
      </div>
      <div className="tp-toolbar">
        <div className="av-seg" role="tablist">
          {[["write", "Write"], ["preview", "Preview"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>Import HTML file</button>
        <input ref={fileRef} type="file" accept=".html,.htm,text/html" hidden onChange={(e) => { importHtml(e.target.files?.[0]); e.target.value = ""; }} />
        <label className="fm-inline"><input type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => set({ isActive: e.target.checked })} /> Active</label>
      </div>
      {tab === "write" ? <>
        <div className="tp-vars" aria-label="Insert variable">
          <span>Insert:</span>
          {[...VARIABLES, ...(form.category === "renewal_reminder" ? RENEWAL_VARIABLES : [])].map(([k, l]) => <button key={k} type="button" className="lk-chip" title={`{{${k}}} → ${SAMPLE[k]}`} onClick={() => insertVariable(k)}>{l}</button>)}
        </div>
        {CATEGORY_HELP[form.category] && <p className="lk-muted">{CATEGORY_HELP[form.category]}</p>}
        <textarea ref={bodyRef} className="tp-body" rows={14} value={form.body} onChange={(e) => set({ body: e.target.value })}
          placeholder={"Hi {{firstName}},\n\nThanks for booking {{roomName}} on {{bookingDate}}…\n\nBest,\n{{staffName}}"} />
        {isHtml(form.body) && <p className="lk-muted">This message is HTML. Use Preview to check how it looks.</p>}
      </> : <Preview subject={form.subject} body={form.body} />}
    </Modal>
  );
}
