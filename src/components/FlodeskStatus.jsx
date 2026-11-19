import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../utils/permissions";
import Badge from "./Badge";

// Flodesk newsletter connection (GET /integrations/flodesk, admin). The API key lives in the
// backend's FLODESK_API_KEY setting on Render; it's never entered or shown in the CRM.
export default function FlodeskStatus() {
  const { request } = useAuth();
  const isAdmin = usePermissions().can("workspace.manage");
  const [state, setState] = useState({ data: null, loading: true, error: "" });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try { setState({ data: (await request("/integrations/flodesk")).data, loading: false, error: "" }); }
    catch (e) { setState({ data: null, loading: false, error: e.status === 404 ? "" : e.message }); }
  }, [request]);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);
  if (!isAdmin || (!state.loading && !state.data && !state.error)) return null;

  const d = state.data;
  const missing = (d?.mapping || []).filter((m) => m.found === false);
  return (
    <section className="panel rp-card fd-status" aria-labelledby="fd-title">
      <div className="rp-bd-head">
        <h3 id="fd-title">Flodesk (newsletter)</h3>
        <button type="button" className="btn ghost small" onClick={load} disabled={state.loading}>{state.loading ? "Checking…" : "Check again"}</button>
      </div>
      {state.error && <p className="lk-warn-text">{state.error}</p>}
      {d && <>
        <p>
          <Badge tone={d.connected ? "good" : "warn"}>{d.connected ? "Connected" : "Not connected"}</Badge>{" "}
          {d.connected
            ? <>Forms with "Add to the Flodesk newsletter" add people who agreed to emails.{d.lastSuccessAt && <> Last added {new Date(d.lastSuccessAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</>}</>
            : "The Flodesk API key isn't set on the server (FLODESK_API_KEY on Render), or Flodesk rejected it."}
        </p>
        {d.lastError && <p className="lk-warn-text">Last error: {d.lastError}</p>}
        {missing.length > 0 && <div className="notice"><b>Segments not found</b><span>{missing.map((m) => `"${m.segment}"`).join(", ")} {missing.length === 1 ? "doesn't" : "don't"} exist in Flodesk with that exact name. Rename the segment in Flodesk, or people with that interest won't be added to it.</span></div>}
        {(d.mapping || []).length > 0 && (
          <details>
            <summary>Which interest goes to which segment</summary>
            <table className="lk-table">
              <thead><tr><th>Interest in the CRM</th><th>Flodesk segment</th><th>Found</th></tr></thead>
              <tbody>
                {d.mapping.map((m) => (
                  <tr key={`${m.interest}-${m.segment}`}>
                    <td>{m.interest}</td><td>{m.segment}</td>
                    <td>{m.found === null ? "—" : m.found ? "Yes" : <span className="lk-warn-text">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </>}
    </section>
  );
}
