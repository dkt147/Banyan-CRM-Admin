import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import { useAuth } from "../auth/AuthContext";
export default function AuditLogs() {
  const { request, user } = useAuth();
  const [rows, setRows] = useState([]),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await request("/audit-logs", { query: { limit: 200 } });
      setRows(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  if (!["admin", "manager"].includes(user?.role))
    return (
      <Page title="Audit logs" kicker="Restricted workspace history">
        <div className="notice error">
          Only admins and managers can view audit logs.
        </div>
      </Page>
    );
  return (
    <Page title="Audit logs" kicker="Workspace change history">
      {error && <div className="notice error">{error}</div>}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x._id}>
                <td>{new Date(x.createdAt).toLocaleString()}</td>
                <td>{x.actorId?.name || "System"}</td>
                <td>
                  <b>{x.action}</b>
                </td>
                <td>
                  {x.entityType}
                  {x.entityId ? ` · ${String(x.entityId).slice(-8)}` : ""}
                </td>
                <td>{x.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text="No audit entries." />}
      </section>
    </Page>
  );
}
