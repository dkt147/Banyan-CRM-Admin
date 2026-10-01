import React, { useEffect, useMemo, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const ACTIVITY_TYPES = [
  "note",
  "call",
  "email",
  "whatsapp",
  "meeting",
  "stage_change",
  "deal_created",
  "task_created",
];

const blank = {
  type: "note",
  subject: "",
  body: "",
  contactId: "",
  companyId: "",
  dealId: "",
  occurredAt: "",
  metadata: "",
};

function getListData(response) {
  return Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response?.data?.items)
      ? response.data.items
      : [];
}

function getPagination(response, fallbackLimit = 25) {
  return (
    response?.pagination || {
      page: 1,
      limit: fallbackLimit,
      total: 0,
      totalPages: 1,
    }
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function formatType(type) {
  if (!type) return "Activity";

  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getContactName(contact) {
  if (!contact) return "—";

  if (contact.fullName) return contact.fullName;

  return `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "—";
}

function getMetadataText(metadata) {
  if (!metadata) return "";

  if (metadata.changed && Array.isArray(metadata.changed)) {
    return `Changed: ${metadata.changed.join(", ")}`;
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return "";
  }
}

function toLocalDateTimeInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

export default function Activities() {
  const { request } = useAuth();

  const [rows, setRows] = useState([]);

  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [deals, setDeals] = useState([]);

  const [modal, setModal] = useState(false);
  const [detailsModal, setDetailsModal] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState(null);

  const [form, setForm] = useState(blank);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  const [filters, setFilters] = useState({
    contactId: "",
    companyId: "",
    dealId: "",
    type: "",
  });

  const [appliedFilters, setAppliedFilters] = useState({
    contactId: "",
    companyId: "",
    dealId: "",
    type: "",
  });

  async function loadActivities() {
    setLoading(true);
    setError("");

    try {
      const query = {
        page,
        limit,
        contactId: appliedFilters.contactId || undefined,
        companyId: appliedFilters.companyId || undefined,
        dealId: appliedFilters.dealId || undefined,
        type: appliedFilters.type || undefined,
      };

      const response = await request("/activities", {
        query,
      });

      setRows(getListData(response));
      setPagination(getPagination(response, limit));
    } catch (e) {
      setError(e.message || "Failed to load activities.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    try {
      const [contactsResponse, companiesResponse, dealsResponse] =
        await Promise.all([
          request("/contacts", {
            query: {
              page: 1,
              limit: 100,
              isArchived: "false",
            },
          }),

          request("/companies", {
            query: {
              page: 1,
              limit: 100,
              isArchived: "false",
            },
          }),

          request("/deals", {
            query: {
              page: 1,
              limit: 100,
            },
          }),
        ]);

      setContacts(getListData(contactsResponse));
      setCompanies(getListData(companiesResponse));
      setDeals(getListData(dealsResponse));
    } catch (e) {
      setError(e.message || "Failed to load lookup data.");
    }
  }

  useEffect(() => {
    loadActivities();
  }, [page, limit, appliedFilters]);

  useEffect(() => {
    loadLookups();
  }, []);

  function applyFilters() {
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    const emptyFilters = {
      contactId: "",
      companyId: "",
      dealId: "",
      type: "",
    };

    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  function openCreateModal() {
    setSelectedActivity(null);

    setForm({
      ...blank,
      occurredAt: toLocalDateTimeInput(new Date().toISOString()),
    });

    setModal(true);
  }

  async function openDetails(activity) {
    try {
      setError("");

      const response = await request(`/activities/${activity._id}`);

      setSelectedActivity(response?.data || activity);
      setDetailsModal(true);
    } catch (e) {
      setError(e.message || "Failed to load activity details.");
    }
  }

  async function createActivity() {
    if (!form.type) {
      setError("Please select an activity type.");
      return;
    }

    if (!form.subject.trim()) {
      setError("Please enter an activity subject.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let metadata = {};

      if (form.metadata.trim()) {
        try {
          metadata = JSON.parse(form.metadata);
        } catch {
          setError("Metadata must contain valid JSON.");
          setSaving(false);
          return;
        }
      }

      const body = {
        type: form.type,

        contactId: form.contactId || null,
        companyId: form.companyId || null,
        dealId: form.dealId || null,

        subject: form.subject.trim(),
        body: form.body.trim(),

        occurredAt: form.occurredAt
          ? new Date(form.occurredAt).toISOString()
          : new Date().toISOString(),

        metadata,
      };

      await request("/activities", {
        method: "POST",
        body,
      });

      setModal(false);
      setForm(blank);
      setPage(1);

      await loadActivities();
    } catch (e) {
      setError(e.message || "Failed to create activity.");
    } finally {
      setSaving(false);
    }
  }

  async function removeActivity(id) {
    if (!confirm("Delete this activity? This action cannot be undone.")) {
      return;
    }

    try {
      setError("");

      await request(`/activities/${id}`, {
        method: "DELETE",
      });

      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadActivities();
      }

      setDetailsModal(false);
      setSelectedActivity(null);
    } catch (e) {
      setError(e.message || "Failed to delete activity.");
    }
  }

  const hasFilters = useMemo(
    () =>
      Boolean(
        appliedFilters.contactId ||
        appliedFilters.companyId ||
        appliedFilters.dealId ||
        appliedFilters.type,
      ),
    [appliedFilters],
  );

  return (
    <Page
      title="Activities"
      kicker="CRM interaction timeline"
      actions={
        <button className="btn primary" onClick={openCreateModal}>
          + Log activity
        </button>
      }
    >
      {error && (
        <div className="notice error">
          <b>Activities</b>
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="eyebrow">Filters</span>
            <h3 style={{ margin: "4px 0 0" }}>Activity filters</h3>
          </div>

          {hasFilters && (
            <button className="btn ghost" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className="form-grid">
          <label>
            Activity type
            <select
              value={filters.type}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  type: e.target.value,
                })
              }
            >
              <option value="">All types</option>

              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatType(type)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Contact
            <select
              value={filters.contactId}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  contactId: e.target.value,
                })
              }
            >
              <option value="">All contacts</option>

              {contacts.map((contact) => (
                <option key={contact._id} value={contact._id}>
                  {getContactName(contact)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Company
            <select
              value={filters.companyId}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  companyId: e.target.value,
                })
              }
            >
              <option value="">All companies</option>

              {companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Deal
            <select
              value={filters.dealId}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dealId: e.target.value,
                })
              }
            >
              <option value="">All deals</option>

              {deals.map((deal) => (
                <option key={deal._id} value={deal._id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={applyFilters}>
            Apply filters
          </button>
        </div>
      </section>

      {/* Summary */}
      <div
        className="toolbar"
        style={{
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span>
          {pagination.total}{" "}
          {pagination.total === 1 ? "activity" : "activities"}
          {hasFilters ? " matching filters" : ""}
        </span>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: 0,
          }}
        >
          <span>Per page</span>

          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            style={{ width: 90 }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {/* Table */}
      <section className="panel table-wrap">
        {loading ? (
          <Empty text="Loading activities…" />
        ) : rows.length === 0 ? (
          <Empty
            text={
              hasFilters
                ? "No activities match the selected filters."
                : "No activities yet."
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Activity</th>
                <th>Contact</th>
                <th>Company</th>
                <th>Deal</th>
                <th>Occurred</th>
                <th>Created by</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {rows.map((activity) => (
                <tr key={activity._id}>
                  <td>
                    <Badge>{formatType(activity.type)}</Badge>
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => openDetails(activity)}
                      style={{
                        border: 0,
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <b>{activity.subject || "Activity"}</b>

                      {activity.body && (
                        <span
                          style={{
                            display: "block",
                            marginTop: 4,
                            maxWidth: 280,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {activity.body}
                        </span>
                      )}

                      {activity.metadata && (
                        <small
                          style={{
                            display: "block",
                            marginTop: 4,
                          }}
                        >
                          {getMetadataText(activity.metadata)}
                        </small>
                      )}
                    </button>
                  </td>

                  <td>
                    {activity.contactId ? (
                      <div>
                        <b>{getContactName(activity.contactId)}</b>

                        {activity.contactId.email && (
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                            }}
                          >
                            {activity.contactId.email}
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td>{activity.companyId?.name || "—"}</td>

                  <td>
                    {activity.dealId ? (
                      <div>
                        <b>{activity.dealId.title}</b>

                        {activity.dealId.status && (
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                            }}
                          >
                            {activity.dealId.status}
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td>{formatDate(activity.occurredAt)}</td>

                  <td>
                    {activity.userId?.name || activity.userId?.email || "—"}
                  </td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="btn ghost"
                        onClick={() => openDetails(activity)}
                      >
                        View
                      </button>

                      <button
                        className="btn ghost"
                        onClick={() => removeActivity(activity._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div
          className="toolbar"
          style={{
            justifyContent: "space-between",
            marginTop: 14,
          }}
        >
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>

            <button
              className="btn ghost"
              disabled={page >= pagination.totalPages || loading}
              onClick={() =>
                setPage((current) =>
                  Math.min(pagination.totalPages, current + 1),
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create Activity Modal */}
      {modal && (
        <Modal
          title="Log activity"
          onClose={() => {
            if (!saving) {
              setModal(false);
              setForm(blank);
            }
          }}
          actions={
            <>
              <button
                className="btn ghost"
                disabled={saving}
                onClick={() => {
                  setModal(false);
                  setForm(blank);
                }}
              >
                Cancel
              </button>

              <button
                className="btn primary"
                disabled={saving}
                onClick={createActivity}
              >
                {saving ? "Saving…" : "Log activity"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Activity type
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                  })
                }
              >
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatType(type)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Occurred at
              <input
                type="datetime-local"
                value={form.occurredAt}
                onChange={(e) =>
                  setForm({
                    ...form,
                    occurredAt: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Contact
              <select
                value={form.contactId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    contactId: e.target.value,
                  })
                }
              >
                <option value="">None</option>

                {contacts.map((contact) => (
                  <option key={contact._id} value={contact._id}>
                    {getContactName(contact)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Company
              <select
                value={form.companyId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    companyId: e.target.value,
                  })
                }
              >
                <option value="">None</option>

                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Deal
              <select
                value={form.dealId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dealId: e.target.value,
                  })
                }
              >
                <option value="">None</option>

                {deals.map((deal) => (
                  <option key={deal._id} value={deal._id}>
                    {deal.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Subject
            <input
              placeholder="e.g. Follow-up with customer"
              value={form.subject}
              onChange={(e) =>
                setForm({
                  ...form,
                  subject: e.target.value,
                })
              }
            />
          </label>

          <label>
            Body
            <textarea
              placeholder="Add activity details…"
              value={form.body}
              onChange={(e) =>
                setForm({
                  ...form,
                  body: e.target.value,
                })
              }
            />
          </label>

          <label>
            Metadata
            <textarea
              placeholder='Optional JSON, e.g. {"source":"manual"}'
              value={form.metadata}
              onChange={(e) =>
                setForm({
                  ...form,
                  metadata: e.target.value,
                })
              }
            />
          </label>
        </Modal>
      )}

      {/* Activity Details Modal */}
      {detailsModal && selectedActivity && (
        <Modal
          title="Activity details"
          onClose={() => {
            setDetailsModal(false);
            setSelectedActivity(null);
          }}
          actions={
            <>
              <button
                className="btn ghost"
                onClick={() => removeActivity(selectedActivity._id)}
              >
                Delete
              </button>

              <button
                className="btn primary"
                onClick={() => {
                  setDetailsModal(false);
                  setSelectedActivity(null);
                }}
              >
                Close
              </button>
            </>
          }
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <Badge>{formatType(selectedActivity.type)}</Badge>

            <span className="eyebrow">
              {formatDate(selectedActivity.occurredAt)}
            </span>
          </div>

          <div className="detail-grid">
            <Info label="Subject" value={selectedActivity.subject || "—"} />

            <Info
              label="Contact"
              value={getContactName(selectedActivity.contactId)}
            />

            <Info
              label="Company"
              value={selectedActivity.companyId?.name || "—"}
            />

            <Info label="Deal" value={selectedActivity.dealId?.title || "—"} />

            <Info
              label="Created by"
              value={
                selectedActivity.userId?.name ||
                selectedActivity.userId?.email ||
                "—"
              }
            />

            <Info
              label="Created"
              value={formatDate(selectedActivity.createdAt)}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <span className="eyebrow">Description</span>

            <p className="detail-note">
              {selectedActivity.body || "No description."}
            </p>
          </div>

          {selectedActivity.metadata &&
            Object.keys(selectedActivity.metadata).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <span className="eyebrow">Metadata</span>

                <pre
                  style={{
                    marginTop: 8,
                    padding: 12,
                    overflowX: "auto",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.04)",
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(selectedActivity.metadata, null, 2)}
                </pre>
              </div>
            )}
        </Modal>
      )}
    </Page>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <span className="eyebrow">{label}</span>
      <b>{value}</b>
    </div>
  );
}
