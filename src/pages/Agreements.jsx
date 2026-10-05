import React, { useEffect, useMemo, useState } from "react";

import { Page, Empty } from "./Dashboard";

import Badge from "../components/Badge";

import Modal from "../components/Modal";

import { useAuth } from "../auth/AuthContext";



const STATUS_OPTIONS = [

  "draft",

  "sent",

  "viewed",

  "signed",

  "declined",

  "expired",

];



const INITIAL_FORM = {

  contactId: "",

  companyId: "",

  dealId: "",

  name: "",

  fileUrl: "",

  provider: "docusign",

  externalId: "",

  amount: 0,

  currency: "HKD",

  status: "draft",

  metadata: {},

};



function getId(value) {
  if (!value) return "";
  if (typeof value === "object") return value._id || value.id || "";
  return String(value);
}

function getContactName(contact) {
  if (!contact) return "Unknown contact";
  if (typeof contact === "string") return contact;
  if (contact.fullName) return contact.fullName;
  const name = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
  return name || contact.email || contact._id || "Unknown contact";
}

function getCompanyName(company) {
  if (!company) return "Unknown company";
  if (typeof company === "string") return company;
  return company.name || company.legalName || company._id || "Unknown company";
}

function getDealName(deal) {
  if (!deal) return "Unknown deal";
  if (typeof deal === "string") return deal;
  return deal.title || deal.name || deal._id || "Unknown deal";
}

