import React from "react";
import { hkAddDays, toHkInput } from "../utils/hkTime";

// "Added / Created" date filter for list pages. value is null or { preset, from, to }.
// Presets are worked out from today when the list loads, so a saved view called
// "Last 7 days" stays the last 7 days. Dates are Hong Kong calendar dates, inclusive.
// The API takes createdFrom / createdTo as YYYY-MM-DD (see dateRangeQuery).

const PRESETS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last7", "Last 7 days"],
  ["thisWeek", "This week"],
  ["lastWeek", "Last week"],
  ["last30", "Last 30 days"],
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
  ["custom", "Custom dates…"],
];

const ymd = (d) => toHkInput(d, "date");
const dayOf = (s) => new Date(`${s}T12:00:00+08:00`);
const addDays = (s, n) => ymd(hkAddDays(dayOf(s), n));

/** { from, to } (YYYY-MM-DD) for a filter value, or null for "any time". */
export function resolveRange(value) {
  if (!value?.preset) return null;
  const today = ymd(new Date());
  const dow = (dayOf(today).getUTCDay() + 6) % 7;   // 0 = Monday
  const [y, m] = today.split("-").map(Number);
  const monthStart = (yy, mm) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10);
  switch (value.preset) {
    case "today": return { from: today, to: today };
    case "yesterday": { const d = addDays(today, -1); return { from: d, to: d }; }
    case "last7": return { from: addDays(today, -6), to: today };
    case "last30": return { from: addDays(today, -29), to: today };
    case "thisWeek": return { from: addDays(today, -dow), to: today };
    case "lastWeek": { const mon = addDays(today, -dow - 7); return { from: mon, to: addDays(mon, 6) }; }
    case "thisMonth": return { from: monthStart(y, m), to: today };
    case "lastMonth": { const from = monthStart(y, m - 1); return { from, to: addDays(monthStart(y, m), -1) }; }
    case "custom": return value.from || value.to ? { from: value.from || "", to: value.to || "" } : null;
    default: return null;
  }
}

/** Query params for the API. */
export function dateRangeQuery(value) {
  const r = resolveRange(value);
  if (!r) return {};
  const q = {};
  if (r.from) q.createdFrom = r.from;
  if (r.to) q.createdTo = r.to;
  return q;
}

const short = (s) => (s ? dayOf(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Hong_Kong" }) : "…");

export default function DateRangeFilter({ label = "Created", value, onChange }) {
  const preset = value?.preset || "";
  const range = resolveRange(value);
  const today = ymd(new Date());
  return (
    <span className="drf">
      <label className="lk-select-filter">{label}
        <select aria-label={`${label} date`} value={preset}
          onChange={(e) => {
            const p = e.target.value;
            if (!p) onChange(null);
            else if (p === "custom") onChange({ preset: "custom", from: range?.from || addDays(today, -6), to: range?.to || today });
            else onChange({ preset: p });
          }}>
          <option value="">Any time</option>
          {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      {preset === "custom" && <>
        <label className="rb-daterange">From<input type="date" value={value.from || ""} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} /></label>
        <label className="rb-daterange">To<input type="date" value={value.to || ""} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} /></label>
      </>}
      {range && preset !== "custom" && <small className="lk-muted drf-range">{range.from === range.to ? short(range.from) : `${short(range.from)} – ${short(range.to)}`}</small>}
      {range && <button type="button" className="av-link" onClick={() => onChange(null)}>Clear</button>}
    </span>
  );
}
