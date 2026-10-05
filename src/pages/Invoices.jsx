import React, { useEffect, useMemo, useState } from "react";

import { Page, Empty } from "./Dashboard";

import Badge from "../components/Badge";

import Modal from "../components/Modal";

import { useAuth } from "../auth/AuthContext";



const EMPTY_FORM = {

  contactId: "",

  companyId: "",

  dealId: "",

  membershipId: "",



  invoiceNumber: "",

  provider: "xero",

  externalId: "",

  description: "",



  subtotal: "",

  tax: "",

  total: "",



  currency: "HKD",

  dueAt: "",



  status: "awaiting",

  recurring: false,

  source: "manual",

};



const INVOICE_STATUSES = ["draft", "awaiting", "overdue", "paid", "cancelled"];



const PROVIDERS = ["xero", "stripe"];



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
  // Normalize the supported API list-response shapes.
  const candidates = [
    response?.data?.items,
    response?.items,
    response?.data?.data?.items,
    response?.data?.contacts,
    response?.data?.companies,
    response?.data?.deals,
    response?.data?.memberships,
    response?.data?.results,
    response?.results,
    Array.isArray(response?.data) ? response.data : null,
    Array.isArray(response) ? response : null,
  ];

  return candidates.find(Array.isArray) || [];
}



function getContactName(contact) {

  if (!contact) return "Unknown contact";



  const fullName = [contact.firstName, contact.lastName]

    .filter(Boolean)

    .join(" ")

    .trim();



  return fullName || contact.email || contact._id;

}



function getCompanyName(company) {

  if (!company) return "Unknown company";



  return company.name || company.legalName || company._id;

}



function getDealName(deal) {

  if (!deal) return "Unknown deal";



  return deal.title || deal.name || deal._id;

}



function getMembershipName(member) {

  if (!member) return "Unknown membership";



  return member.memberCode || member.name || member.planName || member._id;

}



function MetricX({ label, value }) {

  return (

    <div className="metric">

      <span className="eyebrow">{label}</span>

      <strong>{value}</strong>

    </div>

  );

}



