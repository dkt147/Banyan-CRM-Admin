import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
export default function Members() {
  const { request, user } = useAuth();
  const [rows, setRows] = useState([]),
    [modal, setModal] = useState(false),
    [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      role: "operator",
      phone: "",
      jobTitle: "",
    }),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await request("/members", { query: { status: "active" } });
      setRows(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create() {
    try {
      await request("/members", { method: "POST", body: form });
      setModal(false);
      setForm({
        name: "",
        email: "",
        password: "",
        role: "operator",
        phone: "",
        jobTitle: "",
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function deactivate(id) {
    try {
      await request(`/members/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Members"
      kicker="Workspace team access"
      actions={
        user?.role !== "operator" && (
          <button className="btn primary" onClick={() => setModal(true)}>
            Add member
          </button>
        )
      }
    >
      {error && (
        <div className="notice error">
          <b>Members</b>
          <span>{error}</span>
        </div>
      )}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Job title</th>
              <th>Last login</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m._id}>
                <td>
                  <b>{m.name}</b>
                  <span>{m.email}</span>
                </td>
                <td>
                  <Badge>{m.role}</Badge>
                </td>
                <td>{m.jobTitle || "—"}</td>
                <td>
                  {m.lastLoginAt
                    ? new Date(m.lastLoginAt).toLocaleString()
                    : "Never"}
                </td>
                <td>{m.isActive ? "Active" : "Inactive"}</td>
                <td>
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      const role = prompt(
                        "Role (admin, manager, operator)",
                        m.role,
                      );
                      if (!role) return;
                      try {
                        await request(`/members/${m._id}`, {
                          method: "PATCH",
                          body: { role },
                        });
                        load();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Edit role
                  </button>{" "}
                  {m._id !== user?._id && user?.role === "admin" && (
                    <button
                      className="btn ghost"
                      onClick={() => deactivate(m._id)}
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text="No members found." />}
      </section>
      {modal && (
        <Modal
          title="Add member"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={create}>
                Create member
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label>
              Role
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option>operator</option>
                <option>manager</option>
                <option>admin</option>
              </select>
            </label>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Job title
              <input
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              />
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}
