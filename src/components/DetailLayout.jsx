import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import RelatedRecords, { ActivityTimeline, useRelated } from "./RelatedRecords";
import { DataState } from "./ListKit";
import { toHkInput } from "../utils/hkTime";

/*
 * Two-column record page (brief 6.7): details on the left, timeline and related records
 * on the right. Back returns to the previous page when there is one (brief 6.1).
 */
export function DetailLayout({ type, id, listPath, listLabel, title, subtitle, badges, actions, loading, error, onRetry, children, showLinks = false }) {
  const navigate = useNavigate();
  const related = useRelated(type, id);
  const goBack = () => {
    // history.state.idx is set by React Router; 0 means this page was opened directly.
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(listPath);
  };
  return (
    <div className="dl-page">
      <header className="dl-head">
        <button type="button" className="dl-back" onClick={goBack}>
          <Icon name="ArrowLeft" size={16} weight="regular" /> Back
        </button>
        <nav className="dl-crumb" aria-label="Breadcrumb">
          <a href={listPath} onClick={(e) => { e.preventDefault(); navigate(listPath); }}>{listLabel}</a>
          <span>/</span>
          <span>{loading && !title ? "Loading…" : title || "Record"}</span>
        </nav>
      </header>
      <DataState loading={loading} error={error} empty={!title} emptyText="Record not found." onRetry={onRetry}>
        <div className="dl-titlebar">
          <div>
            {subtitle && <span className="eyebrow">{subtitle}</span>}
            <h1>{title}</h1>
            {badges && <div className="dl-badges">{badges}</div>}
          </div>
          {actions && <div className="dl-actions">{actions}</div>}
        </div>
        <div className="dl-grid">
          <div className="dl-main">{children}</div>
          <aside className="dl-side">
            <ActivityTimeline related={related} />
            <section className="dl-card" aria-label="Related records">
              <h3 className="dl-card-title">Related records</h3>
              <RelatedRecords type={type} id={id} related={related} showLinks={showLinks} />
            </section>
          </aside>
        </div>
      </DataState>
    </div>
  );
}

export function Card({ title, children, actions }) {
  return (
    <section className="dl-card">
      {(title || actions) && (
        <div className="dl-card-head">
          {title && <h3 className="dl-card-title">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

// Date inputs show and accept Hong Kong time (see utils/hkTime.js).
const toLocalInput = (value, type) => toHkInput(value, type);

/**
 * Field list with an Edit mode. fields: [{ key, label, type, options, value, display, required, span }]
 * onSave(values) receives only the changed keys; it should throw to keep the form open.
 */
export function FieldGrid({ title = "Details", fields, onSave, canEdit = true }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const initial = () => Object.fromEntries(fields.filter((f) => !f.readOnly).map((f) => [f.key, f.type === "date" || f.type === "datetime-local" ? toLocalInput(f.value, f.type) : f.value ?? ""]));
  useEffect(() => { if (!editing) setValues(initial()); }, [editing, fields]);

  async function save() {
    const start = initial();
    const missing = fields.find((f) => f.required && !String(values[f.key] ?? "").trim());
    if (missing) { setError(`${missing.label} is required.`); return; }
    const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => String(v ?? "") !== String(start[k] ?? "")));
    if (!Object.keys(changed).length) { setEditing(false); return; }
    setSaving(true); setError("");
    try { await onSave(changed); setEditing(false); }
    catch (e) { setError(e.message || "Could not save changes."); }
    finally { setSaving(false); }
  }

  return (
    <Card
      title={title}
      actions={canEdit && onSave && (editing ? (
        <div className="dl-card-actions">
          <button type="button" className="btn ghost" onClick={() => { setEditing(false); setError(""); }} disabled={saving}>Cancel</button>
          <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      ) : (
        <button type="button" className="btn ghost" onClick={() => setEditing(true)}><Icon name="PencilSimple" size={14} /> Edit</button>
      ))}
    >
      {error && <div className="notice error"><b>Not saved</b><span>{error}</span></div>}
      <dl className="dl-fields">
        {fields.map((f) => (
          <div key={f.key} className={`dl-field ${f.span ? "span-2" : ""}`}>
            <dt>{f.label}{editing && f.required && <span className="required-mark"> *</span>}</dt>
            <dd>
              {editing && !f.readOnly ? (
                f.type === "select" ? (
                  <select value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                    {(f.options || []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea rows={4} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                ) : (
                  <input type={f.type || "text"} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                )
              ) : (
                f.display ?? (f.value === null || f.value === undefined || f.value === "" ? "—" : String(f.value))
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export const fmtDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
export const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
