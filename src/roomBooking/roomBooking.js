import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

// WordPress meeting-room bookings (Banyan Room Booking plugin). WordPress owns every
// booking; the CRM reads a cached copy through /room-bookings and creates new ones by
// calling the plugin's public endpoints straight from the staff browser, so the
// 12-checkouts-per-10-minutes limit applies per staff member, not to the CRM server.

// Fallback when GET /room-bookings/config is unavailable (spec §3; keep in step with WP settings).
export const FALLBACK_CONFIG = {
  rest: "https://banyanworkspace.com/wp-json/banyan/v1/",
  rooms: [
    { key: "small", name: "Meeting Room", capacity: "5 to 6 people", price: 250 },
    { key: "medium", name: "Meeting Room", capacity: "14 people", price: 580 },
    { key: "library", name: "The Library", capacity: "15 people (depending on layout)", price: 888 },
  ],
  open: 9, close: 18, days: [1, 2, 3, 4, 5], maxDays: 90, holdMinutes: 35, checkoutExpiresMinutes: 31,
  enabled: true,
  returnUrl: "https://banyanworkspace.com/meeting-rooms-hong-kong/",
  notesPrefix: "Booked via CRM",
  syncConfigured: false,
};

function normalise(raw, fallbackStaff) {
  const c = { ...FALLBACK_CONFIG, ...(raw || {}) };
  c.rest = String(c.rest || FALLBACK_CONFIG.rest).replace(/\/*$/, "/");
  c.open = Number(c.open); c.close = Number(c.close); c.maxDays = Number(c.maxDays);
  c.days = (c.days || []).map(Number);
  c.rooms = (c.rooms || []).map((r) => ({ ...r, price: Number(r.price), label: r.label || `${r.name} (${r.capacity})` }));
  if (!raw?.notesPrefix && fallbackStaff) c.notesPrefix = `Booked via CRM by ${fallbackStaff}`;
  return c;
}

let configPromise = null;
let resolvedConfig = null;
export function useRoomBookingConfig() {
  const { request, user } = useAuth();
  const [config, setConfig] = useState(resolvedConfig);
  useEffect(() => {
    let active = true;
    if (!configPromise) {
      configPromise = request("/room-bookings/config")
        .then((r) => (resolvedConfig = normalise(r?.data, user?.name || user?.email)))
        .catch(() => { configPromise = null; return normalise(null, user?.name || user?.email); });
    }
    configPromise.then((c) => active && setConfig(c));
    return () => { active = false; };
  }, [request, user]);
  return config;
}

/** Calls a public WordPress endpoint. Errors carry the API's own `message` (shown as-is). */
export async function wpApi(config, path, { method = "GET", body } = {}) {
  let url = config.rest + path;
  if (method === "GET") url += (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  const init = { method, headers: { Accept: "application/json" } };
  if (body) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
  let response;
  try { response = await fetch(url, init); }
  catch { const e = new Error("Could not reach the booking system. Check your connection and try again."); e.status = 0; throw e; }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const e = new Error(json.message || "Something went wrong. Please try again.");
    e.status = response.status;
    throw e;
  }
  return json;
}

/* ---------- formatting (same output as the website's booking.js) ---------- */
export const TZ = "Asia/Hong_Kong";
export const pad = (n) => (n < 10 ? "0" : "") + n;
export const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const isoDow = (y, m, d) => { const w = new Date(Date.UTC(y, m, d)).getUTCDay(); return w === 0 ? 7 : w; };
export const hl = (h) => `${pad(h)}:00`;
export const money = (n) => "HK$" + Number(n).toLocaleString("en-HK", { maximumFractionDigits: 2 });
export const hoursText = (n) => `${n}${n === 1 ? " hour" : " hours"}`;
export function longDate(s) {
  const p = s.split("-");
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
export function addDaysYmd(s, n) {
  const p = s.split("-");
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
}
export function hkNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t) => parts.find((x) => x.type === t)?.value || "0";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: parseInt(g("hour"), 10) % 24 };
}
/** HK calendar date (YYYY-MM-DD) of a Date. */
export function hkYmd(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export const sessionIdFromUrl = (url) => (String(url || "").match(/\/c\/pay\/(cs_[^/#?]+)/) || [])[1] || null;
export const roomLabel = (room) => room ? room.label || `${room.name} (${room.capacity})` : "";
/** Matches a CRM resource / booking room name ("Meeting Room (14 people)") to a WP room. */
export const roomByName = (config, name) => config?.rooms.find((r) => roomLabel(r) === name) || null;

/* ---------- display helpers for cached rows ---------- */
export const WP_STATUS_LABELS = { paid: "Paid", pending: "Awaiting payment", blocked: "Blocked", cancelled: "Cancelled", expired: "Expired", error: "Error" };
export const stripeUrl = (payment) => {
  if (!payment?.stripePaymentIntent) return payment?.stripeUrl || null;
  return payment.stripeUrl || `https://dashboard.stripe.com/${payment.mode === "test" ? "test/" : ""}payments/${payment.stripePaymentIntent}`;
};
export const customerName = (c) => [c?.firstName, c?.lastName].filter(Boolean).join(" ");
