import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
const blank = {
  name: "",
  type: "",
  url: "",
  mimeType: "",
  size: "",
  contactId: "",
  companyId: "",
  dealId: "",
  agreementId: "",
};
export default function Documents() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]),
    [contacts, setContacts] = useState([]),
    [companies, setCompanies] = useState([]),
    [deals, setDeals] = useState([]),
    [agreements, setAgreements] = useState([]),
    [modal, setModal] = useState(false),
    [form, setForm] = useState(blank),
    [error, setError] = useState("");
  async function load() {
    try {
      const [r, c, co, d, a] = await Promise.all([
        request("/documents", {
          query: { limit: 100, sort: "createdAt", order: "desc" },
        }),
        request("/contacts", { query: { limit: 100 } }),
        request("/companies", { query: { limit: 100 } }),
        request("/deals", { query: { limit: 100 } }),
        request("/agreements", { query: { limit: 100 } }),
      ]);
      setRows(r.data?.items || []);
      setContacts(c.data?.items || []);
      setCompanies(co.data?.items || []);
      setDeals(d.data?.items || []);
      setAgreements(a.data?.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create() {
    try {
      await request("/documents", {
        method: "POST",
        body: {
          ...form,
          size: form.size ? Number(form.size) : undefined,
          contactId: form.contactId || undefined,
          companyId: form.companyId || undefined,
          dealId: form.dealId || undefined,
          agreementId: form.agreementId || undefined,
        },
      });
      setModal(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(id) {
    if (!confirm("Delete document metadata?")) return;
    try {
      await request(`/documents/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Documents"
      kicker="CRM document and attachment metadata"
      actions={
        <button className="btn primary" onClick={() => setModal(true)}>
          Add document
        </button>
      }
    >
      {error && <div className="notice error">{error}</div>}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Type</th>
              <th>Linked to</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d._id}>
                <td>
                  <b>{d.name}</b>
                  <span>{d.url || d.storageKey || "No location"}</span>
                </td>
                <td>{d.type || d.mimeType || "—"}</td>
                <td>
                  {d.contactId
                    ? `${d.contactId.firstName || ""} ${d.contactId.lastName || ""}`
                    : d.companyId?.name || d.dealId?.title || "—"}
                </td>
                <td>{new Date(d.createdAt).toLocaleString()}</td>
                <td>
                  <button className="btn ghost" onClick={() => remove(d._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text="No documents." />}
      </section>
      {modal && (
        <Modal
          title="Add document"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={create}>
                Save
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
              Type
              <input
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              />
            </label>
            <label>
              URL
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </label>
            <label>
              MIME type
              <input
                value={form.mimeType}
                onChange={(e) => setForm({ ...form, mimeType: e.target.value })}
              />
            </label>
            <label>
              Size (bytes)
              <input
                type="number"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
              />
            </label>
          </div>
          <div className="form-grid">
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
            <label>
              Agreement
              <select
                value={form.agreementId}
                onChange={(e) =>
                  setForm({ ...form, agreementId: e.target.value })
                }
              >
                <option value="">None</option>
                {agreements.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}
