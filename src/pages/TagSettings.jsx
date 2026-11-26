import React, { useCallback, useEffect, useState } from "react";
import { Page } from "./Dashboard";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
import { GROUP_LABELS, applyTagCatalogue, toTagKey } from "../utils/contactTags";
import { useTagCounts } from "../components/ContactTags";

// Settings → Contact tags (client feedback 26 Nov: "Can we edit the tags list on our end?").
//   GET   /contact-tags?includeInactive=true → [{ _id, key, label, description, group, isActive, isSystem, sortOrder }]
//   POST  /contact-tags { label, description, group }   (the server makes the key from the label)
//   PATCH /contact-tags/:id { label, description, group, isActive }
// The key never changes, so renaming a tag renames it on every contact at once.
// Archiving hides the tag from the pickers; contacts that have it keep it.

const GROUPS = Object.entries(GROUP_LABELS);

export default function TagSettings() {
  const { request, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const counts = useTagCounts(0);
  const [state, setState] = useState({ items: [], loading: true, error: "", missing: false });
  const [editing, setEditing] = useState(null);   // {} for new, or the tag
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await request("/contact-tags", { query: { includeInactive: true } });
      const items = r.data?.items || r.data || [];
      applyTagCatalogue(items);
      setState({ items, loading: false, error: "", missing: false });
    } catch (e) {
      setState({ items: [], loading: false, error: e.status === 404 ? "" : e.message || "Could not load the tags.", missing: e.status === 404 });
    }
  }, [request]);
  useEffect(() => { load(); }, [load]);

  async function setActive(tag, isActive) {
    if (!isActive && !window.confirm(`Archive “${tag.label}”? It leaves the tag pickers. The ${counts?.[tag.key] || 0} contact(s) that have it keep it.`)) return;
    try {
      await request(`/contact-tags/${tag._id}`, { method: "PATCH", body: { isActive } });
      setNotice(isActive ? `“${tag.label}” is back in the pickers.` : `“${tag.label}” archived.`);
      await load();
    } catch (e) { setNotice(e.message || "Could not save."); }
  }

  const visible = state.items.filter((t) => showArchived || t.isActive !== false);

  return (
    <Page title="Contact tags" kicker="Settings · the tags staff can put on contacts"
      actions={isAdmin && !state.missing && <button type="button" className="btn primary" onClick={() => setEditing({})}>Add tag</button>}>
      {state.missing && <div className="notice"><b>Server update needed</b><span>Editing tags needs the latest server update. Until then the CRM uses the standard list.</span></div>}
      {state.error && <div className="notice error"><b>Tags</b><span>{state.error}</span><button type="button" className="btn ghost" onClick={load}>Retry</button></div>}
      {notice && <p className="lk-muted" role="status">{notice}</p>}
      {!isAdmin && !state.missing && <p className="lk-muted">Only admins can change tags.</p>}

      {!state.missing && (
        <>
          <label className="fm-inline ts-archived"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived tags</label>
          {state.loading && !state.items.length ? <p className="lk-muted">Loading tags…</p> : GROUPS.map(([group, label]) => {
            const rows = visible.filter((t) => (t.group === "source" ? "source" : "segment") === group);
            return (
              <section key={group} className="panel table-wrap ts-group">
                <h2 className="ts-title">{label}</h2>
                {group === "source" && <p className="lk-muted">The CRM adds these automatically (website, WhatsApp, forms…). You can rename them, but archiving one doesn't stop the CRM adding it.</p>}
                <table>
                  <thead><tr><th>Tag</th><th>Meaning</th><th>Contacts</th><th>Status</th>{isAdmin && <th />}</tr></thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t._id || t.key} className={t.isActive === false ? "is-inactive" : ""}>
                        <td><b>{t.label}</b><small className="dl-sub">{t.key}</small></td>
                        <td>{t.description || "—"}</td>
                        <td>{counts ? counts[t.key] || 0 : "–"}</td>
                        <td>{t.isActive === false ? "Archived" : "In use"}</td>
                        {isAdmin && <td className="ts-actions">
                          <button type="button" className="btn ghost" onClick={() => setEditing(t)}>Edit</button>
                          {t.isActive === false
                            ? <button type="button" className="btn ghost" onClick={() => setActive(t, true)}>Restore</button>
                            : <button type="button" className="btn ghost" onClick={() => setActive(t, false)}>Archive</button>}
                        </td>}
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={isAdmin ? 5 : 4} className="lk-muted">No tags here.</td></tr>}
                  </tbody>
                </table>
              </section>
            );
          })}
        </>
      )}
      {editing && <TagEditorModal tag={editing} existing={state.items} onClose={() => setEditing(null)}
        onSaved={async (msg) => { setEditing(null); setNotice(msg); await load(); }} />}
    </Page>
  );
}

function TagEditorModal({ tag, existing, onClose, onSaved }) {
  const { request } = useAuth();
  const isNew = !tag._id;
  const [v, setV] = useState({ label: tag.label || "", description: tag.description || "", group: tag.group === "source" ? "source" : "segment" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = isNew ? toTagKey(v.label) : tag.key;

  async function submit(e) {
    e.preventDefault();
    const label = v.label.trim();
    if (!label) { setError("Give the tag a name."); return; }
    if (label.length > 50) { setError("Keep the name to 50 characters or fewer."); return; }
    if (isNew && !key) { setError("Use letters or numbers in the name."); return; }
    if (existing.some((t) => t._id !== tag._id && (t.key === key || t.label.trim().toLowerCase() === label.toLowerCase()))) { setError("A tag with this name already exists (it may be archived)."); return; }
    setBusy(true); setError("");
    try {
      const body = { label, description: v.description.trim(), group: v.group };
      if (isNew) await request("/contact-tags", { method: "POST", body });
      else await request(`/contact-tags/${tag._id}`, { method: "PATCH", body });
      onSaved(isNew ? `“${label}” added. Staff can now pick it on contacts.` : `“${label}” saved. Contacts with this tag show the new name.`);
    } catch (err) { setError(err.message || "Could not save the tag."); setBusy(false); }
  }

  return (
    <Modal title={isNew ? "Add a contact tag" : `Edit “${tag.label}”`} onClose={onClose} actions={<>
      <button type="submit" form="tag-form" className="btn primary" disabled={busy}>{busy ? "Saving…" : isNew ? "Add tag" : "Save"}</button>
      <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
    </>}>
      <form id="tag-form" className="form-grid" onSubmit={submit}>
        <label className="form-span-2">Name<input autoFocus maxLength={50} value={v.label} disabled={busy} placeholder="e.g. Corporate client" onChange={(e) => setV({ ...v, label: e.target.value })} />
          <small className="lk-muted">{isNew ? (key ? `Saved as “${key}”. This code can't change later; the name can.` : "") : `Code: ${tag.key} (doesn't change).`}</small>
        </label>
        <label className="form-span-2">What it means<textarea rows={2} maxLength={200} value={v.description} disabled={busy} placeholder="Shown in “What do the tags mean?”" onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
        <label>Group
          <select value={v.group} disabled={busy || tag.isSystem} onChange={(e) => setV({ ...v, group: e.target.value })}>
            {GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {error && <p className="lk-warn-text form-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
