import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
export default function Invoices() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]),
    [modal, setModal] = useState(false),
    [form, setForm] = useState({
      invoiceNumber: "",
      description: "",
      subtotal: 0,
      tax: 0,
      total: 0,
      currency: "HKD",
      dueAt: "",
      status: "awaiting",
      provider: "xero",
    }),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await request("/invoices", {
        query: { limit: 100, sort: "createdAt", order: "desc" },
      });
      setRows(r.data?.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create() {
    try {
      await request("/invoices", {
        method: "POST",
        body: {
          ...form,
          subtotal: Number(form.subtotal) || 0,
          tax: Number(form.tax) || 0,
          total: Number(form.total) || 0,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        },
      });
      setModal(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function pay(id, total) {
    try {
      await request(`/invoices/${id}/pay`, {
        method: "PATCH",
        body: { amount: total, provider: "stripe" },
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function overdue() {
    try {
      await request("/invoices/mark-overdue", { method: "POST" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Invoices"
      kicker="Xero-ready invoice records"
      actions={
        <>
          <button className="btn ghost" onClick={overdue}>
            Mark overdue
          </button>
          <button className="btn primary" onClick={() => setModal(true)}>
            Create invoice
          </button>
        </>
      }
    >
      {error && (
        <div className="notice error">
          <b>Invoices</b>
          <span>{error}</span>
        </div>
      )}
      <div className="metrics five">
        <MetricX label="Total" value={rows.length} />
        <MetricX
          label="Awaiting"
          value={rows.filter((x) => x.status === "awaiting").length}
        />
        <MetricX
          label="Overdue"
          value={rows.filter((x) => x.status === "overdue").length}
        />
        <MetricX
          label="Paid"
          value={rows.filter((x) => x.status === "paid").length}
        />
      </div>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Description</th>
              <th>Total</th>
              <th>Status</th>
              <th>Due / action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>
                  <b>{r.invoiceNumber || r._id.slice(-8)}</b>
                </td>
                <td>{r.description || "—"}</td>
                <td>HK${Number(r.total || 0).toLocaleString()}</td>
                <td>
                  <Badge tone={r.status === "overdue" ? "warn" : ""}>
                    {r.status}
                  </Badge>
                </td>
                <td>
                  {r.status !== "paid" ? (
                    <button
                      className="btn ghost"
                      onClick={() => pay(r._id, r.total)}
                    >
                      Mark paid
                    </button>
                  ) : r.paidAt ? (
                    new Date(r.paidAt).toLocaleDateString()
                  ) : (
                    "Paid"
                  )}{" "}
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      try {
                        await request(`/invoices/${r._id}`, {
                          method: "PATCH",
                          body: {
                            description: r.description || "",
                            status: r.status,
                          },
                        });
                        load();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Update
                  </button>{" "}
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      if (!confirm("Delete invoice?")) return;
                      try {
                        await request(`/invoices/${r._id}`, {
                          method: "DELETE",
                        });
                        load();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text="No invoices." />}
      </section>
      {modal && (
        <Modal
          title="Create invoice"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={create}>
                Create invoice
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Invoice number
              <input
                value={form.invoiceNumber}
                onChange={(e) =>
                  setForm({ ...form, invoiceNumber: e.target.value })
                }
              />
            </label>
            <label>
              Total
              <input
                type="number"
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
              />
            </label>
            <label>
              Due date
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
        </Modal>
      )}
    </Page>
  );
}
function MetricX({ label, value }) {
  return (
    <div className="metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
