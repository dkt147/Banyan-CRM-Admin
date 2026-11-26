import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { TAG_GROUPS, tagInfo, tagLabel, tagOptionGroups, toTagKey, useTagCatalogue } from "../utils/contactTags";

/** <select> options for tags, grouped as Segments / Sources / Other. counts: { key: n } adds "(n)". */
export function TagOptions({ extraTags = [], exclude = [], counts }) {
  useTagCatalogue();
  return tagOptionGroups(extraTags).map((g) => (
    <optgroup key={g.key} label={g.label}>
      {g.tags.filter((t) => !exclude.includes(t)).map((t) => <option key={t} value={t}>{tagLabel(t)}{counts ? ` (${counts[t] || 0})` : ""}</option>)}
    </optgroup>
  ));
}

/** Tags in use across all contacts: GET /contacts/tags → { tags: [{ key, count }] }. Returns { key: count } or null. */
export function useTagCounts(refreshKey) {
  const { request } = useAuth();
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let active = true;
    request("/contacts/tags")
      .then((r) => active && setCounts(Object.fromEntries((r.data?.tags || []).map((t) => [t.key, t.count]))))
      .catch(() => active && setCounts(null));
    return () => { active = false; };
  }, [request, refreshKey]);
  return counts;
}

/** Small expandable explanation of every tag and how tags are used. */
export function TagGuide() {
  useTagCatalogue();
  return (
    <details className="tag-guide">
      <summary>What do the tags mean?</summary>
      <p>Tags group contacts so you can filter the list, save views and (later) pick automation and newsletter audiences. A contact can have several tags. Admins can add and rename tags in <b>Settings → Contact tags</b>.</p>
      {TAG_GROUPS.map((g) => (
        <div key={g.key}>
          <h4>{g.label}</h4>
          <dl>
            {g.tags.map(([key, label, description]) => <React.Fragment key={key}><dt>{label}</dt><dd>{description}</dd></React.Fragment>)}
          </dl>
        </div>
      ))}
    </details>
  );
}

/**
 * Tag chips with remove buttons and an "Add tag" picker. Saves the whole tag list through
 * onChange(tags) (PATCH /contacts/:id { tags }), so other tags are never lost.
 */
export function TagEditor({ tags = [], canEdit, onChange }) {
  useTagCatalogue();
  const [adding, setAdding] = useState("");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(next) {
    setSaving(true); setError("");
    try { await onChange(next); setAdding(""); setCustom(""); }
    catch (e) { setError(e.message || "Could not save tags."); }
    finally { setSaving(false); }
  }
  const add = (t) => t && !tags.includes(t) && save([...tags, t]);
  // Free-text tags: say why nothing happened instead of silently ignoring the input.
  function addCustom() {
    const key = toTagKey(custom);
    if (!custom.trim()) return;
    if (!key) { setError(`"${custom.trim()}" can't be a tag. Use letters or numbers, e.g. "Corporate client".`); return; }
    if (tags.includes(key)) { setError(`This contact already has the tag "${tagLabel(key)}".`); return; }
    if (tags.length >= 30) { setError("A contact can have at most 30 tags. Remove one first."); return; }
    save([...tags, key]);
  }

  return (
    <section className="dl-card" aria-label="Tags">
      <h3 className="dl-card-title">Tags</h3>
      <div className="tag-editor">
        {tags.length === 0 && <span className="lk-muted">No tags yet.</span>}
        {tags.map((t) => {
          const info = tagInfo(t);
          return (
            <span key={t} className={`tag-chip tag-${info.group}`} title={info.description}>
              {info.label}
              {canEdit && <button type="button" aria-label={`Remove ${info.label}`} disabled={saving} onClick={() => save(tags.filter((x) => x !== t))}>×</button>}
            </span>
          );
        })}
      </div>
      {canEdit && (
        <div className="tag-add">
          <select aria-label="Add tag" value={adding} disabled={saving} onChange={(e) => { setAdding(e.target.value); add(e.target.value); }}>
            <option value="">Add tag…</option>
            <TagOptions exclude={tags} />
          </select>
          <input aria-label="Custom tag" placeholder="Or type a new tag" value={custom} disabled={saving}
            onChange={(e) => { setCustom(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
          <button type="button" className="btn ghost" disabled={saving || !custom.trim()} onClick={addCustom}>Add</button>
          {custom.trim() && toTagKey(custom) && toTagKey(custom) !== custom.trim() && <span className="lk-muted">Saved as <code>{toTagKey(custom)}</code></span>}
        </div>
      )}
      {error && <p className="lk-warn-text">{error}</p>}
      <TagGuide />
    </section>
  );
}
