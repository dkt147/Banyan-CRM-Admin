import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { useAuth } from "../auth/AuthContext";

/*
 * Shared list-page building blocks (brief 6.7: search, filter chips, saved views,
 * bulk actions, loading/empty/error states). Styling uses the existing theme tokens.
 */

/** Search input that reports its value after the user stops typing. */
export function SearchBox({ value, onChange, placeholder = "Search…", delay = 300 }) {
  const [text, setText] = useState(value || "");
  const first = useRef(true);
  useEffect(() => { setText(value || ""); }, [value]);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const timer = setTimeout(() => { if (text !== (value || "")) onChange(text); }, delay);
    return () => clearTimeout(timer);
  }, [text]);
  return (
    <label className="lk-search">
      <Icon name="MagnifyingGlass" size={16} weight="regular" />
      <input type="search" value={text} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setText(e.target.value)} />
    </label>
  );
}

/** Toggle chips. chips: [{ key, label, active }] */
export function FilterChips({ chips, onToggle, onClear, label }) {
  const anyActive = chips.some((c) => c.active);
  return (
    <div className="lk-chips" role="group" aria-label={label || "Filters"}>
      {label && <span className="lk-chips-label">{label}</span>}
      {chips.map((chip) => (
        <button key={chip.key} type="button" className={`lk-chip ${chip.active ? "active" : ""}`} aria-pressed={chip.active} onClick={() => onToggle(chip.key)}>
          {chip.active && <Icon name="Check" size={12} weight="bold" />}
          {chip.label}
        </button>
      ))}
      {onClear && anyActive && <button type="button" className="lk-chip-clear" onClick={onClear}>Clear</button>}
    </div>
  );
}

/**
 * Saved views, stored per user in User.preferences.savedViews[page] through the
 * existing PATCH /auth/profile endpoint, so they follow the user across devices.
 */
export function SavedViews({ page, current, onApply }) {
  const { user, request, updateUser } = useAuth();
  const views = useMemo(() => user?.preferences?.savedViews?.[page] || [], [user, page]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function persist(nextViews) {
    setError("");
    const preferences = { ...(user?.preferences || {}), savedViews: { ...(user?.preferences?.savedViews || {}), [page]: nextViews } };
    try {
      const response = await request("/auth/profile", { method: "PATCH", body: { preferences } });
      if (response?.data?.user) updateUser(response.data.user);
    } catch (e) { setError(e.message || "Could not save the view."); }
  }

  async function saveCurrent() {
    const name = window.prompt("Name this view");
    if (!name || !name.trim()) return;
    const trimmed = name.trim().slice(0, 60);
    await persist([...views.filter((v) => v.name !== trimmed), { name: trimmed, state: current }].slice(-20));
  }

  return (
    <div className="lk-views">
      <button type="button" className="btn ghost lk-views-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="BookmarkSimple" size={15} /> Views{views.length ? ` (${views.length})` : ""}
      </button>
      {open && (
        <div className="lk-views-menu" role="menu">
          {views.length === 0 && <p className="lk-muted">No saved views yet.</p>}
          {views.map((view) => (
            <div key={view.name} className="lk-view-row">
              <button type="button" role="menuitem" onClick={() => { onApply(view.state); setOpen(false); }}>{view.name}</button>
              <button type="button" className="lk-icon-btn" aria-label={`Delete view ${view.name}`} onClick={() => persist(views.filter((v) => v.name !== view.name))}>
                <Icon name="X" size={12} />
              </button>
            </div>
          ))}
          <button type="button" className="lk-view-save" onClick={saveCurrent}>+ Save current view</button>
          {error && <p className="lk-error-text">{error}</p>}
        </div>
      )}
    </div>
  );
}

/** Row selection for bulk actions. */
export function useSelection(rows) {
  const [selected, setSelected] = useState(() => new Set());
  const ids = rows.map((r) => r._id);
  useEffect(() => {
    // Drop selections that are no longer on screen.
    setSelected((prev) => new Set([...prev].filter((id) => ids.includes(id))));
  }, [ids.join(",")]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  return {
    selected,
    count: selected.size,
    has: (id) => selected.has(id),
    toggle: (id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }),
    toggleAll: () => setSelected(allSelected ? new Set() : new Set(ids)),
    allSelected,
    clear: () => setSelected(new Set()),
    ids: () => [...selected],
  };
}

export function BulkBar({ count, onClear, children }) {
  if (!count) return null;
  return (
    <div className="lk-bulk" role="region" aria-label="Bulk actions">
      <b>{count} selected</b>
      <div className="lk-bulk-actions">{children}</div>
      <button type="button" className="btn ghost" onClick={onClear}>Clear selection</button>
    </div>
  );
}

/** Runs one request per id and reports how many failed. */
export async function runBulk(ids, fn) {
  const results = await Promise.allSettled(ids.map((id) => fn(id)));
  const failed = results.filter((r) => r.status === "rejected");
  return { ok: results.length - failed.length, failed: failed.length, firstError: failed[0]?.reason?.message || "" };
}

/** Loading / error / empty wrapper for list and detail content. */
export function DataState({ loading, error, empty, emptyText = "Nothing here yet.", onRetry, children }) {
  if (error)
    return (
      <div className="lk-state lk-state-error" role="alert">
        <Icon name="WarningCircle" size={22} />
        <p>{error}</p>
        {onRetry && <button type="button" className="btn ghost" onClick={onRetry}>Try again</button>}
      </div>
    );
  if (loading && empty)
    return (
      <div className="lk-state" aria-busy="true">
        <div className="lk-skeleton" /><div className="lk-skeleton" /><div className="lk-skeleton short" />
      </div>
    );
  if (empty)
    return (
      <div className="lk-state">
        <Icon name="Tray" size={22} />
        <p>{emptyText}</p>
      </div>
    );
  return children;
}

export function Pager({ page, pages, total, onPage, loading }) {
  if (!pages || pages <= 1) return total ? <div className="lk-pager"><span>{total} record{total === 1 ? "" : "s"}</span></div> : null;
  return (
    <div className="lk-pager">
      <span>{total} records · page {page} of {pages}</span>
      <div>
        <button type="button" className="btn ghost" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="btn ghost" disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function CheckCell({ checked, onChange, label }) {
  return (
    <td className="lk-check" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
    </td>
  );
}
