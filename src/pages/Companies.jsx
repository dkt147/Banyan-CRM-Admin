import React, { useEffect, useState } from "react";
import { Page, Empty, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const PAGE_SIZE = 25;

const blank = {
  name: "",
  legalName: "",
  industry: "",
  website: "",
  email: "",
  phone: "",
  street: "",
  city: "",
  country: "",
  postalCode: "",
  tags: "",
  notes: "",
  isArchived: false,
};

export default function Companies() {
  const { request } = useAuth();

  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  /*
   * ---------------------------------------------------------
   * LOAD COMPANIES
   * ---------------------------------------------------------
   */
  async function loadCompanies(targetPage = page) {
    setLoading(true);
    setError("");

    try {
      const query = {
        page: targetPage,
        limit: PAGE_SIZE,
        search: search || "",
        isArchived:
          status === "all"
            ? undefined
            : status === "archived"
              ? "true"
              : "false",
        sort,
        order,
      };

      const r = await request("/companies", {
        query,
      });

      /*
       * API RESPONSE:
       *
       * data: [...]
       * pagination: {
       *   page,
       *   limit,
       *   total,
       *   totalPages
       * }
       */

      const companies = Array.isArray(r.data) ? r.data : [];

      setRows(companies);

      const pagination = r.pagination || {};

      setPage(Number(pagination.page || targetPage));
      setTotalPages(Number(pagination.totalPages || 1));
      setTotal(Number(pagination.total || companies.length));

      /*
       * Keep selected company if it still exists.
       * Otherwise select first company.
       */
      setSelected((current) => {
        if (!current) {
          return companies[0] || null;
        }

        const existing = companies.find(
          (company) => company._id === current._id,
        );

        return existing || companies[0] || null;
      });
    } catch (e) {
      setError(e.message || "Failed to load companies.");
      setRows([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  /*
   * Reload whenever filters/sorting/page changes.
   */
  useEffect(() => {
    loadCompanies(page);
  }, [page, search, status, sort, order]);

  /*
   * ---------------------------------------------------------
   * GET COMPANY DETAILS
   * ---------------------------------------------------------
   */
  async function loadCompanyDetails(company) {
    if (!company?._id) return;

    setDetailLoading(true);
    setError("");

    try {
      const r = await request(`/companies/${company._id}`);

      if (r.data) {
        setSelected(r.data);
      }
    } catch (e) {
      setError(e.message || "Failed to load company details.");
    } finally {
      setDetailLoading(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * SELECT COMPANY
   * ---------------------------------------------------------
   */
  function selectCompany(company) {
    setSelected(company);
    loadCompanyDetails(company);
  }

  /*
   * ---------------------------------------------------------
   * OPEN CREATE / EDIT MODAL
   * ---------------------------------------------------------
   */
  function open(company = null) {
    if (company) {
      setSelected(company);

      setForm({
        name: company.name || "",
        legalName: company.legalName || "",
        industry: company.industry || "",
        website: company.website || "",
        email: company.email || "",
        phone: company.phone || "",

        street: company.address?.street || "",
        city: company.address?.city || "",
        country: company.address?.country || "",
        postalCode: company.address?.postalCode || "",

        tags: Array.isArray(company.tags)
          ? company.tags.join(", ")
          : company.tags || "",

        notes: company.notes || "",
        isArchived: Boolean(company.isArchived),
      });
    } else {
      setForm(blank);
    }

    setError("");
    setModal(true);
  }

  /*
   * ---------------------------------------------------------
   * FORM CHANGE
   * ---------------------------------------------------------
   */
  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /*
   * ---------------------------------------------------------
   * CREATE / UPDATE COMPANY
   * ---------------------------------------------------------
   */
  async function save() {
    if (!form.name.trim()) {
      setError("Company name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const tags = form.tags
        ? form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

      const body = {
        name: form.name.trim(),
        legalName: form.legalName.trim() || null,
        industry: form.industry.trim() || null,
        website: form.website.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,

        address: {
          street: form.street.trim() || null,
          city: form.city.trim() || null,
          country: form.country.trim() || null,
          postalCode: form.postalCode.trim() || null,
        },

        tags,

        notes: form.notes.trim() || null,

        isArchived: Boolean(form.isArchived),
      };

      if (selected?._id) {
        await request(`/companies/${selected._id}`, {
          method: "PATCH",
          body,
        });
      } else {
        await request("/companies", {
          method: "POST",
          body,
        });
      }

      setModal(false);

      /*
       * After create/update reload current page.
       */
      await loadCompanies(page);
    } catch (e) {
      setError(e.message || "Failed to save company.");
    } finally {
      setSaving(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * ARCHIVE
   * ---------------------------------------------------------
   */
  async function archive(id) {
    if (!id) return;

    const confirmed = window.confirm(
      "Archive this company?\n\nThe company will no longer appear in the active companies list.",
    );

    if (!confirmed) return;

    setError("");

    try {
      await request(`/companies/${id}/archive`, {
        method: "PATCH",
      });

      /*
       * If viewing active companies, remove it from current UI.
       */
      setRows((current) => current.filter((company) => company._id !== id));

      setSelected(null);

      await loadCompanies(page);
    } catch (e) {
      setError(e.message || "Failed to archive company.");
    }
  }

  /*
   * ---------------------------------------------------------
   * DELETE
   * ---------------------------------------------------------
   */
  async function remove(id) {
    if (!id) return;

    const confirmed = window.confirm(
      "Delete this company permanently?\n\nThis action cannot be undone.",
    );

    if (!confirmed) return;

    setError("");

    try {
      await request(`/companies/${id}`, {
        method: "DELETE",
      });

      setRows((current) => current.filter((company) => company._id !== id));

      setSelected(null);

      /*
       * If last item on a page was deleted,
       * move back one page when possible.
       */
      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadCompanies(page);
      }
    } catch (e) {
      setError(e.message || "Failed to delete company.");
    }
  }

  /*
   * ---------------------------------------------------------
   * PAGINATION
   * ---------------------------------------------------------
   */
  function goToPage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }

    setSelected(null);
    setPage(nextPage);
  }

  /*
   * ---------------------------------------------------------
   * SEARCH
   * ---------------------------------------------------------
   */
  function handleSearchChange(e) {
    setSearch(e.target.value);
    setPage(1);
  }

  /*
   * ---------------------------------------------------------
   * STATUS FILTER
   * ---------------------------------------------------------
   */
  function handleStatusChange(e) {
    setStatus(e.target.value);
    setPage(1);
    setSelected(null);
  }

  /*
   * ---------------------------------------------------------
   * SORT
   * ---------------------------------------------------------
   */
  function handleSortChange(e) {
    const value = e.target.value;

    if (value === "createdAt-desc") {
      setSort("createdAt");
      setOrder("desc");
    } else if (value === "createdAt-asc") {
      setSort("createdAt");
      setOrder("asc");
    } else if (value === "name-asc") {
      setSort("name");
      setOrder("asc");
    } else if (value === "name-desc") {
      setSort("name");
      setOrder("desc");
    }

    setPage(1);
  }

  return (
    <Page
      title="Companies"
      kicker="Organizations and accounts"
      actions={
        <button className="btn primary" onClick={() => open()}>
          + New company
        </button>
      }
    >
      {/* -------------------------------------------------- */}
      {/* ERROR */}
      {/* -------------------------------------------------- */}

      {error && (
        <div className="notice error">
          <b>Companies</b>
          <span>{error}</span>

          <button
            className="btn ghost"
            onClick={() => setError("")}
            style={{ marginLeft: "auto" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* FILTER TOOLBAR */}
      {/* -------------------------------------------------- */}

      <div className="toolbar" style={{ gap: 10, flexWrap: "wrap" }}>
        <input
          placeholder="Search companies…"
          value={search}
          onChange={handleSearchChange}
          style={{
            minWidth: 240,
            flex: 1,
          }}
        />

        <select value={status} onChange={handleStatusChange}>
          <option value="active">Active companies</option>
          <option value="archived">Archived companies</option>
          <option value="all">All companies</option>
        </select>

        <select value={`${sort}-${order}`} onChange={handleSortChange}>
          <option value="createdAt-desc">Newest first</option>
          <option value="createdAt-asc">Oldest first</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
        </select>

        <span style={{ whiteSpace: "nowrap" }}>
          {total} {status === "archived" ? "archived" : "companies"}
        </span>
      </div>

      {/* -------------------------------------------------- */}
      {/* MAIN CONTENT */}
      {/* -------------------------------------------------- */}

      <div className="contact-grid">
        {/* ------------------------------------------------ */}
        {/* COMPANY LIST */}
        {/* ------------------------------------------------ */}

        <section className="panel contact-list">
          {loading ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              Loading companies…
            </div>
          ) : rows.length === 0 ? (
            <Empty
              text={
                search
                  ? "No companies match your search."
                  : "No companies found."
              }
            />
          ) : (
            rows.map((company) => {
              const isSelected = selected?._id === company._id;

              return (
                <button
                  type="button"
                  className={`contact-row ${isSelected ? "selected" : ""}`}
                  key={company._id}
                  onClick={() => selectCompany(company)}
                >
                  <span className="avatar">
                    {(company.name || "C").charAt(0).toUpperCase()}
                  </span>

                  <div
                    style={{
                      minWidth: 0,
                      textAlign: "left",
                      flex: 1,
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
                      {company.name}
                    </b>

                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {company.industry || company.email || "Company"}
                    </span>
                  </div>

                  {company.isArchived && <Badge>Archived</Badge>}
                </button>
              );
            })
          )}
        </section>

        {/* ------------------------------------------------ */}
        {/* COMPANY DETAIL */}
        {/* ------------------------------------------------ */}

        <section className="panel contact-detail">
          {!selected ? (
            <Empty text="Select a company to view its details." />
          ) : detailLoading ? (
            <div style={{ padding: 30, textAlign: "center" }}>
              Loading company details…
            </div>
          ) : (
            <>
              {/* PROFILE HEADER */}

              <div className="profile-head">
                <div style={{ minWidth: 0 }}>
                  <span className="eyebrow">Company</span>

                  <h2
                    style={{
                      marginBottom: 6,
                      wordBreak: "break-word",
                    }}
                  >
                    {selected.name}
                  </h2>

                  {selected.industry && <span>{selected.industry}</span>}
                </div>

                <div
                  className="actions"
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button className="btn ghost" onClick={() => open(selected)}>
                    Edit
                  </button>

                  {!selected.isArchived && (
                    <button
                      className="btn ghost"
                      onClick={() => archive(selected._id)}
                    >
                      Archive
                    </button>
                  )}

                  <button
                    className="btn ghost"
                    onClick={() => remove(selected._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* COMPANY STATUS */}

              {selected.isArchived && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(180, 120, 20, 0.08)",
                  }}
                >
                  <b>Archived company</b>
                  <span style={{ marginLeft: 8 }}>
                    This company is currently archived.
                  </span>
                </div>
              )}

              {/* DETAILS */}

              <div className="detail-grid">
                <Info label="Legal name" value={selected.legalName || "—"} />

                <Info label="Industry" value={selected.industry || "—"} />

                <Info label="Email" value={selected.email || "—"} />

                <Info label="Phone" value={selected.phone || "—"} />

                <Info label="Website" value={selected.website || "—"} />

                <Info label="Street" value={selected.address?.street || "—"} />

                <Info label="City" value={selected.address?.city || "—"} />

                <Info
                  label="Country"
                  value={selected.address?.country || "—"}
                />

                <Info
                  label="Postal code"
                  value={selected.address?.postalCode || "—"}
                />
              </div>

              {/* TAGS */}

              {Array.isArray(selected.tags) && selected.tags.length > 0 && (
                <>
                  <SectionTitle title="Tags" />

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 22,
                    }}
                  >
                    {selected.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </>
              )}

              {/* NOTES */}

              <SectionTitle title="Notes" />

              <p className="detail-note">{selected.notes || "No notes."}</p>

              {/* META */}

              <div
                style={{
                  marginTop: 24,
                  paddingTop: 18,
                  borderTop: "1px solid var(--border, #e5e7eb)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 14,
                }}
              >
                <Info label="Created" value={formatDate(selected.createdAt)} />

                <Info
                  label="Last updated"
                  value={formatDate(selected.updatedAt)}
                />
              </div>
            </>
          )}
        </section>
      </div>

      {/* -------------------------------------------------- */}
      {/* PAGINATION */}
      {/* -------------------------------------------------- */}

      {totalPages > 1 && (
        <div
          className="toolbar"
          style={{
            justifyContent: "space-between",
            marginTop: 16,
          }}
        >
          <span>
            Page {page} of {totalPages}
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <button
              className="btn ghost"
              disabled={page <= 1 || loading}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>

            <PageNumbers
              page={page}
              totalPages={totalPages}
              onPageChange={goToPage}
              disabled={loading}
            />

            <button
              className="btn ghost"
              disabled={page >= totalPages || loading}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* CREATE / EDIT MODAL */}
      {/* -------------------------------------------------- */}

      {modal && (
        <Modal
          title={selected ? "Edit company" : "New company"}
          onClose={() => {
            if (!saving) {
              setModal(false);
            }
          }}
          actions={
            <>
              <button
                className="btn ghost"
                disabled={saving}
                onClick={() => setModal(false)}
              >
                Cancel
              </button>

              <button className="btn primary" disabled={saving} onClick={save}>
                {saving
                  ? "Saving…"
                  : selected
                    ? "Update company"
                    : "Create company"}
              </button>
            </>
          }
        >
          <div
            className="form-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <Field
              label="Company name"
              value={form.name}
              onChange={(value) => updateField("name", value)}
              required
            />

            <Field
              label="Legal name"
              value={form.legalName}
              onChange={(value) => updateField("legalName", value)}
            />

            <Field
              label="Industry"
              value={form.industry}
              onChange={(value) => updateField("industry", value)}
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
              label="Website"
              value={form.website}
              onChange={(value) => updateField("website", value)}
              placeholder="https://example.com"
            />

            <Field
              label="Street"
              value={form.street}
              onChange={(value) => updateField("street", value)}
            />

            <Field
              label="City"
              value={form.city}
              onChange={(value) => updateField("city", value)}
            />

            <Field
              label="Country"
              value={form.country}
              onChange={(value) => updateField("country", value)}
            />

            <Field
              label="Postal code"
              value={form.postalCode}
              onChange={(value) => updateField("postalCode", value)}
            />

            <Field
              label="Tags"
              value={form.tags}
              onChange={(value) => updateField("tags", value)}
              placeholder="prospect, vip"
            />
          </div>

          <label style={{ marginTop: 16 }}>
            Notes
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Add company notes…"
            />
          </label>

          <div style={{ marginTop: 16 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(form.isArchived)}
                onChange={(e) => updateField("isArchived", e.target.checked)}
              />

              <span>Archived</span>
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}

/*
 * ---------------------------------------------------------
 * FIELD
 * ---------------------------------------------------------
 */

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
}) {
  return (
    <label>
      {label}
      {required && <span> *</span>}

      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/*
 * ---------------------------------------------------------
 * INFO
 * ---------------------------------------------------------
 */

function Info({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span className="eyebrow">{label}</span>

      <b
        style={{
          display: "block",
          marginTop: 4,
          wordBreak: "break-word",
        }}
      >
        {value}
      </b>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * PAGINATION NUMBERS
 * ---------------------------------------------------------
 */

function PageNumbers({ page, totalPages, onPageChange, disabled }) {
  const pages = [];

  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, page + 2);

  if (page <= 3) {
    end = Math.min(totalPages, 5);
  }

  if (page >= totalPages - 2) {
    start = Math.max(1, totalPages - 4);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        alignItems: "center",
      }}
    >
      {start > 1 && (
        <>
          <button
            className="btn ghost"
            disabled={disabled}
            onClick={() => onPageChange(1)}
          >
            1
          </button>

          {start > 2 && <span>…</span>}
        </>
      )}

      {pages.map((number) => (
        <button
          key={number}
          className={`btn ${number === page ? "primary" : "ghost"}`}
          disabled={disabled}
          onClick={() => onPageChange(number)}
          style={{
            minWidth: 38,
          }}
        >
          {number}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span>…</span>}

          <button
            className="btn ghost"
            disabled={disabled}
            onClick={() => onPageChange(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * DATE FORMAT
 * ---------------------------------------------------------
 */

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
