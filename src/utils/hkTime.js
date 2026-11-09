/*
 * Hong Kong time for the whole CRM (decision 2026-11-10: show HK time regardless of the
 * browser's time zone). Hong Kong has no daylight saving, so a fixed +08:00 offset is
 * exact. Use these helpers instead of Date getters (getHours, getDate, …), which use the
 * browser's own time zone.
 */
export const HK_TZ = "Asia/Hong_Kong";
const HK_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");

/** Wall-clock parts in Hong Kong. month is 1-12, weekday 0 (Sun) - 6 (Sat). */
export function hkParts(value) {
  const s = new Date(new Date(value).getTime() + HK_OFFSET_MS);
  return { year: s.getUTCFullYear(), month: s.getUTCMonth() + 1, day: s.getUTCDate(), hour: s.getUTCHours(), minute: s.getUTCMinutes(), weekday: s.getUTCDay() };
}

/** Instant for a Hong Kong wall-clock time. Month is 1-12 and may overflow. */
export function hkDate(year, month, day = 1, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - HK_OFFSET_MS);
}

export const hkStartOfDay = (value) => { const p = hkParts(value); return hkDate(p.year, p.month, p.day); };
export const hkAddDays = (value, days) => new Date(new Date(value).getTime() + days * DAY_MS);
export const hkSameDay = (a, b) => { const x = hkParts(a), y = hkParts(b); return x.year === y.year && x.month === y.month && x.day === y.day; };
export const hkDaysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Value for <input type="datetime-local"> or <input type="date">, in Hong Kong time. */
export function toHkInput(value, type = "datetime-local") {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = hkParts(d);
  const date = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  return type === "date" ? date : `${date}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Reads a datetime-local/date input value as Hong Kong time. */
export function fromHkInput(value) {
  if (!value) return null;
  const v = value.length === 10 ? `${value}T00:00` : value.slice(0, 16);
  const d = new Date(`${v}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const fmtHk = (value, options) =>
  value ? new Intl.DateTimeFormat("en-GB", { timeZone: HK_TZ, ...options }).format(new Date(value)) : "";
