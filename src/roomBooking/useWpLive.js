import { useCallback, useEffect, useRef, useState } from "react";
import { hl, pad, roomLabel, wpApi } from "./roomBooking";

// Live booked hours straight from WordPress GET /availability (public, no token).
// This is real time and works even before the CRM's webhook/sync is configured;
// it has no customer details, so the CRM cache (/room-bookings) is used to add them.

const months = (fromYmd, toYmd) => {
  const out = [];
  let [y, m] = fromYmd.split("-").map(Number);
  const [ty, tm] = toYmd.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${pad(m)}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
};

/** Merge booked start hours into ranges: [9,10,13] -> [[9,11],[13,14]]. */
export function hourRanges(hours) {
  const sorted = [...new Set(hours.map(Number))].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((h) => {
    const last = out[out.length - 1];
    if (last && last[1] === h) last[1] = h + 1; else out.push([h, h + 1]);
  });
  return out;
}

/**
 * Booked hours for every room over a date range, refreshed every `refreshMs` and on focus.
 * Returns { blocks: [{ room, date, start, end }], loading, error, reload, updatedAt }.
 */
export function useWpLiveBlocks(config, fromYmd, toYmd, { refreshMs = 60000 } = {}) {
  const [state, setState] = useState({ blocks: [], loading: false, error: "", updatedAt: null });
  const seq = useRef(0);
  const key = config ? `${config.rest}|${fromYmd}|${toYmd}` : "";

  const load = useCallback(async () => {
    if (!config || !fromYmd || !toYmd) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const jobs = [];
      config.rooms.forEach((r) => months(fromYmd, toYmd).forEach((mo) =>
        jobs.push(wpApi(config, `availability?room=${r.key}&month=${mo}`).then((j) => ({ room: r.key, booked: j.booked || {} })))));
      const results = await Promise.all(jobs);
      if (id !== seq.current) return;
      const blocks = [];
      results.forEach(({ room, booked }) => Object.entries(booked).forEach(([date, hs]) => {
        if (date < fromYmd || date > toYmd) return;
        hourRanges(hs || []).forEach(([start, end]) => blocks.push({ room, date, start, end }));
      }));
      setState({ blocks, loading: false, error: "", updatedAt: new Date() });
    } catch (e) {
      if (id === seq.current) setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    if (!refreshMs) return undefined;
    const refresh = () => document.visibilityState === "visible" && load();
    const t = setInterval(refresh, refreshMs);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(t); window.removeEventListener("focus", refresh); };
  }, [load, refreshMs]);

  return { ...state, reload: load };
}

/** ISO instants for a HK date + hour (HK is UTC+8 all year). */
export const hkIso = (date, hour) => new Date(`${date}T${hl(hour)}:00+08:00`).toISOString();

/** Calendar items for live blocks not already covered by a cached WordPress row. */
export function liveCalendarItems(config, blocks, cachedItems) {
  const covered = (b) => {
    const s = new Date(hkIso(b.date, b.start)).getTime(), e = new Date(hkIso(b.date, b.end)).getTime();
    return cachedItems.some((i) => i.externalRef && i.wpRoomKey === b.room && !["cancelled", "expired", "error"].includes(i.wpStatus) &&
      new Date(i.startAt).getTime() < e && new Date(i.endAt).getTime() > s);
  };
  return blocks.filter((b) => !covered(b)).map((b) => {
    const room = config.rooms.find((r) => r.key === b.room);
    return {
      id: `wp-live-${b.room}-${b.date}-${b.start}`,
      kind: "booking", category: "confirmed", status: "confirmed", rawStatus: "confirmed",
      wpLive: true, wpRoomKey: b.room, wpStatus: "live",
      title: "Booked on website", subtitle: roomLabel(room),
      resourceName: roomLabel(room), bookingType: "meeting_room",
      startAt: hkIso(b.date, b.start), endAt: hkIso(b.date, b.end), live: b,
    };
  });
}
