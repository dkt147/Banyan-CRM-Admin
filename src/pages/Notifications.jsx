import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";
export default function Notifications() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await request("/notifications", { query: { limit: 100 } });
      setRows(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function read(id) {
    try {
      await request(`/notifications/${id}/read`, { method: "PATCH" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function all() {
    try {
      await request("/notifications/read-all", { method: "PATCH" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Notifications"
      kicker="Workspace alerts"
      actions={
        <button className="btn ghost" onClick={all}>
          Mark all read
        </button>
      }
    >
      {error && <div className="notice error">{error}</div>}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Notification</th>
              <th>Channel</th>
              <th>Created</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n._id}>
                <td>
                  <b>{n.title}</b>
                  <span>{n.body || ""}</span>
                </td>
                <td>{n.channel}</td>
                <td>{new Date(n.createdAt).toLocaleString()}</td>
                <td>
                  <Badge>{n.readAt ? "read" : "unread"}</Badge>
                </td>
                <td>
                  {!n.readAt && (
                    <button className="btn ghost" onClick={() => read(n._id)}>
                      Mark read
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text="No notifications." />}
      </section>
    </Page>
  );
}
