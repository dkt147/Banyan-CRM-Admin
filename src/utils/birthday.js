// Contact birthdays (client feedback 26 Nov). Stored as "MM-DD" when the year isn't known,
// or "YYYY-MM-DD" when it is. People type it the Hong Kong way: day first.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pad = (n) => String(n).padStart(2, "0");

function monthFrom(word) {
  const i = MONTHS.indexOf(String(word).slice(0, 3).toLowerCase());
  return i >= 0 ? i + 1 : 0;
}

/**
 * "14/3", "14/03/1990", "1990-03-14", "14 Mar", "14 March 1990", "March 14" →
 * "03-14" or "1990-03-14". "" → null (clears it). Throws a readable error otherwise.
 */
export function parseBirthday(text) {
  const s = String(text ?? "").trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  let d = 0, m = 0, y = 0, match;
  if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) [y, m, d] = [+match[1], +match[2], +match[3]];
  else if ((match = /^-{0,2}(\d{1,2})-(\d{1,2})$/.exec(s)) && s.startsWith("-")) [m, d] = [+match[1], +match[2]];
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?$/.exec(s))) [d, m, y] = [+match[1], +match[2], +(match[3] || 0)];
  else if ((match = /^(\d{1,2}) ([A-Za-z]+)(?: (\d{4}))?$/.exec(s))) [d, m, y] = [+match[1], monthFrom(match[2]), +(match[3] || 0)];
  else if ((match = /^([A-Za-z]+) (\d{1,2})(?: (\d{4}))?$/.exec(s))) [m, d, y] = [monthFrom(match[1]), +match[2], +(match[3] || 0)];
  else throw new Error("Birthday: type it like 14/03, 14 Mar or 14/03/1990.");
  if (!m || m > 12 || !d || d > DAYS_IN[m - 1]) throw new Error("Birthday: that date doesn't exist. Use day/month, e.g. 14/03.");
  const thisYear = new Date().getFullYear();
  if (y && (y < 1900 || y > thisYear)) throw new Error(`Birthday: the year should be between 1900 and ${thisYear}.`);
  if (y && m === 2 && d === 29 && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) throw new Error(`Birthday: ${y} had no 29 February.`);
  return y ? `${y}-${pad(m)}-${pad(d)}` : `${pad(m)}-${pad(d)}`;
}

function parts(value) {
  const match = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? { y: +(match[1] || 0), m: +match[2], d: +match[3] } : null;
}

/** "03-14" → "14 Mar"; "1990-03-14" → "14 Mar 1990". */
export function formatBirthday(value) {
  const p = parts(value);
  if (!p) return value ? String(value) : "";
  const label = `${p.d} ${MONTHS[p.m - 1][0].toUpperCase()}${MONTHS[p.m - 1].slice(1)}`;
  return p.y ? `${label} ${p.y}` : label;
}

/** Form value: "14/03" or "14/03/1990". */
export const birthdayInput = (value) => {
  const p = parts(value);
  return p ? `${pad(p.d)}/${pad(p.m)}${p.y ? `/${p.y}` : ""}` : "";
};

/** Age they turn on their next (or today's) birthday, when the year is known. */
export function turningAge(value, today = new Date()) {
  const p = parts(value);
  if (!p?.y) return null;
  const hk = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  const passed = hk.getMonth() + 1 > p.m || (hk.getMonth() + 1 === p.m && hk.getDate() > p.d);
  return hk.getFullYear() - p.y + (passed ? 1 : 0);
}
