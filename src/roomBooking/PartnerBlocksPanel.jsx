import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import { FALLBACK_CONFIG, errorCode, hl, longDate, timeAgo } from "./roomBooking";

// Partner meetings in the room Google Calendars → blocked time in WordPress.
// GET /room-bookings/partner-blocks (status), GET …/preview (dry run), POST …/sync (admin).
// The server also runs this every 10 minutes while the setting is on.

const ERROR_TEXT = {
  PARTNER_BLOCKS_DISABLED: "Turn on \"Block partner events in WordPress\" in the Google Calendar settings above, save, then sync.",
  INTEGRATION_NOT_CONNECTED: "Google Calendar isn't connected. Connect it on Settings → Integrations → Google.",
  WP_BLOCKS_UNSUPPORTED: "The WordPress plugin on the website doesn't support partner blocks yet.",
};
const roomName = (key) => {
  const r = FALLBACK_CONFIG.rooms.find((x) => x.key === key);
  return r ? `${r.name} (${r.capacity})` : key;
};
const slot = (x) => `${x.date ? longDate(x.date) : ""}${Number.isFinite(Number(x.start)) ? `, ${hl(Number(x.start))}–${hl(Number(x.start) + Number(x.hours || 1))}` : ""}`;

export default function PartnerBlocksPanel({ enabledHint, onOpenRef }) {
  const { request } = useAuth();
  const canManage = usePermissions().can("workspace.manage");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try { const r = await request("/room-bookings/partner-blocks"); setStatus(r.data || {}); setError(""); }
    catch (e) { setStatus(null); setError([404, 405].includes(e.status) ? "" : e.message); }
  }, [request]);
  useEffect(() => { load(); }, [load, enabledHint]);

  const failText = (e) => ERROR_TEXT[errorCode(e)] || e.message;
  async function runPreview() {
    setBusy("preview"); setResult(null);
    try { const r = await request("/room-bookings/partner-blocks/preview"); setPreview(r.data || {}); }
    catch (e) { setPreview({ error: failText(e) }); }
    finally { setBusy(""); }
  }
  async function syncNow() {
    setBusy("sync"); setPreview(null);
    try { const r = await request("/room-bookings/partner-blocks/sync", { method: "POST", body: {} }); setResult(r.data || {}); await load(); }
    catch (e) { setResult({ error: failText(e) }); }
    finally { setBusy(""); }
  }

  if (!status && !error) return null;   // endpoint not deployed, or still loading

  // Partner meetings over a paid booking or hold: from the last run, or from the latest preview/sync.
  const latest = result && !result.error ? result : preview && !preview.error ? preview : null;
  const clashes = latest?.clashes || status?.clashes || [];
  const conflicts = (result && !result.error ? result.blockConflicts : null) || status?.blockConflicts || [];
  const problems = clashes.length + conflicts.length;
  const RefLink = ({ refId }) => <button type="button" className="lk-primary rb-ref" onClick={() => onOpenRef?.(refId)}>{refId}</button>;

  return (
    <section className={`panel rb-partner${problems ? " has-clash" : ""}`}>
      <div className="rb-partner-head">
        <div>
          <h3>Partner meetings → website blocks</h3>
          <p className="lk-muted">
            {status?.enabled ? "On" : "Off"}
            {status && ` · ${status.blocks || 0} block${status.blocks === 1 ? "" : "s"} in WordPress`}
            {status?.lastRun ? ` · Last checked ${timeAgo(status.lastRun)}` : status?.enabled ? " · Not run yet" : ""}
            {status?.supported === false && " · Not supported by the website plugin"}
          </p>
        </div>
        <div className="rb-partner-actions">
          <button type="button" className="btn ghost" onClick={runPreview} disabled={Boolean(busy)}>{busy === "preview" ? "Checking…" : "Preview"}</button>
          {canManage && <button type="button" className="btn primary" onClick={syncNow} disabled={Boolean(busy)}>{busy === "sync" ? "Syncing…" : "Sync now"}</button>}
        </div>
      </div>
      {error && <div className="notice error"><b>Partner blocks</b><span>{error}</span></div>}
      {status?.lastError && <div className="notice error"><b>Last run failed</b><span>{status.lastError}</span></div>}
      {!status?.enabled && status && <p className="lk-muted">When this is on, meetings your partner adds in a room's Google Calendar block that time on the website within about 10 minutes. Turn it on in the Google Calendar settings above.</p>}

      {problems > 0 && (
        <div className="rb-clashes" role="alert">
          <b>{problems} double booking{problems === 1 ? "" : "s"} to fix</b>
          <p>A partner meeting overlaps a website booking. Someone needs to move one of them: change the partner meeting in Google Calendar, or reschedule the booking in WP Admin → Room Bookings.</p>
          <ul>
            {clashes.map((c) => (
              <li key={`c-${c.ref}-${c.partnerEventId}-${c.date}`}>
                <RefLink refId={c.ref} /> ({c.status === "pending" ? "awaiting payment" : c.status}) · {roomName(c.room)} · {c.date ? longDate(c.date) : ""} · overlaps <i>{String(c.partnerEvent || "").replace(/^Partner:\s*/, "")}</i>
              </li>
            ))}
            {conflicts.map((c, i) => (
              <li key={`b-${c.key || i}`}>
                {roomName(c.room)} · {slot(c)} · <i>{String(c.reason || "").replace(/^Partner:\s*/, "")}</i> couldn't be blocked: {c.message}
                {(c.conflicts || []).length > 0 && <> ({c.conflicts.map((ref, j) => <React.Fragment key={ref}>{j > 0 && ", "}<RefLink refId={ref} /></React.Fragment>)})</>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && <ChangeList title="Preview (nothing written)" data={preview} />}
      {result && <ChangeList title="Sync result" data={result} />}
    </section>
  );
}

function ChangeList({ title, data }) {
  if (data.error) return <div className="notice error"><b>{title}</b><span>{data.error}</span></div>;
  const create = data.create || [], remove = data.remove || [], skipped = data.skipped || [], errors = data.errors || [];
  return (
    <div className="rb-partner-changes">
      <h4>{title}</h4>
      <p className="lk-muted">{create.length} to block · {remove.length} to unblock · {data.unchanged || 0} unchanged</p>
      {create.length > 0 && <ul>{create.map((c, i) => <li key={c.key || i}>Block {roomName(c.room)} · {slot(c)} · {String(c.reason || "").replace(/^Partner:\s*/, "")}</li>)}</ul>}
      {remove.length > 0 && <ul>{remove.map((c, i) => <li key={c.key || i}>Unblock {roomName(c.room)} · {slot(c)}{c.ref ? ` (${c.ref})` : ""}</li>)}</ul>}
      {skipped.map((s) => <p key={s.calendarId} className="lk-muted">Skipped {s.calendarId}: {s.reason}</p>)}
      {errors.map((e, i) => <div key={e.key || i} className="notice error"><b>Not applied</b><span>{e.message}</span></div>)}
    </div>
  );
}
