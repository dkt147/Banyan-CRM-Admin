import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";

// Notes on a contact, company or deal (client feedback 26 Nov: "a CTA to add a new note that
// will be dated, and we can see the user that created the note").
//   GET    /notes?contactId=|companyId=|dealId=&limit=50 → [{ _id, body, createdAt, updatedAt, userId: { _id, name } }]
//   POST   /notes { body, contactId?, companyId?, dealId? }
//   PATCH  /notes/:id { body }      (the author or an admin)
//   DELETE /notes/:id               (the author or an admin)
// A note on a deal also shows on its contact and company, so nothing is hidden on another page.
// Older servers without /notes: the record's single "Notes" text field is shown and edited instead.

const fmt = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" });
};
const MAX = 5000;

export default function RecordNotes({ type, id, legacy, onChanged }) {
  const { request, user } = useAuth();
  const canWrite = usePermissions().can("records.write");
  const [state, setState] = useState({ items: [], loading: true, error: "", missing: false });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);   // { id, body }

  const load = useCallback(async () => {
    try {
      const r = await request("/notes", { query: { [`${type}Id`]: id, limit: 50 } });
      setState({ items: r.data?.items || r.data || [], loading: false, error: "", missing: false });
    } catch (e) {
      setState({ items: [], loading: false, error: e.status === 404 ? "" : e.message || "Could not load the notes.", missing: e.status === 404 });
    }
  }, [request, type, id]);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) { setError("Write the note first."); return; }
    setBusy(true); setError("");
    try {
      await request("/notes", { method: "POST", body: { body, [`${type}Id`]: id } });
      setDraft("");
      await load();
      onChanged?.();
    } catch (err) { setError(err.message || "The note wasn't saved."); }
    finally { setBusy(false); }
  }

  async function saveEdit() {
    const body = editing.body.trim();
    if (!body) { setError("A note can't be empty. Use Delete to remove it."); return; }
    setBusy(true); setError("");
    try {
      await request(`/notes/${editing.id}`, { method: "PATCH", body: { body } });
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err) { setError(err.message || "The note wasn't saved."); }
    finally { setBusy(false); }
  }

  async function remove(note) {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    setBusy(true); setError("");
    try {
      await request(`/notes/${note._id}`, { method: "DELETE" });
      await load();
      onChanged?.();
    } catch (err) { setError(err.message || "The note wasn't deleted."); }
    finally { setBusy(false); }
  }

  if (state.missing) return <LegacyNotes legacy={legacy} canWrite={canWrite} />;

  const mine = (n) => user?.role === "admin" || String(n.userId?._id || n.userId) === String(user?._id);

  return (
    <div className="nt">
      {canWrite && (
        <form className="nt-new" onSubmit={add}>
          <textarea rows={3} maxLength={MAX} value={draft} disabled={busy} placeholder="Add a note… e.g. “Called Ken, wants a 2-person office from January.”"
            aria-label="New note" onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add(e); }} />
          <div className="nt-new-actions">
            <small className="lk-muted">Saved with today's date and your name. Ctrl+Enter to save.</small>
            <button type="submit" className="btn primary" disabled={busy || !draft.trim()}>{busy && !editing ? "Saving…" : "Add note"}</button>
          </div>
        </form>
      )}
      {error && <p className="lk-warn-text">{error}</p>}
      {state.error && <p className="rr-empty rr-error">{state.error}</p>}
      {state.loading ? <p className="rr-empty">Loading notes…</p>
        : !state.items.length && !legacy?.text ? <p className="rr-empty">No notes yet.</p>
          : (
            <ul className="nt-list">
              {state.items.map((n) => {
                const edited = n.updatedAt && n.createdAt && new Date(n.updatedAt) - new Date(n.createdAt) > 60000;
                const elsewhere = (type !== "deal" && n.dealId) ? (n.dealId.title ? `On deal: ${n.dealId.title}` : "On a deal") : "";
                return (
                  <li key={n._id} className="nt-item">
                    <div className="nt-meta">
                      <b>{n.userId?.name || n.user?.name || "Someone"}</b>
                      <time>{fmt(n.createdAt)}{edited ? " · edited" : ""}</time>
                      {elsewhere && <span className="nt-where">{elsewhere}</span>}
                    </div>
                    {editing?.id === n._id ? (
                      <div className="nt-edit">
                        <textarea rows={3} maxLength={MAX} autoFocus value={editing.body} disabled={busy} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                        <div className="nt-new-actions">
                          <button type="button" className="btn ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                          <button type="button" className="btn primary" onClick={saveEdit} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                        </div>
                      </div>
                    ) : <p className="nt-body">{n.body}</p>}
                    {canWrite && mine(n) && editing?.id !== n._id && (
                      <div className="nt-actions">
                        <button type="button" className="av-link" onClick={() => setEditing({ id: n._id, body: n.body })}>Edit</button>
                        <button type="button" className="av-link" onClick={() => remove(n)}>Delete</button>
                      </div>
                    )}
                  </li>
                );
              })}
              {legacy?.text && (
                <li className="nt-item nt-legacy">
                  <div className="nt-meta"><b>Earlier notes</b><time>from the old Notes field</time></div>
                  <p className="nt-body">{legacy.text}</p>
                </li>
              )}
            </ul>
          )}
    </div>
  );
}

/** Older server: one text field on the record (PATCH the record). */
function LegacyNotes({ legacy, canWrite }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(legacy?.text || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!editing) setText(legacy?.text || ""); }, [legacy?.text, editing]);
  if (!legacy) return <p className="rr-empty">Notes need the latest server update.</p>;
  async function save() {
    setBusy(true); setError("");
    try { await legacy.save(text); setEditing(false); }
    catch (e) { setError(e.message || "Not saved."); }
    finally { setBusy(false); }
  }
  return (
    <div className="nt">
      <p className="lk-muted">Dated notes with the author's name need the latest server update. Until then this is the single notes field.</p>
      {editing ? (
        <div className="nt-edit">
          <textarea rows={5} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
          <div className="nt-new-actions">
            <button type="button" className="btn ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button type="button" className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="nt-body">{legacy.text || "No notes yet."}</p>
          {canWrite && <button type="button" className="btn ghost" onClick={() => setEditing(true)}>Edit notes</button>}
        </>
      )}
      {error && <p className="lk-warn-text">{error}</p>}
    </div>
  );
}
