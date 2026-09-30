import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
export default function Payments() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]),
    [invoices, setInvoices] = useState([]),
    [modal, setModal] = useState(false),
    [form, setForm] = useState({
      invoiceId: "",
      amount: 0,
      provider: "stripe",
      externalId: "",
      status: "succeeded",
    }),
    [error, setError] = useState("");
  async function load() {
    try {
      const [p, i] = await Promise.all([
        request("/payments", {
          query: { limit: 100, sort: "createdAt", order: "desc" },
        }),
        request("/invoices", { query: { limit: 100 } }),
      ]);
      setRows(p.data?.items || []);
      setInvoices(i.data?.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create() {
    try {
      await request("/payments", {
        method: "POST",
        body: { ...form, amount: Number(form.amount) || 0 },
      });
      setModal(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Payments"
      kicker="Payment records linked to invoices"
      actions={
        <button className="btn primary" onClick={() => setModal(true)}>
          Record payment
        </button>
      }
    >
      {error && <div className="notice error">{error}</div>}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Provider</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id}>
                <td>
                  {p.invoiceId?.invoiceNumber ||
                    p.invoiceId?._id?.slice(-8) ||
                    "—"}
                </td>
                <td>{p.provider}</td>
                <td>
                  {p.currency || "HKD"} {Number(p.amount || 0).toLocaleString()}
                </td>
                <td>
                  <Badge tone={p.status === "failed" ? "warn" : ""}>
                    {p.status}
                  </Badge>
                </td>
                <td>
                  {p.paidAt ? new Date(p.paidAt).toLocaleString() : "—"}{" "}
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      try {
                        await request(`/payments/${p._id}`, {
                          method: "PATCH",
                          body: {
                            status:
                              p.status === "succeeded"
                                ? "refunded"
                                : "succeeded",
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
                      if (!confirm("Delete payment?")) return;
                      try {
                        await request(`/payments/${p._id}`, {
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
        {rows.length === 0 && <Empty text="No payment records." />}
      </section>
      {modal && (
        <Modal
          title="Record payment"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={create}>
                Save payment
              </button>
            </>
          }
        >
          <label>
            Invoice
            <select
              value={form.invoiceId}
              onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
            >
              <option value="">Select invoice</option>
              {invoices.map((i) => (
                <option key={i._id} value={i._id}>
                  {i.invoiceNumber || i._id.slice(-8)} · {i.total}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Amount
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </label>
            <label>
              Provider
              <input
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
              />
            </label>
            <label>
              External ID
              <input
                value={form.externalId}
                onChange={(e) =>
                  setForm({ ...form, externalId: e.target.value })
                }
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {["pending", "succeeded", "failed", "refunded"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}