function formatStatus(status) {
  if (!status) return "Unknown";
  const formatted = String(status).replace(/_/g, " ").trim();
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function parseMetadata(value) {
  if (!value || !value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Metadata must contain valid JSON.");
  }
}

export default function Agreements() {

  const { request } = useAuth();



  const [rows, setRows] = useState([]);

  const [contacts, setContacts] = useState([]);

  const [companies, setCompanies] = useState([]);

  const [deals, setDeals] = useState([]);



  const [loading, setLoading] = useState(false);

  const [loadingRelations, setLoadingRelations] = useState(false);

  const [saving, setSaving] = useState(false);



  const [error, setError] = useState("");



  const [modal, setModal] = useState(false);

  const [detailsModal, setDetailsModal] = useState(false);



  const [editingId, setEditingId] = useState(null);

  const [selectedAgreement, setSelectedAgreement] = useState(null);



  const [form, setForm] = useState(INITIAL_FORM);



  const [filters, setFilters] = useState({

    status: "",

    provider: "",

    dealId: "",

  });



  const [pagination, setPagination] = useState({

    page: 1,

    limit: 25,

    total: 0,

    pages: 1,

  });



  /*

   * ---------------------------------------------------------

   * Load Agreements

   * ---------------------------------------------------------

   */



  async function load(page = pagination.page) {

    setLoading(true);

    setError("");



    try {

      const query = {

        page,

        limit: pagination.limit,

        sort: "createdAt",

        order: "desc",

      };



      if (filters.status) {

        query.status = filters.status;

      }



      if (filters.provider) {

        query.provider = filters.provider;

      }



      if (filters.dealId.trim()) {

        query.dealId = filters.dealId.trim();

      }



      const response = await request("/agreements", {

        query,

      });



      const data = response.data || {};



      const items = Array.isArray(data)

        ? data

        : data.items || [];



      setRows(items);



      setPagination(

        data.pagination || {

          page,

          limit: pagination.limit,

          total: items.length,

          pages: 1,

        },

      );

    } catch (e) {

      setError(e.message || "Failed to load agreements.");

    } finally {

      setLoading(false);

    }

  }



  /*

   * ---------------------------------------------------------

   * Load Contact / Company / Deal dropdown data

   * ---------------------------------------------------------

   */



  async function loadRelatedRecords() {

    setLoadingRelations(true);



    try {

      const [contactsResponse, companiesResponse, dealsResponse] =

        await Promise.all([

          request("/contacts", {

            query: {

              page: 1,

              limit: 100,

              search: "",

              isArchived: false,

            },

          }),



          request("/companies", {

            query: {

              page: 1,

              limit: 100,

              search: "",

              isArchived: false,

              sort: "createdAt",

              order: "desc",

            },

          }),



          request("/deals", {

            query: {

              page: 1,

              limit: 100,

            },

          }),

        ]);



      const contactData = contactsResponse.data || {};

      const companyData = companiesResponse.data || {};

      const dealData = dealsResponse.data || {};



      const contactRows = Array.isArray(contactData)

        ? contactData

        : contactData.items || [];



      const companyRows = Array.isArray(companyData)

        ? companyData

        : companyData.items || [];



      const dealRows = Array.isArray(dealData)

        ? dealData

        : dealData.items || [];



      setContacts(contactRows);

      setCompanies(companyRows);

      setDeals(dealRows);

    } catch (e) {

      setError(

        e.message || "Failed to load contacts, companies and deals.",

      );

    } finally {

      setLoadingRelations(false);

    }

  }



  useEffect(() => {

    load(1);

  }, [filters.status, filters.provider]);



  useEffect(() => {

    loadRelatedRecords();

  }, []);



  /*

   * ---------------------------------------------------------

   * Form

   * ---------------------------------------------------------

   */



  function resetForm() {

    setForm({

      ...INITIAL_FORM,

      metadata: {},

    });



    setEditingId(null);

  }



  function openCreateModal() {

    resetForm();

    setError("");

    setModal(true);



    /*

     * Refresh dropdown data when opening the form so

     * newly-created contacts/companies/deals are available.

     */

    loadRelatedRecords();

  }



  function openEditModal(agreement) {

    setError("");



    setEditingId(agreement._id);



    setForm({

      contactId: getId(agreement.contactId),

      companyId: getId(agreement.companyId),

      dealId: getId(agreement.dealId),



      name: agreement.name || "",

      fileUrl: agreement.fileUrl || "",

      provider: agreement.provider || "docusign",

      externalId: agreement.externalId || "",

      amount: agreement.amount ?? 0,

      currency: agreement.currency || "HKD",

      status: agreement.status || "draft",

      metadata: agreement.metadata || {},

    });



    setModal(true);



    loadRelatedRecords();

  }



  /*

   * ---------------------------------------------------------

   * Create / Update Agreement

   * ---------------------------------------------------------

   */



  async function saveAgreement() {

    setError("");



    if (!form.name.trim()) {

      setError("Agreement name is required.");

      return;

    }



    if (!form.contactId) {

      setError("Please select a contact.");

      return;

    }



    if (!form.companyId) {

      setError("Please select a company.");

      return;

    }



    if (!form.dealId) {

      setError("Please select a deal.");

      return;

    }



    if (Number(form.amount) < 0) {

      setError("Amount cannot be negative.");

      return;

    }



    let metadata;



    try {

      metadata =

        typeof form.metadata === "string"

          ? parseMetadata(form.metadata)

          : form.metadata || {};

    } catch (e) {

      setError(e.message);

      return;

    }



    setSaving(true);



    try {

      const payload = {

        contactId: form.contactId,

        companyId: form.companyId,

        dealId: form.dealId,



        name: form.name.trim(),



        fileUrl: form.fileUrl.trim(),



        provider: form.provider.trim(),



        externalId: form.externalId.trim(),



        amount: Number(form.amount) || 0,



        currency: form.currency.trim().toUpperCase() || "HKD",



        status: form.status,



        metadata,

      };



      if (editingId) {

        await request(`/agreements/${editingId}`, {

          method: "PATCH",

          body: payload,

        });

      } else {

        await request("/agreements", {

          method: "POST",

          body: payload,

        });

      }



      setModal(false);

      resetForm();



      await load(pagination.page);

    } catch (e) {

      setError(e.message || "Failed to save agreement.");

    } finally {

      setSaving(false);

    }

  }



  /*

   * ---------------------------------------------------------

   * Details

   * ---------------------------------------------------------

   */



  async function openDetails(agreement) {

    setError("");



    try {

      const response = await request(`/agreements/${agreement._id}`);



      setSelectedAgreement(response.data || agreement);

      setDetailsModal(true);

    } catch (e) {

      setError(e.message || "Failed to load agreement details.");

    }

  }



  /*

   * ---------------------------------------------------------

   * Delete

   * ---------------------------------------------------------

   */



  async function deleteAgreement(agreement) {

    const confirmed = window.confirm(

      `Delete agreement "${agreement.name}"? This action cannot be undone.`,

    );



    if (!confirmed) {

      return;

    }



    setError("");



    try {

      await request(`/agreements/${agreement._id}`, {

        method: "DELETE",

      });



      const shouldGoBack =

        rows.length === 1 && pagination.page > 1;



      await load(

        shouldGoBack

          ? pagination.page - 1

          : pagination.page,

      );

    } catch (e) {

      setError(e.message || "Failed to delete agreement.");

    }

  }



  /*

   * ---------------------------------------------------------

   * Update Status

   * ---------------------------------------------------------

   */



  async function updateStatus(agreement, status) {

    setError("");



    try {

      await request(`/agreements/${agreement._id}`, {

        method: "PATCH",

        body: {

          contactId: getId(agreement.contactId),

          companyId: getId(agreement.companyId),

          dealId: getId(agreement.dealId),



          name: agreement.name,



          fileUrl: agreement.fileUrl || "",



          provider: agreement.provider || "",



          externalId: agreement.externalId || "",



          amount: Number(agreement.amount) || 0,



          currency: agreement.currency || "HKD",



          status,



          metadata: agreement.metadata || {},

        },

      });



      await load(pagination.page);

    } catch (e) {

      setError(

        e.message || "Failed to update agreement status.",

      );

    }

  }



  /*

   * ---------------------------------------------------------

   * Filters

   * ---------------------------------------------------------

   */



  function clearFilters() {

    setFilters({

      status: "",

      provider: "",

      dealId: "",

    });

  }



  /*

   * ---------------------------------------------------------

   * Metrics

   * ---------------------------------------------------------

   */



  const metrics = useMemo(() => {

    return {

      total: pagination.total,



      draft: rows.filter(

        (x) => x.status === "draft",

      ).length,



      sent: rows.filter(

        (x) => x.status === "sent",

      ).length,



      viewed: rows.filter(

        (x) => x.status === "viewed",

      ).length,



      signed: rows.filter(

        (x) => x.status === "signed",

      ).length,

    };

  }, [rows, pagination.total]);



  /*

   * ---------------------------------------------------------

   * Lookup maps

   * ---------------------------------------------------------

   */



  const contactMap = useMemo(() => {

    return Object.fromEntries(

      contacts.map((contact) => [

        contact._id,

        getContactName(contact),

      ]),

    );

  }, [contacts]);



  const companyMap = useMemo(() => {

    return Object.fromEntries(

      companies.map((company) => [

        company._id,

        getCompanyName(company),

      ]),

    );

  }, [companies]);



  const dealMap = useMemo(() => {

    return Object.fromEntries(

      deals.map((deal) => [

        deal._id,

        getDealName(deal),

      ]),

    );

  }, [deals]);



  /*

   * ---------------------------------------------------------

   * Render

   * ---------------------------------------------------------

   */



  return (

    <Page

      title="Agreements"

      kicker="Manage documents, signatures and agreement records"

      actions={

        <button

          className="btn primary"

          onClick={openCreateModal}

        >

          + New agreement

        </button>

      }

    >

      {error && (

        <div className="notice error">

          <b>Agreements</b>

          <span>{error}</span>

        </div>

      )}



      {/* Metrics */}

      <div className="metrics five">

        <MetricX

          label="Total agreements"

          value={metrics.total}

        />



        <MetricX

          label="Draft"

          value={metrics.draft}

        />



        <MetricX

          label="Sent"

          value={metrics.sent}

        />



        <MetricX

          label="Viewed"

          value={metrics.viewed}

        />



        <MetricX

          label="Signed"

          value={metrics.signed}

        />

      </div>



      {/* Filters */}

      <section className="panel agreements-filters">

        <div className="filter-grid">

          <label>

            Status



            <select

              value={filters.status}

              onChange={(e) =>

                setFilters((prev) => ({

                  ...prev,

                  status: e.target.value,

                }))

              }

            >

              <option value="">

                All statuses

              </option>



              {STATUS_OPTIONS.map((status) => (

                <option

                  key={status}

                  value={status}

                >

                  {formatStatus(status)}

                </option>

              ))}

            </select>

          </label>



          <label>

            Provider



            <input

              placeholder="e.g. docusign"

              value={filters.provider}

              onChange={(e) =>

                setFilters((prev) => ({

                  ...prev,

                  provider: e.target.value,

                }))

              }

            />

          </label>



          <label>

            Deal ID



            <input

              placeholder="Filter by deal ID"

              value={filters.dealId}

              onChange={(e) =>

                setFilters((prev) => ({

                  ...prev,

                  dealId: e.target.value,

                }))

              }

              onKeyDown={(e) => {

                if (e.key === "Enter") {

                  load(1);

                }

              }}

            />

          </label>



          <div className="filter-actions">

            <button

              className="btn ghost"

              onClick={() => load(1)}

              disabled={loading}

            >

              {loading ? "Loading..." : "Apply"}

            </button>



            <button

              className="btn ghost"

              onClick={clearFilters}

            >

              Clear

            </button>

          </div>

        </div>

      </section>



      {/* Table */}

      <section className="panel table-wrap">

        <div className="table-header">

          <div>

            <h3>Agreement records</h3>



            <span>

              {pagination.total} agreement

              {pagination.total === 1 ? "" : "s"}

            </span>

          </div>

        </div>



        {loading ? (

          <div className="table-loading">

            Loading agreements...

          </div>

        ) : (

          <>

            <table>

              <thead>

                <tr>

                  <th>Agreement</th>

                  <th>Contact</th>

                  <th>Company</th>

                  <th>Deal</th>

                  <th>Provider</th>

                  <th>Amount</th>

                  <th>Status</th>

                  <th>Created</th>

                  <th>Actions</th>

                </tr>

              </thead>



              <tbody>

                {rows.map((agreement) => {

                  const contact =

                    agreement.contactId;



                  const company =

                    agreement.companyId;



                  const deal =

                    agreement.dealId;



                  const contactId =

                    getId(contact);



                  const companyId =

                    getId(company);



                  const dealId =

                    getId(deal);



                  const contactName =

                    typeof contact === "object"

                      ? getContactName(contact)

                      : contactMap[contactId] ||

                        contact ||

                        "—";



                  const companyName =

                    typeof company === "object"

                      ? getCompanyName(company)

                      : companyMap[companyId] ||

                        company ||

                        "—";



                  const dealTitle =

                    typeof deal === "object"

                      ? getDealName(deal)

                      : dealMap[dealId] ||

                        deal ||

                        "—";



                  return (

                    <tr

                      key={agreement._id}

                    >

                      <td>

                        <div className="agreement-name">

                          <b>

                            {agreement.name ||

                              "Untitled"}

                          </b>



                          {agreement.externalId && (

                            <span className="muted">

                              ID:{" "}

                              {

                                agreement.externalId

                              }

                            </span>

                          )}

                        </div>

                      </td>



                      <td>

                        <div className="related-cell">

                          <b>

                            {contactName}

                          </b>



                          {typeof contact ===

                            "object" &&

                            contact.email && (

                              <span>

                                {

                                  contact.email

                                }

                              </span>

                            )}

                        </div>

                      </td>



                      <td>

                        <span>

                          {companyName}

                        </span>

                      </td>



                      <td>

                        <div className="related-cell">

                          <b>

                            {dealTitle}

                          </b>



                          {typeof deal ===

                            "object" &&

                            deal.value != null && (

                              <span>

                                {deal.currency ||

                                  agreement.currency}{" "}

                                {Number(

                                  deal.value,

                                ).toLocaleString()}

                              </span>

                            )}

                        </div>

                      </td>



                      <td>

                        <span className="provider-pill">

                          {agreement.provider ||

                            "—"}

                        </span>

                      </td>



                      <td>

                        <b>

                          {agreement.currency ||

                            "HKD"}{" "}

                          {Number(

                            agreement.amount ||

                              0,

                          ).toLocaleString()}

                        </b>

                      </td>



                      <td>

                        <StatusBadge

                          status={

                            agreement.status

                          }

                        />

                      </td>



                      <td>

                        {agreement.createdAt

                          ? new Date(

                              agreement.createdAt,

                            ).toLocaleDateString()

                          : "—"}

                      </td>



                      <td>

                        <div className="row-actions">

                          <button

                            className="btn ghost"

                            onClick={() =>

                              openDetails(

                                agreement,

                              )

                            }

                          >

                            View

                          </button>



                          <button

                            className="btn ghost"

                            onClick={() =>

                              openEditModal(

                                agreement,

                              )

                            }

                          >

                            Edit

                          </button>



                          <button

                            className="btn ghost danger"

                            onClick={() =>

                              deleteAgreement(

                                agreement,

                              )

                            }

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

              <Empty text="No agreements found." />

            )}

          </>

        )}



        {/* Pagination */}

        {pagination.pages > 1 && (

          <div className="pagination">

            <button

              className="btn ghost"

              disabled={pagination.page <= 1}

              onClick={() =>

                load(

                  pagination.page - 1,

                )

              }

            >

              Previous

            </button>



            <span>

              Page {pagination.page} of{" "}

              {pagination.pages}

            </span>



            <button

              className="btn ghost"

              disabled={

                pagination.page >=

                pagination.pages

              }

              onClick={() =>

                load(

                  pagination.page + 1,

                )

              }

            >

              Next

            </button>

          </div>

        )}

      </section>



      {/* Create / Edit Modal */}

      {modal && (

        <Modal

          title={

            editingId

              ? "Edit agreement"

              : "Create agreement"

          }

          onClose={() => {

            if (saving) return;



            setModal(false);

            resetForm();

          }}

          actions={

            <>

              <button

                className="btn ghost"

                onClick={() => {

                  setModal(false);

                  resetForm();

                }}

                disabled={saving}

              >

                Cancel

              </button>



              <button

                className="btn primary"

                onClick={saveAgreement}

                disabled={

                  saving ||

                  loadingRelations

                }

              >

                {saving

                  ? "Saving..."

                  : editingId

                    ? "Save changes"

                    : "Create agreement"}

              </button>

            </>

          }

        >

          <div className="agreement-form">

            {/* Agreement information */}

            <div className="form-section">

              <div className="form-section-title">

                Agreement information

              </div>



              <label>

                Agreement name *



                <input

                  value={form.name}

                  placeholder="e.g. Membership Agreement"

                  onChange={(e) =>

                    setForm((prev) => ({

                      ...prev,

                      name: e.target.value,

                    }))

                  }

                />

              </label>



              <div className="form-grid">

                <label>

                  Amount



                  <input

                    type="number"

                    min="0"

                    value={form.amount}

                    onChange={(e) =>

                      setForm((prev) => ({

                        ...prev,

                        amount:

                          e.target.value,

                      }))

                    }

                  />

                </label>



                <label>

                  Currency



                  <input

                    value={form.currency}

                    maxLength={3}

                    placeholder="HKD"

                    onChange={(e) =>

                      setForm((prev) => ({

                        ...prev,

                        currency:

                          e.target.value.toUpperCase(),

                      }))

                    }

                  />

                </label>

              </div>



              <div className="form-grid">

                <label>

                  Provider



                  <input

                    value={form.provider}

                    placeholder="docusign"

                    onChange={(e) =>

                      setForm((prev) => ({

                        ...prev,

                        provider:

                          e.target.value,

                      }))

                    }

                  />

                </label>



                <label>

                  External ID



                  <input

                    value={form.externalId}

                    placeholder="doc-test-001"

                    onChange={(e) =>

                      setForm((prev) => ({

                        ...prev,

                        externalId:

                          e.target.value,

                      }))

                    }

                  />

                </label>

              </div>



              <label>

                File URL



                <input

                  type="url"

                  value={form.fileUrl}

                  placeholder="https\://example.com/agreement.pdf"

                  onChange={(e) =>

                    setForm((prev) => ({

                      ...prev,

                      fileUrl:

                        e.target.value,

                    }))

                  }

                />

              </label>



              <label>

                Status



                <select

                  value={form.status}

                  onChange={(e) =>

                    setForm((prev) => ({

                      ...prev,

                      status:

                        e.target.value,

                    }))

                  }

                >

                  {STATUS_OPTIONS.map(

                    (status) => (

                      <option

                        key={status}

                        value={status}

                      >

                        {formatStatus(status)}

                      </option>

                    ),

                  )}

                </select>

              </label>

            </div>



            {/* Related records */}

            <div className="form-section">

              <div className="form-section-title">

                Related records

              </div>



              <p className="form-help">

                Select the contact, company and

                deal connected to this agreement.

              </p>



              {/* Contact dropdown */}

              <label>

                Contact *



                <select

                  value={form.contactId}

                  onChange={(e) =>

                    setForm((prev) => ({

                      ...prev,

                      contactId:

                        e.target.value,

                    }))

                  }

                  disabled={

                    loadingRelations

                  }

                >

                  <option value="">

                    {loadingRelations

                      ? "Loading contacts..."

                      : "Select contact"}

                  </option>



                  {contacts.map((contact) => {

                    const name =

                      getContactName(

                        contact,

                      );



                    return (

                      <option

                        key={contact._id}

                        value={contact._id}

                      >

                        {name}

                        {contact.email

                          ? ` — ${contact.email}`

                          : ""}

                      </option>

                    );

                  })}

                </select>



                {!loadingRelations &&

                  contacts.length === 0 && (

                    <small className="form-help">

                      No contacts available.

                    </small>

                  )}

              </label>



              {/* Company dropdown */}

              <label>

                Company *



                <select

                  value={form.companyId}

                  onChange={(e) =>

                    setForm((prev) => ({

                      ...prev,

                      companyId:

                        e.target.value,

                    }))

                  }

                  disabled={

                    loadingRelations

                  }

                >

                  <option value="">

                    {loadingRelations

                      ? "Loading companies..."

                      : "Select company"}

                  </option>



                  {companies.map((company) => (

                    <option

                      key={company._id}

                      value={company._id}

                    >

                      {getCompanyName(

                        company,

                      )}

                      {company.email

                        ? ` — ${company.email}`

                        : ""}

                    </option>

                  ))}

                </select>



                {!loadingRelations &&

                  companies.length === 0 && (

                    <small className="form-help">

                      No companies available.

                    </small>

                  )}

              </label>



              {/* Deal dropdown */}

              <label>

                Deal *



                <select

                  value={form.dealId}

                  onChange={(e) =>

                    setForm((prev) => ({

                      ...prev,

                      dealId:

                        e.target.value,

                    }))

                  }

                  disabled={

                    loadingRelations

                  }

                >

                  <option value="">

                    {loadingRelations

                      ? "Loading deals..."

                      : "Select deal"}

                  </option>



                  {deals.map((deal) => (

                    <option

                      key={deal._id}

                      value={deal._id}

                    >

                      {getDealName(deal)}

                      {deal.value != null

                        ? ` — ${

                            deal.currency ||

                            form.currency ||

                            "HKD"

                          } ${Number(

                            deal.value,

                          ).toLocaleString()}`

                        : ""}

                    </option>

                  ))}

                </select>



                {!loadingRelations &&

                  deals.length === 0 && (

                    <small className="form-help">

                      No deals available.

                    </small>

                  )}

              </label>

            </div>



            {/* Metadata */}

            <div className="form-section">

              <div className="form-section-title">

                Metadata

              </div>



              <label>

                Metadata JSON



                <textarea

                  rows={5}

                  value={

                    typeof form.metadata ===

                    "string"

                      ? form.metadata

                      : JSON.stringify(

                          form.metadata ||

                            {},

                          null,

                          2,

                        )

                  }

                  placeholder='{"source":"crm"}'

                  onChange={(e) =>

                    setForm((prev) => ({

                      ...prev,

                      metadata:

                        e.target.value,

                    }))

                  }

                />

              </label>

            </div>

          </div>

        </Modal>

      )}



      {/* Details Modal */}

      {detailsModal &&

        selectedAgreement && (

          <Modal

            title="Agreement details"

            onClose={() => {

              setDetailsModal(false);

              setSelectedAgreement(

                null,

              );

            }}

            actions={

              <>

                <button

                  className="btn ghost"

                  onClick={() => {

                    setDetailsModal(false);

                    openEditModal(

                      selectedAgreement,

                    );

                  }}

                >

                  Edit agreement

                </button>



                <button

                  className="btn primary"

                  onClick={() => {

                    setDetailsModal(false);

                    setSelectedAgreement(

                      null,

                    );

                  }}

                >

                  Close

                </button>

              </>

            }

          >

            <AgreementDetails

              agreement={selectedAgreement}

              onStatusChange={async (

                status,

              ) => {

                await updateStatus(

                  selectedAgreement,

                  status,

                );



                setSelectedAgreement(

                  (prev) =>

                    prev

                      ? {

                          ...prev,

                          status,

                        }

                      : prev,

                );

              }}

            />

          </Modal>

        )}

    </Page>

  );

}



/*

 * ---------------------------------------------------------

 * Agreement Details

 * ---------------------------------------------------------

 */



function AgreementDetails({

  agreement,

  onStatusChange,

}) {

  const contact = agreement.contactId;

  const company = agreement.companyId;

  const deal = agreement.dealId;

  const createdBy = agreement.createdBy;



  const contactName =

    getContactName(contact);



  const companyName =

    getCompanyName(company);



  const dealName =

    getDealName(deal);



  return (

    <div className="agreement-details">

      <div className="details-hero">

        <div>

          <span className="eyebrow">

            Agreement

          </span>



          <h2>

            {agreement.name}

          </h2>



          <div className="details-meta">

            <StatusBadge

              status={agreement.status}

            />



            <span>

              {agreement.provider ||

                "No provider"}

            </span>

          </div>

        </div>



        <div className="agreement-amount">

          <span>Amount</span>



          <strong>

            {agreement.currency ||

              "HKD"}{" "}

            {Number(

              agreement.amount || 0,

            ).toLocaleString()}

          </strong>

        </div>

      </div>



      <div className="details-grid">

        <DetailItem

          label="Contact"

          value={contactName}

        />



        <DetailItem

          label="Contact ID"

          value={getId(contact)}

        />



        <DetailItem

          label="Contact email"

          value={

            typeof contact ===

            "object"

              ? contact.email

              : "—"

          }

        />



        <DetailItem

          label="Company"

          value={companyName}

        />



        <DetailItem

          label="Company ID"

          value={getId(company)}

        />



        <DetailItem

          label="Deal"

          value={dealName}

        />



        <DetailItem

          label="Deal ID"

          value={getId(deal)}

        />



        <DetailItem

          label="External ID"

          value={

            agreement.externalId

          }

        />



        <DetailItem

          label="Provider"

          value={agreement.provider}

        />



        <DetailItem

          label="Created"

          value={

            agreement.createdAt

              ? new Date(

                  agreement.createdAt,

                ).toLocaleString()

              : "—"

          }

        />



        <DetailItem

          label="Last updated"

          value={

            agreement.updatedAt

              ? new Date(

                  agreement.updatedAt,

                ).toLocaleString()

              : "—"

          }

        />



        <DetailItem

          label="Created by"

          value={

            typeof createdBy ===

            "object"

              ? createdBy.name ||

                createdBy.email ||

                "—"

              : createdBy || "—"

          }

        />

      </div>



      {agreement.fileUrl && (

        <div className="details-section">

          <span className="eyebrow">

            Document

          </span>



          <a

            href={agreement.fileUrl}

            target="_blank"

            rel="noreferrer"

            className="agreement-file-link"

          >

            Open agreement document →

          </a>

        </div>

      )}



      <div className="details-section">

        <span className="eyebrow">

          Change status

        </span>



        <div className="status-actions">

          {STATUS_OPTIONS.map(

            (status) => (

              <button

                key={status}

                className={`status-button ${

                  agreement.status ===

                  status

                    ? "active"

                    : ""

                }`}

                onClick={() =>

                  onStatusChange(

                    status,

                  )

                }

              >

                {formatStatus(status)}

              </button>

            ),

          )}

        </div>

      </div>



      {agreement.metadata &&

        Object.keys(

          agreement.metadata,

        ).length > 0 && (

          <div className="details-section">

            <span className="eyebrow">

              Metadata

            </span>



            <pre className="metadata-box">

              {JSON.stringify(

                agreement.metadata,

                null,

                2,

              )}

            </pre>

          </div>

        )}

    </div>

  );

}



/*

 * ---------------------------------------------------------

 * Detail Item

 * ---------------------------------------------------------

 */



function DetailItem({

  label,

  value,

}) {

  return (

    <div className="detail-item">

      <span>{label}</span>



      <strong>

        {value || "—"}

      </strong>

    </div>

  );

}



/*

 * ---------------------------------------------------------

 * Status Badge

 * ---------------------------------------------------------

 */



function StatusBadge({ status }) {

  const tone =

    status === "signed"

      ? "success"

      : status === "declined" ||

          status === "expired"

        ? "warn"

        : "";



  return (

    <Badge tone={tone}>

      {formatStatus(status)}

    </Badge>

  );

}



/*

 * ---------------------------------------------------------

 * Metric

 * ---------------------------------------------------------

 */



function MetricX({

  label,

  value,

}) {

  return (

    <div className="metric">

      <span className="eyebrow">

        {label}

      </span>



      <strong>{value}</strong>

    </div>

  );

}