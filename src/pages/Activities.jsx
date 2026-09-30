import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
const blank = {
  type: "note",
  subject: "",
  body: "",
  contactId: "",
  companyId: "",
  dealId: "",
};
export default function Activities() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]),
    [contacts, setContacts] = useState([]),
    [companies, setCompanies] = useState([]),
    [deals, setDeals] = useState([]),
    [modal, setModal] = useState(false),
    [form, setForm] = useState(blank),
    [error, setError] = useState("");
  async function load() {
    try {
      const [r, c, co, d] = await Promise.all([
        request("/activities", { query: { limit: 100 } }),
        request("/contacts", { query: { limit: 100 } }),
        request("/companies", { query: { limit: 100 } }),
        request("/deals", { query: { limit: 100 } }),
      ]);
      setRows(r.data || r.data?.items || []);
      setContacts(c.data?.items || []);
      setCompanies(co.data?.items || []);
      setDeals(d.data?.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create() {
    try {
      await request("/activities", {
        method: "POST",
        body: {
          ...form,
          contactId: form.contactId || null,
          companyId: form.companyId || null,
          dealId: form.dealId || null,
        },
      });
      setModal(false);
      setForm(blank);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(id) {
    if (!confirm("Delete activity?")) return;
    try {
      await request(`/activities/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Activities"
      kicker="CRM interaction timeline"
      actions={
        <button className="btn primary" onClick={() => setModal(true)}>
          Log activity
        </button>
      }
    >
      {error && <div className="notice error">{error}</div>}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Subject</th>
              <th>Contact</th>
              <th>Deal</th>
              <th>Occurred</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a._id}>
                <td>
                  <Badge>{a.type}</Badge>
                </td>
                <td>
                  <b>{a.subject || "Activity"}</b>
                  <span>{a.body || ""}</span>
                </td>
                <td>
                  {a.contactId?.firstName
                    ? `${a.contactId.firstName} ${a.contactId.lastName || ""}`
                    : "—"}
                </td>
                <td>{a.dealId?.title || "—"}</td>
                <td>
                  {a.occurredAt
                    ? new Date(a.occurredAt).toLocaleString()
                    : new Date(a.createdAt).toLocaleString()}
                </td>
                <td>
                  <button className="btn ghost" onClick={() => remove(a._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text="No activities yet." />}
      </section>
      {modal && (
        <Modal
          title="Log activity"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={create}>
                Log
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Type
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {[
                  "note",
                  "call",
                  "email",
                  "whatsapp",
                  "meeting",
                  "stage_change",
                  "deal_created",
                  "task_created",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Contact
              <select
                value={form.contactId}
                onChange={(e) =>
                  setForm({ ...form, contactId: e.target.value })
                }
              >
                <option value="">None</option>
                {contacts.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.firstName} {x.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Company
              <select
                value={form.companyId}
                onChange={(e) =>
                  setForm({ ...form, companyId: e.target.value })
                }
              >
                <option value="">None</option>
                {companies.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Deal
              <select
                value={form.dealId}
                onChange={(e) => setForm({ ...form, dealId: e.target.value })}
              >
                <option value="">None</option>
                {deals.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Subject
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </label>
          <label>
            Body
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
        </Modal>
      )}
    </Page>
  );
}
