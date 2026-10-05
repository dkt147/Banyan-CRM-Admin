import React, { useEffect, useMemo, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const contactTags = [
  "prospect",
  "active_member",
  "past_member",
  "event_client",
  "broker_agent",
  "ngo",
  "vip",
];

const blankForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  whatsapp: "",
  jobTitle: "",
  companyId: "",
  tags: "",
  source: "",
  language: "en",
  notes: "",
  isArchived: false,
};

const defaultPagination = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1,
};

export default function Contacts() {
  const { request } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [archiveFilter, setArchiveFilter] = useState("active");

  const [pagination, setPagination] = useState(defaultPagination);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(blankForm);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");

  const companyName = useMemo(() => {
    return Object.fromEntries(
      companies.map((company) => [company._id, company.name]),
    );
  }, [companies]);

  function formatTag(tag) {
    return tag
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  async function loadCompanies() {
    try {
      const response = await request("/companies", {
        query: {
          page: 1,
          limit: 100,
        },
      });

      setCompanies(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      setError(e.message || "Failed to load companies.");
    }
  }

  async function loadContacts(
    page = pagination.page,
    customSearch = search,
    customCompany = companyFilter,
    customArchive = archiveFilter,
  ) {
    setLoading(true);
    setError("");

    try {
      const query = {
        page,
        limit: pagination.limit,
        search: customSearch,
      };

      if (customCompany) {
        query.companyId = customCompany;
      }

      if (customArchive === "active") {
        query.isArchived = false;
      }

      if (customArchive === "archived") {
        query.isArchived = true;
      }

      const response = await request("/contacts", {
        query,
      });

      const rows = Array.isArray(response.data) ? response.data : [];

      setContacts(rows);

      setPagination({
        page: response.pagination?.page || page,
        limit: response.pagination?.limit || 25,
        total: response.pagination?.total || rows.length,
        totalPages: response.pagination?.totalPages || 1,
      });

      setSelected((previous) => {
        if (!previous) {
          return rows[0] || null;
        }

        const stillExists = rows.find(
          (contact) => contact._id === previous._id,
        );

        return stillExists || rows[0] || null;
      });
    } catch (e) {
      setError(e.message || "Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);

      setPagination((previous) => ({
        ...previous,
        page: 1,
      }));

      loadContacts(1, searchInput, companyFilter, archiveFilter);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPagination((previous) => ({
      ...previous,
      page: 1,
    }));

    loadContacts(1, search, companyFilter, archiveFilter);
  }, [companyFilter, archiveFilter]);

  async function loadContactDetails(contactId) {
    if (!contactId) return;

    setDetailLoading(true);
    setError("");

    try {
      const response = await request(`/contacts/${contactId}`);

      if (response.data) {
        setSelected(response.data);
      }
    } catch (e) {
      setError(e.message || "Failed to load contact details.");
    } finally {
      setDetailLoading(false);
    }
  }

  function handleSelectContact(contact) {
    setSelected(contact);
    loadContactDetails(contact._id);
  }

  function openCreateModal() {
    setEditing(false);

    setForm({
      ...blankForm,
      language: "en",
      isArchived: false,
      tags: "",
    });

    setModal(true);
    setError("");
  }

  function openEditModal() {
    if (!selected) return;

    const selectedCompanyId =
      selected.companyId?._id || selected.companyId || "";

    const selectedTag = Array.isArray(selected.tags)
      ? selected.tags[0] || ""
      : selected.tags || "";

    setEditing(true);

    setForm({
      firstName: selected.firstName || "",
      lastName: selected.lastName || "",
      email: selected.email || "",
      phone: selected.phone || "",
      whatsapp: selected.whatsapp || "",
      jobTitle: selected.jobTitle || "",
      companyId: selectedCompanyId,
      tags: contactTags.includes(selectedTag) ? selectedTag : "",
      source: selected.source || "",
      language: selected.language || "en",
      notes: selected.notes || "",
      isArchived: Boolean(selected.isArchived),
    });

    setModal(true);
    setError("");
  }

  function closeModal() {
    if (saving) return;

    setModal(false);
    setForm(blankForm);
    setEditing(false);
  }

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function saveContact() {
    if (!form.firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (!form.lastName.trim()) {
      setError("Last name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        jobTitle: form.jobTitle.trim(),
        source: form.source.trim(),
        language: form.language || "en",
        notes: form.notes.trim(),
        isArchived: Boolean(form.isArchived),

        // Backend expects tags as an array.
        tags: form.tags ? [form.tags] : [],
      };

      if (form.companyId) {
        payload.companyId = form.companyId;
      }

      let response;

      if (editing && selected?._id) {
        response = await request(`/contacts/${selected._id}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        response = await request("/contacts", {
          method: "POST",
          body: payload,
        });
      }

      const updatedContact = response.data;

      setModal(false);
      setForm(blankForm);
      setEditing(false);

      await loadContacts(pagination.page, search, companyFilter, archiveFilter);

      if (updatedContact?._id) {
        await loadContactDetails(updatedContact._id);
      }
    } catch (e) {
      setError(e.message || "Failed to save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveContact() {
    if (!selected?._id) return;

    const confirmed = window.confirm(
      `Archive ${selected.fullName || "this contact"}?`,
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      await request(`/contacts/${selected._id}/archive`, {
        method: "PATCH",
      });

      setSelected(null);

      await loadContacts(pagination.page, search, companyFilter, archiveFilter);
    } catch (e) {
      setError(e.message || "Failed to archive contact.");
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteContact() {
    if (!selected?._id) return;

    const confirmed = window.confirm(
      `Delete ${selected.fullName || "this contact"} permanently?`,
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      await request(`/contacts/${selected._id}`, {
        method: "DELETE",
      });

      setSelected(null);

      const nextPage =
        contacts.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;

      await loadContacts(nextPage, search, companyFilter, archiveFilter);
    } catch (e) {
      setError(e.message || "Failed to delete contact.");
    } finally {
      setActionLoading(false);
    }
  }

  function goToPage(page) {
    if (page < 1 || page > pagination.totalPages || page === pagination.page) {
      return;
    }

    setSelected(null);

    loadContacts(page, search, companyFilter, archiveFilter);
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setCompanyFilter("");
    setArchiveFilter("active");

    setPagination((previous) => ({
      ...previous,
      page: 1,
    }));

    loadContacts(1, "", "", "active");
  }

  function getCompanyName(contact) {
    if (contact.companyId?.name) {
      return contact.companyId.name;
    }

    const id = contact.companyId?._id || contact.companyId;

    return companyName[id] || "No company";
  }

  function getInitials(contact) {
    return `${contact.firstName?.[0] || ""}${
      contact.lastName?.[0] || ""
    }`.toUpperCase();
  }

  function getFullName(contact) {
    return (
      contact.fullName ||
      `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
      "Unnamed contact"
    );
  }

  return (
    <Page
      title="Contacts"
      kicker={
        pagination.total
          ? `${pagination.total} contact${pagination.total === 1 ? "" : "s"}`
          : "Manage workspace contacts"
      }
      actions={
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            className="search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search contacts..."
            style={{
              minWidth: 240,
            }}
          />

          <button className="btn primary" onClick={openCreateModal}>
            + New contact
          </button>
        </div>
      }
    >
      {error && (
        <div className="notice error">
          <b>Contacts</b>
          <span>{error}</span>
        </div>
      )}

      {/* FILTER BAR */}
      <section
        className="panel"
        style={{
          marginBottom: 16,
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              minWidth: 210,
              flex: 1,
            }}
          >
            Company
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="">All companies</option>

              {companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{
              minWidth: 160,
            }}
          >
            Status
            <select
              value={archiveFilter}
              onChange={(e) => setArchiveFilter(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All contacts</option>
            </select>
          </label>

          <button className="btn ghost" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      </section>

      <div className="contact-grid">
        {/* CONTACT LIST */}
        <section className="panel contact-list">
          <div
            className="filters"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <b>Contacts</b>

            {loading && (
              <span
                style={{
                  fontSize: 12,
                  opacity: 0.65,
                }}
              >
                Loading...
              </span>
            )}
          </div>

          {contacts.length === 0 ? (
            <Empty text="No contacts found." />
          ) : (
            contacts.map((contact) => (
              <button
                type="button"
                className={`contact-row ${
                  selected?._id === contact._id ? "selected" : ""
                }`}
                onClick={() => handleSelectContact(contact)}
                key={contact._id}
              >
                <span className="avatar">{getInitials(contact)}</span>

                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                    textAlign: "left",
                  }}
                >
                  <b
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getFullName(contact)}
                  </b>

                  <span
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {contact.jobTitle ||
                      getCompanyName(contact) ||
                      contact.email ||
                      "Contact"}
                  </span>

                  {contact.email && (
                    <small
                      style={{
                        opacity: 0.65,
                      }}
                    >
                      {contact.email}
                    </small>
                  )}
                </div>

                {contact.isArchived && <Badge>Archived</Badge>}
              </button>
            ))
          )}
        </section>

        {/* CONTACT DETAILS */}
        <section className="panel contact-detail">
          {!selected ? (
            <Empty text="Select a contact to view details." />
          ) : (
            <>
              {detailLoading ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: "center",
                  }}
                >
                  Loading contact details...
                </div>
              ) : (
                <>
                  <div
                    className="profile-head"
                    style={{
                      alignItems: "flex-start",
                    }}
                  >
                    <span className="avatar big">{getInitials(selected)}</span>

                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span className="eyebrow">
                        {selected.jobTitle || "Contact"}
                        {" · "}
                        {getCompanyName(selected)}
                      </span>

                      <h2>{getFullName(selected)}</h2>

                      <div
                        className="badges"
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <Badge>{selected.source || "Direct"}</Badge>

                        {selected.language && (
                          <Badge>{selected.language}</Badge>
                        )}

                        {selected.isArchived && <Badge>Archived</Badge>}
                      </div>
                    </div>

                    <div
                      className="actions"
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="btn ghost"
                        onClick={openEditModal}
                        disabled={actionLoading}
                      >
                        Edit
                      </button>

                      {!selected.isArchived && (
                        <button
                          className="btn ghost"
                          onClick={archiveContact}
                          disabled={actionLoading}
                        >
                          {actionLoading ? "Working..." : "Archive"}
                        </button>
                      )}

                      <button
                        className="btn ghost"
                        onClick={deleteContact}
                        disabled={actionLoading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <Info label="Email" value={selected.email || "—"} />

                    <Info label="Phone" value={selected.phone || "—"} />

                    <Info label="WhatsApp" value={selected.whatsapp || "—"} />

                    <Info label="Job title" value={selected.jobTitle || "—"} />

                    <Info label="Company" value={getCompanyName(selected)} />

                    <Info label="Source" value={selected.source || "—"} />

                    <Info label="Language" value={selected.language || "—"} />

                    <Info
                      label="Owner"
                      value={selected.ownerId?.name || "Assigned user"}
                    />

                    <Info
                      label="Created"
                      value={
                        selected.createdAt
                          ? new Date(selected.createdAt).toLocaleDateString()
                          : "—"
                      }
                    />

                    <Info
                      label="Updated"
                      value={
                        selected.updatedAt
                          ? new Date(selected.updatedAt).toLocaleDateString()
                          : "—"
                      }
                    />
                  </div>

                  {/* TAGS */}
                  {selected.tags?.length > 0 && (
                    <>
                      <SectionTitle title="Tags" />

                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          marginBottom: 18,
                        }}
                      >
                        {selected.tags.map((tag, index) => (
                          <Badge key={`${tag}-${index}`}>
                            {formatTag(tag)}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}

                  <SectionTitle title="Notes" />

                  <p className="detail-note">
                    {selected.notes || "No notes yet."}
                  </p>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {/* PAGINATION */}
      {pagination.totalPages > 1 && (
        <section
          className="panel"
          style={{
            marginTop: 16,
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              Showing{" "}
              {(pagination.page - 1) * pagination.limit +
                (contacts.length ? 1 : 0)}
              –{Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total}
            </span>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <button
                className="btn ghost"
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
              >
                Previous
              </button>

              <span
                style={{
                  minWidth: 90,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                className="btn ghost"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {/* CREATE / EDIT MODAL */}
      {modal && (
        <Modal
          title={editing ? "Edit contact" : "Create new contact"}
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
                onClick={saveContact}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Create contact"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <Field
              label="First name"
              required
              value={form.firstName}
              onChange={(value) => updateField("firstName", value)}
            />

            <Field
              label="Last name"
              required
              value={form.lastName}
              onChange={(value) => updateField("lastName", value)}
            />

            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) => updateField("email", value)}
            />

            <Field
              label="Phone"
              value={form.phone}
              onChange={(value) => updateField("phone", value)}
            />

            <Field
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(value) => updateField("whatsapp", value)}
            />

            <Field
              label="Job title"
              value={form.jobTitle}
              onChange={(value) => updateField("jobTitle", value)}
            />

            {/* COMPANY */}
            <label>
              Company
              <select
                value={form.companyId}
                onChange={(e) => updateField("companyId", e.target.value)}
              >
                <option value="">No company</option>

                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <Field
              label="Source"
              placeholder="website"
              value={form.source}
              onChange={(value) => updateField("source", value)}
            />

            {/* LANGUAGE */}
            <label>
              Language
              <select
                value={form.language}
                onChange={(e) => updateField("language", e.target.value)}
              >
                <option value="en">English</option>

                <option value="zh">Chinese</option>

                <option value="es">Spanish</option>
              </select>
            </label>

            {/* TAG DROPDOWN */}
            <label>
              Tag
              <select
                value={form.tags}
                onChange={(e) => updateField("tags", e.target.value)}
              >
                <option value="">Select a tag</option>

                {contactTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {formatTag(tag)}
                  </option>
                ))}
              </select>
              <small
                style={{
                  display: "block",
                  marginTop: 5,
                  opacity: 0.6,
                  fontSize: 12,
                }}
              >
                Select the contact category
              </small>
            </label>
          </div>

          {/* ARCHIVED */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 16,
            }}
          >
            <input
              type="checkbox"
              checked={form.isArchived}
              onChange={(e) => updateField("isArchived", e.target.checked)}
            />

            <span>Archived</span>
          </label>

          {/* NOTES */}
          <label
            style={{
              marginTop: 16,
            }}
          >
            Notes
            <textarea
              rows={5}
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Add notes about this contact..."
            />
          </label>
        </Modal>
      )}
    </Page>
  );
}

/* ------------------------------------------------------------
   Field component
------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
}) {
  return (
    <label>
      {label}

      {required && (
        <span
          style={{
            color: "var(--danger, #d33)",
            marginLeft: 3,
          }}
        >
          *
        </span>
      )}

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ------------------------------------------------------------
   Info component
------------------------------------------------------------ */

function Info({ label, value }) {
  return (
    <div
      style={{
        minWidth: 0,
      }}
    >
      <span className="eyebrow">{label}</span>

      <b
        style={{
          display: "block",
          marginTop: 3,
          wordBreak: "break-word",
        }}
      >
        {value}
      </b>
    </div>
  );
}
