import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const EMPTY_FORM = {
  invoiceId: "",
  provider: "stripe",
  externalId: "",
  amount: "",
  currency: "HKD",
  status: "pending",
  paidAt: "",
};

const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "refunded"];

const PAYMENT_PROVIDERS = ["stripe", "xero"];

function toDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);

  return local.toISOString().slice(0, 16);
}

function toISOStringOrUndefined(value) {
  if (!value) return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function getItems(response) {
  return response?.data?.items || [];
}

function getInvoiceId(invoiceId) {
  if (!invoiceId) return "";

  return typeof invoiceId === "object" ? invoiceId._id || "" : invoiceId;
}

function getInvoiceLabel(invoice) {
  if (!invoice) return "Unknown invoice";

  return invoice.invoiceNumber || invoice._id?.slice(-8) || invoice._id;
}

function MetricX({ label, value }) {
  return (
    <div className="metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function Payments() {
  const { request } = useAuth();

  const [rows, setRows] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(editingId);

  async function loadPayments() {
    try {
      setLoading(true);

      const response = await request("/payments", {
        query: {
          page: 1,
          limit: 100,
          sort: "createdAt",
          order: "desc",
        },
      });

      setRows(getItems(response));
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoices() {
    try {
      const response = await request("/invoices", {
        query: {
          page: 1,
          limit: 100,
          sort: "dueAt",
          order: "asc",
        },
      });

      setInvoices(getItems(response));
    } catch (e) {
      setError(e.message || "Failed to load invoices.");
    }
  }

  async function load() {
    await Promise.all([loadPayments(), loadInvoices()]);
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setError("");
    setModal(true);
  }

  function openEdit(payment) {
    setEditingId(payment._id);

    setForm({
      invoiceId: getInvoiceId(payment.invoiceId),

      provider: payment.provider || "stripe",

      externalId: payment.externalId || "",

      amount:
        payment.amount === undefined || payment.amount === null
          ? ""
          : payment.amount,

      currency: payment.currency || "HKD",

      status: payment.status || "pending",

      paidAt: toDateTimeLocal(payment.paidAt),
    });

    setFormError("");
    setError("");
    setModal(true);
  }

  function closeModal() {
    if (saving) return;

    setModal(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
  }

  function validateForm() {
    if (!form.invoiceId) {
      return "Please select an invoice.";
    }

    if (!form.provider.trim()) {
      return "Provider is required.";
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return "Amount must be greater than 0.";
    }

    if (!form.currency.trim()) {
      return "Currency is required.";
    }

    if (!PAYMENT_STATUSES.includes(form.status)) {
      return "Invalid payment status.";
    }

    if (form.status === "succeeded" && !form.paidAt) {
      return "Paid date is required for a succeeded payment.";
    }

    if (form.paidAt) {
      const date = new Date(form.paidAt);

      if (Number.isNaN(date.getTime())) {
        return "Paid date is invalid.";
      }
    }

    return "";
  }

  function buildPayload() {
    return {
      invoiceId: form.invoiceId,

      provider: form.provider.trim(),

      externalId: form.externalId.trim() || undefined,

      amount: Number(form.amount) || 0,

      currency: form.currency.trim().toUpperCase(),

      status: form.status,

      paidAt: toISOStringOrUndefined(form.paidAt),

      metadata: {},
    };
  }

  async function savePayment() {
    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const payload = buildPayload();

      if (isEditing) {
        await request(`/payments/${editingId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await request("/payments", {
          method: "POST",
          body: payload,
        });
      }

      closeModal();

      await Promise.all([loadPayments(), loadInvoices()]);
    } catch (e) {
      setFormError(e.message || "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(payment) {
    if (!window.confirm("Delete this payment record?")) {
      return;
    }

    try {
      setError("");

      await request(`/payments/${payment._id}`, {
        method: "DELETE",
      });

      await loadPayments();
    } catch (e) {
      setError(e.message || "Failed to delete payment.");
    }
  }

  function getInvoiceFromPayment(payment) {
    if (payment.invoiceId && typeof payment.invoiceId === "object") {
      return payment.invoiceId;
    }

    const invoiceId = getInvoiceId(payment.invoiceId);

    return invoices.find((invoice) => invoice._id === invoiceId);
  }

  const succeededCount = rows.filter(
    (payment) => payment.status === "succeeded",
  ).length;

  const pendingCount = rows.filter(
    (payment) => payment.status === "pending",
  ).length;

  const failedCount = rows.filter(
    (payment) => payment.status === "failed",
  ).length;

  const refundedCount = rows.filter(
    (payment) => payment.status === "refunded",
  ).length;

  return (
    <Page
      title="Payments"
      kicker="Payment records linked to invoices"
      actions={
        <button className="btn primary" onClick={openCreate}>
          Record payment
        </button>
      }
    >
      {error && (
        <div className="notice error">
          <b>Payments</b>
          <span>{error}</span>
        </div>
      )}

      <div className="metrics five">
        <MetricX label="Total" value={rows.length} />

        <MetricX label="Succeeded" value={succeededCount} />

        <MetricX label="Pending" value={pendingCount} />

        <MetricX label="Failed" value={failedCount} />

        <MetricX label="Refunded" value={refundedCount} />
      </div>

      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Provider</th>
              <th>External ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Paid</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((payment) => {
              const invoice = getInvoiceFromPayment(payment);

              return (
                <tr key={payment._id}>
                  <td>
                    <b>{getInvoiceLabel(invoice)}</b>
                  </td>

                  <td>{payment.provider || "—"}</td>

                  <td>{payment.externalId || "—"}</td>

                  <td>
                    {payment.currency || "HKD"}{" "}
                    {Number(payment.amount || 0).toLocaleString()}
                  </td>

                  <td>
                    <Badge
                      tone={
                        payment.status === "failed" ||
                        payment.status === "refunded"
                          ? "warn"
                          : ""
                      }
                    >
                      {payment.status}
                    </Badge>
                  </td>

                  <td>
                    {payment.paidAt
                      ? new Date(payment.paidAt).toLocaleString()
                      : "—"}
                  </td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="btn ghost"
                        onClick={() => openEdit(payment)}
                      >
                        Update
                      </button>

                      <button
                        className="btn ghost"
                        onClick={() => deletePayment(payment)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <Empty
            text={loading ? "Loading payments..." : "No payment records."}
          />
        )}
      </section>

      {modal && (
        <Modal
          title={isEditing ? "Update payment" : "Record payment"}
          onClose={closeModal}
          actions={
            <>
              <button
                className="btn ghost"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="btn primary"
                onClick={savePayment}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Update payment"
                    : "Save payment"}
              </button>
            </>
          }
        >
          {formError && <div className="notice error">{formError}</div>}

          <label>
            Invoice
            <select
              value={form.invoiceId}
              onChange={(e) => updateField("invoiceId", e.target.value)}
            >
              <option value="">Select invoice</option>

              {invoices.map((invoice) => (
                <option key={invoice._id} value={invoice._id}>
                  {getInvoiceLabel(invoice)}
                  {" · "}
                  {invoice.currency || "HKD"}{" "}
                  {Number(invoice.total || 0).toLocaleString()}
                </option>
              ))}
            </select>
          </label>

          <div className="form-grid">
            <label>
              Provider
              <select
                value={form.provider}
                onChange={(e) => updateField("provider", e.target.value)}
              >
                {PAYMENT_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>

            <label>
              External ID
              <input
                value={form.externalId}
                onChange={(e) => updateField("externalId", e.target.value)}
                placeholder="pay-test-001"
              />
            </label>

            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => updateField("amount", e.target.value)}
              />
            </label>

            <label>
              Currency
              <input
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
                maxLength={3}
                placeholder="HKD"
              />
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
              >
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Paid at
              <input
                type="datetime-local"
                value={form.paidAt}
                onChange={(e) => updateField("paidAt", e.target.value)}
              />
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}
