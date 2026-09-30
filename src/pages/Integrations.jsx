import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
const providers = [
  "gmail",
  "whatsapp",
  "google_calendar",
  "xero",
  "stripe",
  "docusign",
  "wordpress",
  "access_control",
];
export default function Integrations() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]),
    [modal, setModal] = useState(false),
    [form, setForm] = useState({
      provider: "gmail",
      status: "pending",
      accountName: "",
      externalAccountId: "",
      config: {},
    }),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await request("/integrations", { query: { limit: 100 } });
      setRows(r.data?.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function open(i) {
    setForm(
      i
        ? { ...form, ...i, config: i.config || {} }
        : {
            provider: "gmail",
            status: "pending",
            accountName: "",
            externalAccountId: "",
            config: {},
          },
    );
    setModal(i || "new");
  }
  async function save() {
    try {
      const body = {
        provider: form.provider,
        status: form.status,
        accountName: form.accountName,
        externalAccountId: form.externalAccountId,
        config: form.config || {},
      };
      await request(
        modal && modal._id ? `/integrations/${modal._id}` : "/integrations",
        { method: modal && modal._id ? "PATCH" : "POST", body },
      );
      setModal(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(id) {
    if (!confirm("Delete integration record?")) return;
    try {
      await request(`/integrations/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Integrations"
      kicker="Provider connection records"
      actions={
        <button className="btn primary" onClick={() => open()}>
          Add connection
        </button>
      }
    >
      {error && <div className="notice error">{error}</div>}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Account</th>
              <th>Status</th>
              <th>Last sync</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i._id}>
                <td>
                  <b>{i.provider}</b>
                </td>
                <td>{i.accountName || i.externalAccountId || "—"}</td>
                <td>
                  <Badge tone={i.status === "connected" ? "" : "warn"}>
                    {i.status}
                  </Badge>
                </td>
                <td>
                  {i.lastSyncedAt
                    ? new Date(i.lastSyncedAt).toLocaleString()
                    : "Never"}
                </td>
                <td>
                  <button className="btn ghost" onClick={() => open(i)}>
                    Edit
                  </button>{" "}
                  <button className="btn ghost" onClick={() => remove(i._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text="No integrations configured." />}
      </section>
      {modal && (
        <Modal
          title={modal._id ? "Edit integration" : "Add integration"}
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={save}>
                Save
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Provider
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
              >
                {providers.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {["connected", "disconnected", "error", "pending"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Account name
              <input
                value={form.accountName || ""}
                onChange={(e) =>
                  setForm({ ...form, accountName: e.target.value })
                }
              />
            </label>
            <label>
              External account ID
              <input
                value={form.externalAccountId || ""}
                onChange={(e) =>
                  setForm({ ...form, externalAccountId: e.target.value })
                }
              />
            </label>
          </div>
          <p className="muted">
            Provider credentials are intentionally not entered here; this
            backend stores the connection boundary for later provider-specific
            integration.
          </p>
        </Modal>
      )}
    </Page>
  );
}
