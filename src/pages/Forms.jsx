import React, { useCallback, useEffect, useState } from "react";
import { Page } from "./Dashboard";
import Badge from "../components/Badge";
import { DataState } from "../components/ListKit";
import { useAuth } from "../auth/AuthContext";

const TYPES = { enquiry: "Website enquiry", contact: "Contact details", walk_in: "Walk-in", newsletter: "Newsletter sign-up" };

// Lists configured intake forms (GET /forms). Creating and editing forms, the public
// submission endpoint and the walk-in screen are delivered with Forms (brief 6.5, N7).
export default function Forms() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows((await request("/forms", { query: { limit: 100 } })).data?.items || []); }
    catch (e) { setError(e.message || "Could not load forms."); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { load(); }, [load]);

  return (
    <Page title="Forms" kicker="Website, walk-in and newsletter intake">
      <section className="panel lk-table-wrap">
        <DataState loading={loading} error={error} onRetry={load} empty={rows.length === 0}
          emptyText="No forms are configured yet. Form setup (enquiry, contact details, walk-in and newsletter) is part of the Forms delivery.">
          <table className="lk-table">
            <thead><tr><th>Form</th><th>Type</th><th>Slug</th><th>Tags applied</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f._id}>
                  <td><b>{f.name}</b>{f.description && <small>{f.description}</small>}</td>
                  <td>{TYPES[f.type] || f.type}</td>
                  <td><code>{f.slug}</code></td>
                  <td>{(f.tagsToApply || []).join(", ") || "—"}</td>
                  <td><Badge tone={f.isActive ? "good" : ""}>{f.isActive ? "Active" : "Inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </section>
    </Page>
  );
}