export default function Invoices() {

  const { request } = useAuth();



  const [rows, setRows] = useState([]);



  const [contacts, setContacts] = useState([]);

  const [companies, setCompanies] = useState([]);

  const [deals, setDeals] = useState([]);

  const [memberships, setMemberships] = useState([]);



  const [modal, setModal] = useState(false);

  const [editingId, setEditingId] = useState(null);



  const [form, setForm] = useState(EMPTY_FORM);



  const [error, setError] = useState("");

  const [formError, setFormError] = useState("");

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);



  const isEditing = Boolean(editingId);



  async function loadInvoices() {

    try {

      setLoading(true);



      const response = await request("/invoices", {

        query: {

          page: 1,

          limit: 100,

          sort: "dueAt",

          order: "asc",

        },

      });



      setRows(getItems(response));

      setError("");

    } catch (e) {

      setError(e.message || "Failed to load invoices.");

    } finally {

      setLoading(false);

    }

  }



  async function loadDropdowns() {

    try {

      const [

        contactsResponse,

        companiesResponse,

        dealsResponse,

        membersResponse,

      ] = await Promise.all([

        request("/contacts", {

          query: {

            page: 1,

            limit: 100,

          },

        }),



        request("/companies", {

          query: {

            page: 1,

            limit: 100,

          },

        }),



        request("/deals", {

          query: {

            page: 1,

            limit: 100,

          },

        }),



        request("/memberships", {

          query: {

            page: 1,

            limit: 100,

            sort: "renewalAt",

            order: "asc",

          },

        }),

      ]);



      setContacts(getItems(contactsResponse));

      setCompanies(getItems(companiesResponse));

      setDeals(getItems(dealsResponse));

      setMemberships(getItems(membersResponse));

    } catch (e) {

      setError(

        e.message ||

          "Failed to load contacts, companies, deals, or memberships.",

      );

    }

  }



  async function load() {

    await Promise.all([loadInvoices(), loadDropdowns()]);

  }



  useEffect(() => {

    load();

  }, []);



  function openCreate() {

    setEditingId(null);

    setForm({ ...EMPTY_FORM });

    setFormError("");

    setError("");

    setModal(true);

  }



  function openEdit(invoice) {

    setEditingId(invoice._id);



    setForm({

      contactId:

        typeof invoice.contactId === "object"

          ? invoice.contactId?._id || ""

          : invoice.contactId || "",



      companyId:

        typeof invoice.companyId === "object"

          ? invoice.companyId?._id || ""

          : invoice.companyId || "",



      dealId:

        typeof invoice.dealId === "object"

          ? invoice.dealId?._id || ""

          : invoice.dealId || "",



      membershipId:

        typeof invoice.membershipId === "object"

          ? invoice.membershipId?._id || ""

          : invoice.membershipId || "",



      invoiceNumber: invoice.invoiceNumber || "",

      provider: invoice.provider || "xero",

      externalId: invoice.externalId || "",

      description: invoice.description || "",



      subtotal:

        invoice.subtotal === undefined || invoice.subtotal === null

          ? ""

          : invoice.subtotal,



      tax: invoice.tax === undefined || invoice.tax === null ? "" : invoice.tax,



      total:

        invoice.total === undefined || invoice.total === null

          ? ""

          : invoice.total,



      currency: invoice.currency || "HKD",

      dueAt: toDateTimeLocal(invoice.dueAt),



      status: invoice.status || "awaiting",

      recurring: Boolean(invoice.recurring),

      source: invoice.source || "manual",

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



  function updateField(field, value) {

    setForm((current) => ({

      ...current,

      [field]: value,

    }));

  }



  function validateForm() {

    const subtotal = Number(form.subtotal);

    const tax = Number(form.tax);

    const total = Number(form.total);



    if (!form.invoiceNumber.trim()) {

      return "Invoice number is required.";

    }



    if (!form.provider) {

      return "Provider is required.";

    }



    if (!form.currency.trim()) {

      return "Currency is required.";

    }



    if (!Number.isFinite(subtotal) || subtotal < 0) {

      return "Subtotal must be a valid number greater than or equal to 0.";

    }



    if (!Number.isFinite(tax) || tax < 0) {

      return "Tax must be a valid number greater than or equal to 0.";

    }



    if (!Number.isFinite(total) || total < 0) {

      return "Total must be a valid number greater than or equal to 0.";

    }



    if (!form.dueAt) {

      return "Due date is required.";

    }



    if (!INVOICE_STATUSES.includes(form.status)) {

      return "Invalid invoice status.";

    }



    if (!form.source.trim()) {

      return "Source is required.";

    }



    return "";

  }



  function buildPayload() {

    return {

      contactId: form.contactId,

      companyId: form.companyId,

      dealId: form.dealId,

      membershipId: form.membershipId,



      invoiceNumber: form.invoiceNumber.trim(),

      provider: form.provider,

      externalId: form.externalId.trim() || undefined,

      description: form.description.trim(),



      subtotal: Number(form.subtotal) || 0,

      tax: Number(form.tax) || 0,

      total: Number(form.total) || 0,



      currency: form.currency.trim().toUpperCase(),



      dueAt: toISOStringOrUndefined(form.dueAt),



      status: form.status,

      recurring: Boolean(form.recurring),

      source: form.source.trim(),



      metadata: {},

    };

  }



  async function saveInvoice() {

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

        await request(`/invoices/${editingId}`, {

          method: "PATCH",

          body: payload,

        });

      } else {

        await request("/invoices", {

          method: "POST",

          body: payload,

        });

      }



      closeModal();

      await loadInvoices();

    } catch (e) {

      setFormError(e.message || "Failed to save invoice.");

    } finally {

      setSaving(false);

    }

  }



  async function deleteInvoice(invoice) {

    const invoiceName =

      invoice.invoiceNumber || invoice._id?.slice(-8) || "this invoice";



    if (!window.confirm(`Delete ${invoiceName}?`)) {

      return;

    }



    try {

      setError("");



      await request(`/invoices/${invoice._id}`, {

        method: "DELETE",

      });



      await loadInvoices();

    } catch (e) {

      setError(e.message || "Failed to delete invoice.");

    }

  }



  async function markPaid(invoice) {

    if (!invoice?._id) return;

    if (!window.confirm(`Mark ${invoice.invoiceNumber || "this invoice"} as paid?`)) return;

    try {

      setError("");

      await request(`/invoices/${invoice._id}/pay`, {

        method: "PATCH",

        body: {

          amount: Number(invoice.total || 0),

          provider: invoice.provider || "stripe",

        },

      });

      await loadInvoices();

    } catch (e) {

      setError(e.message || "Failed to mark invoice as paid.");

    }

  }



  async function markOverdue() {

    try {

      setError("");



      await request("/invoices/mark-overdue", {

        method: "POST",

      });



      await loadInvoices();

    } catch (e) {

      setError(e.message || "Failed to mark invoices overdue.");

    }

  }



  const metrics = useMemo(

    () => ({

      total: rows.length,



      awaiting: rows.filter((invoice) => invoice.status === "awaiting").length,



      overdue: rows.filter((invoice) => invoice.status === "overdue").length,



      paid: rows.filter((invoice) => invoice.status === "paid").length,

    }),

    [rows],

  );



  function formatMoney(value, currency = "HKD") {

    return `${currency} ${Number(value || 0).toLocaleString()}`;

  }



  function formatDate(value) {

    if (!value) return "—";



    const date = new Date(value);



    if (Number.isNaN(date.getTime())) {

      return "—";

    }



    return date.toLocaleDateString();

  }



  return (

    <Page

      title="Invoices"

      kicker="Xero-ready invoice records"

      actions={

        <>

          <button

            className="btn ghost"

            onClick={markOverdue}

            disabled={loading}

          >

            Mark overdue

          </button>



          <button className="btn primary" onClick={openCreate}>

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

        <MetricX label="Total" value={metrics.total} />

        <MetricX label="Awaiting" value={metrics.awaiting} />

        <MetricX label="Overdue" value={metrics.overdue} />

        <MetricX label="Paid" value={metrics.paid} />

      </div>



      <section className="panel table-wrap">

        <table>

          <thead>

            <tr>

              <th>Invoice</th>

              <th>Contact</th>

              <th>Company</th>

              <th>Deal</th>

              <th>Membership</th>

              <th>Total</th>

              <th>Status</th>

              <th>Due</th>

              <th>Actions</th>

            </tr>

          </thead>



          <tbody>

            {rows.map((invoice) => (

              <tr key={invoice._id}>

                <td>

                  <b>{invoice.invoiceNumber || invoice._id?.slice(-8)}</b>

                </td>



                <td>

                  {typeof invoice.contactId === "object"

                    ? getContactName(invoice.contactId)

                    : invoice.contactId || "—"}

                </td>



                <td>

                  {typeof invoice.companyId === "object"

                    ? getCompanyName(invoice.companyId)

                    : invoice.companyId || "—"}

                </td>



                <td>

                  {typeof invoice.dealId === "object"

                    ? getDealName(invoice.dealId)

                    : invoice.dealId || "—"}

                </td>



                <td>

                  {typeof invoice.membershipId === "object"

                    ? getMembershipName(invoice.membershipId)

                    : invoice.membershipId || "—"}

                </td>



                <td>{formatMoney(invoice.total, invoice.currency)}</td>



                <td>

                  <Badge tone={invoice.status === "overdue" ? "warn" : ""}>

                    {invoice.status}

                  </Badge>

                </td>



                <td>{formatDate(invoice.dueAt)}</td>



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

                      onClick={() => openEdit(invoice)}

                    >

                      Update

                    </button>



                    {invoice.status !== "paid" && invoice.status !== "cancelled" && (

                      <button

                        className="btn ghost"

                        onClick={() => markPaid(invoice)}

                      >

                        Mark paid

                      </button>

                    )}



                    <button

                      className="btn ghost"

                      onClick={() => deleteInvoice(invoice)}

                    >

                      Delete

                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>



        {rows.length === 0 && (

          <Empty text={loading ? "Loading invoices..." : "No invoices."} />

        )}

      </section>



      {modal && (

        <Modal

          title={isEditing ? "Update invoice" : "Create invoice"}

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

                onClick={saveInvoice}

                disabled={saving}

              >

                {saving

                  ? "Saving..."

                  : isEditing

                    ? "Update invoice"

                    : "Create invoice"}

              </button>

            </>

          }

        >

          {formError && <div className="notice error">{formError}</div>}



          <div className="form-grid">

            <label>

              Contact

              <select

                value={form.contactId}

                onChange={(e) => updateField("contactId", e.target.value)}

              >

                <option value="">Select contact</option>



                {contacts.map((contact) => (

                  <option key={contact._id} value={contact._id}>

                    {getContactName(contact)}

                    {contact.email ? ` · ${contact.email}` : ""}

                  </option>

                ))}

              </select>

            </label>



            <label>

              Company

              <select

                value={form.companyId}

                onChange={(e) => updateField("companyId", e.target.value)}

              >

                <option value="">Select company</option>



                {companies.map((company) => (

                  <option key={company._id} value={company._id}>

                    {getCompanyName(company)}

                  </option>

                ))}

              </select>

            </label>



            <label>

              Deal

              <select

                value={form.dealId}

                onChange={(e) => updateField("dealId", e.target.value)}

              >

                <option value="">Select deal</option>



                {deals.map((deal) => (

                  <option key={deal._id} value={deal._id}>

                    {getDealName(deal)}

                  </option>

                ))}

              </select>

            </label>



            <label>

              Membership

              <select

                value={form.membershipId}

                onChange={(e) => updateField("membershipId", e.target.value)}

              >

                <option value="">Select membership</option>



                {memberships.map((membership) => (

                  <option key={membership._id} value={membership._id}>

                    {getMembershipName(membership)}

                  </option>

                ))}

              </select>

            </label>

          </div>



          <div className="form-grid">

            <label>

              Invoice number

              <input

                value={form.invoiceNumber}

                onChange={(e) => updateField("invoiceNumber", e.target.value)}

                placeholder="INV-001"

              />

            </label>



            <label>

              Provider

              <select

                value={form.provider}

                onChange={(e) => updateField("provider", e.target.value)}

              >

                {PROVIDERS.map((provider) => (

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

                placeholder="xero-invoice-id"

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

          </div>



          <div className="form-grid">

            <label>

              Subtotal

              <input

                type="number"

                min="0"

                step="0.01"

                value={form.subtotal}

                onChange={(e) => updateField("subtotal", e.target.value)}

              />

            </label>



            <label>

              Tax

              <input

                type="number"

                min="0"

                step="0.01"

                value={form.tax}

                onChange={(e) => updateField("tax", e.target.value)}

              />

            </label>



            <label>

              Total

              <input

                type="number"

                min="0"

                step="0.01"

                value={form.total}

                onChange={(e) => updateField("total", e.target.value)}

              />

            </label>



            <label>

              Due date

              <input

                type="datetime-local"

                value={form.dueAt}

                onChange={(e) => updateField("dueAt", e.target.value)}

              />

            </label>

          </div>



          <div className="form-grid">

            <label>

              Status

              <select

                value={form.status}

                onChange={(e) => updateField("status", e.target.value)}

              >

                {INVOICE_STATUSES.map((status) => (

                  <option key={status} value={status}>

                    {status}

                  </option>

                ))}

              </select>

            </label>



            <label>

              Source

              <input

                value={form.source}

                onChange={(e) => updateField("source", e.target.value)}

                placeholder="manual"

              />

            </label>



            <label

              style={{

                display: "flex",

                alignItems: "center",

                gap: "8px",

                marginTop: "24px",

              }}

            >

              <input

                type="checkbox"

                checked={form.recurring}

                onChange={(e) => updateField("recurring", e.target.checked)}

              />

              Recurring invoice

            </label>

          </div>



          <label>

            Description

            <textarea

              value={form.description}

              onChange={(e) => updateField("description", e.target.value)}

              placeholder="Invoice description"

              rows={4}

            />

          </label>

        </Modal>

      )}

    </Page>

  );

}
