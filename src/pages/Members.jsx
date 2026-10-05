import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "operator",
  phone: "",
  jobTitle: "",
  avatarUrl: "",
  isActive: true,
};

const ROLES = ["admin", "manager", "operator"];

export default function Members() {
  const { request, user } = useAuth();

  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [detailsModal, setDetailsModal] = useState(false);

  const [mode, setMode] = useState("create");
  const [selectedMember, setSelectedMember] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState({});

  /**
   * ---------------------------------------------------------
   * Helpers
   * ---------------------------------------------------------
   */

  function getErrorMessage(error) {
    if (!error) return "Something went wrong.";

    if (typeof error === "string") {
      return error;
    }

    return (
      error.message ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Something went wrong."
    );
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function closeModal() {
    if (saving) return;

    setModal(false);
    setMode("create");
    setSelectedMember(null);
    resetForm();
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFormErrors((current) => ({
      ...current,
      [field]: "",
    }));
  }

  /**
   * ---------------------------------------------------------
   * Load members
   * ---------------------------------------------------------
   */

  async function load() {
    try {
      setLoading(true);
      setError("");

      const response = await request("/members", {
        query: {
          status: "active",
        },
      });

      setRows(response?.data || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /**
   * ---------------------------------------------------------
   * Validation
   * ---------------------------------------------------------
   */

  function validateCreate() {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = "Name is required.";
    } else if (form.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters.";
    }

    if (!form.email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address.";
    }

    if (!form.password) {
      errors.password = "Password is required.";
    } else if (form.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (!ROLES.includes(form.role)) {
      errors.role = "Select a valid role.";
    }

    if (form.phone && form.phone.trim().length < 5) {
      errors.phone = "Enter a valid phone number.";
    }

    if (form.jobTitle && form.jobTitle.trim().length < 2) {
      errors.jobTitle = "Job title is too short.";
    }

    return errors;
  }

  function validateUpdate() {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = "Name is required.";
    } else if (form.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters.";
    }

    if (!ROLES.includes(form.role)) {
      errors.role = "Select a valid role.";
    }

    if (form.phone && form.phone.trim().length < 5) {
      errors.phone = "Enter a valid phone number.";
    }

    if (form.jobTitle && form.jobTitle.trim().length < 2) {
      errors.jobTitle = "Job title is too short.";
    }

    return errors;
  }

  /**
   * ---------------------------------------------------------
   * Open create modal
   * ---------------------------------------------------------
   */

  function openCreateModal() {
    setMode("create");
    setSelectedMember(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setError("");
    setModal(true);
  }

  /**
   * ---------------------------------------------------------
   * Get member details
   * ---------------------------------------------------------
   */

  async function getMemberDetails(id) {
    try {
      setDetailsLoading(true);
      setError("");

      const response = await request(`/members/${id}`);

      const member = response?.data;

      if (!member) {
        throw new Error("Member details were not found.");
      }

      setSelectedMember(member);
      setDetailsModal(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDetailsLoading(false);
    }
  }

  /**
   * ---------------------------------------------------------
   * Open edit modal
   * ---------------------------------------------------------
   */

  async function openEditModal(member) {
    try {
      setError("");
      setDetailsLoading(true);

      const response = await request(`/members/${member._id}`);

      const data = response?.data || member;

      setSelectedMember(data);

      setForm({
        name: data.name || "",
        email: data.email || "",
        password: "",
        role: data.role || "operator",
        phone: data.phone || "",
        jobTitle: data.jobTitle || "",
        avatarUrl: data.avatarUrl || "",
        isActive: data.isActive !== false,
      });

      setFormErrors({});
      setMode("edit");
      setModal(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDetailsLoading(false);
    }
  }

  /**
   * ---------------------------------------------------------
   * Create member
   * ---------------------------------------------------------
   */

  async function createMember() {
    const errors = validateCreate();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        phone: form.phone.trim(),
        jobTitle: form.jobTitle.trim(),
        avatarUrl: form.avatarUrl.trim(),
      };

      await request("/members", {
        method: "POST",
        body: payload,
      });

      closeModal();
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  /**
   * ---------------------------------------------------------
   * Update member
   * ---------------------------------------------------------
   */

  async function updateMember() {
    if (!selectedMember?._id) {
      setError("Member ID is missing.");
      return;
    }

    const errors = validateUpdate();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        jobTitle: form.jobTitle.trim(),
        role: form.role,
        isActive: form.isActive,
        preferences: selectedMember.preferences || {},
      };

      await request(`/members/${selectedMember._id}`, {
        method: "PATCH",
        body: payload,
      });

      closeModal();
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  /**
   * ---------------------------------------------------------
   * Delete / deactivate member
   * ---------------------------------------------------------
   */

  async function deactivateMember(member) {
    if (!member?._id) return;

    if (member._id === user?._id) {
      setError("You cannot deactivate your own account.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${member.name}"?`,
    );

    if (!confirmed) return;

    try {
      setDeletingId(member._id);
      setError("");

      await request(`/members/${member._id}`, {
        method: "DELETE",
      });

      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeletingId(null);
    }
  }

  /**
   * ---------------------------------------------------------
   * Permissions
   * ---------------------------------------------------------
   */

  const canManageMembers = user?.role === "admin" || user?.role === "manager";

  const canDeleteMembers = user?.role === "admin";

  /**
   * ---------------------------------------------------------
   * Render
   * ---------------------------------------------------------
   */

  return (
    <Page
      title="Members"
      kicker="Workspace team access"
      actions={
        canManageMembers && (
          <button
            className="btn primary"
            onClick={openCreateModal}
            disabled={loading}
          >
            Add member
          </button>
        )
      }
    >
      {/* Global error */}
      {error && (
        <div className="notice error">
          <b>Members</b>
          <span>{error}</span>

          <button
            className="btn ghost"
            onClick={() => setError("")}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Job title</th>
              <th>Last login</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>
                  Loading members...
                </td>
              </tr>
            ) : (
              rows.map((member) => (
                <tr key={member._id}>
                  <td>
                    <div>
                      <b>{member.name}</b>
                      <span>{member.email}</span>
                    </div>
                  </td>

                  <td>
                    <Badge>{member.role}</Badge>
                  </td>

                  <td>{member.jobTitle || "—"}</td>

                  <td>
                    {member.lastLoginAt
                      ? new Date(member.lastLoginAt).toLocaleString()
                      : "Never"}
                  </td>

                  <td>{member.isActive ? "Active" : "Inactive"}</td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => getMemberDetails(member._id)}
                      >
                        View
                      </button>

                      {canManageMembers && (
                        <button
                          className="btn ghost"
                          type="button"
                          disabled={detailsLoading}
                          onClick={() => openEditModal(member)}
                        >
                          Edit
                        </button>
                      )}

                      {canDeleteMembers && member._id !== user?._id && (
                        <button
                          className="btn ghost"
                          type="button"
                          disabled={deletingId === member._id}
                          onClick={() => deactivateMember(member)}
                        >
                          {deletingId === member._id
                            ? "Deactivating..."
                            : "Deactivate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && rows.length === 0 && (
          <Empty text="No active members found." />
        )}
      </section>

      {/* =====================================================
          CREATE / EDIT MODAL
          ===================================================== */}

      {modal && (
        <Modal
          title={mode === "create" ? "Add member" : "Edit member"}
          onClose={closeModal}
          actions={
            <>
              <button
                className="btn ghost"
                onClick={closeModal}
                disabled={saving}
                type="button"
              >
                Cancel
              </button>

              <button
                className="btn primary"
                onClick={mode === "create" ? createMember : updateMember}
                disabled={saving}
                type="button"
              >
                {saving
                  ? mode === "create"
                    ? "Creating..."
                    : "Saving..."
                  : mode === "create"
                    ? "Create member"
                    : "Save changes"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            {/* Name */}
            <label>
              Name
              <input
                type="text"
                value={form.name}
                placeholder="e.g. John Doe"
                disabled={saving}
                onChange={(e) => updateField("name", e.target.value)}
              />
              {formErrors.name && (
                <small className="field-error">{formErrors.name}</small>
              )}
            </label>

            {/* Email */}
            <label>
              Email
              <input
                type="email"
                value={form.email}
                placeholder="john@example.com"
                disabled={saving || mode === "edit"}
                onChange={(e) => updateField("email", e.target.value)}
              />
              {formErrors.email && (
                <small className="field-error">{formErrors.email}</small>
              )}
            </label>

            {/* Password - create only */}
            {mode === "create" && (
              <label>
                Password
                <input
                  type="password"
                  value={form.password}
                  placeholder="Minimum 8 characters"
                  disabled={saving}
                  onChange={(e) => updateField("password", e.target.value)}
                />
                {formErrors.password && (
                  <small className="field-error">{formErrors.password}</small>
                )}
              </label>
            )}

            {/* Role */}
            <label>
              Role
              <select
                value={form.role}
                disabled={saving}
                onChange={(e) => updateField("role", e.target.value)}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
              {formErrors.role && (
                <small className="field-error">{formErrors.role}</small>
              )}
            </label>

            {/* Phone */}
            <label>
              Phone
              <input
                type="text"
                value={form.phone}
                placeholder="+85200000001"
                disabled={saving}
                onChange={(e) => updateField("phone", e.target.value)}
              />
              {formErrors.phone && (
                <small className="field-error">{formErrors.phone}</small>
              )}
            </label>

            {/* Job title */}
            <label>
              Job title
              <input
                type="text"
                value={form.jobTitle}
                placeholder="Operator"
                disabled={saving}
                onChange={(e) => updateField("jobTitle", e.target.value)}
              />
              {formErrors.jobTitle && (
                <small className="field-error">{formErrors.jobTitle}</small>
              )}
            </label>

            {/* Avatar URL */}
            <label>
              Avatar URL
              <input
                type="url"
                value={form.avatarUrl}
                placeholder="https://..."
                disabled={saving}
                onChange={(e) => updateField("avatarUrl", e.target.value)}
              />
            </label>

            {/* Status - edit only */}
            {mode === "edit" && (
              <label>
                Status
                <select
                  value={form.isActive ? "active" : "inactive"}
                  disabled={saving || selectedMember?._id === user?._id}
                  onChange={(e) =>
                    updateField("isActive", e.target.value === "active")
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            )}
          </div>
        </Modal>
      )}

      {/* =====================================================
          MEMBER DETAILS MODAL
          ===================================================== */}

      {detailsModal && selectedMember && (
        <Modal
          title="Member details"
          onClose={() => {
            if (!detailsLoading) {
              setDetailsModal(false);
              setSelectedMember(null);
            }
          }}
          actions={
            <>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setDetailsModal(false);
                  setSelectedMember(null);
                }}
              >
                Close
              </button>

              {canManageMembers && (
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => {
                    setDetailsModal(false);
                    openEditModal(selectedMember);
                  }}
                >
                  Edit member
                </button>
              )}
            </>
          }
        >
          <div className="form-grid">
            <div>
              <strong>Name</strong>
              <div>{selectedMember.name || "—"}</div>
            </div>

            <div>
              <strong>Email</strong>
              <div>{selectedMember.email || "—"}</div>
            </div>

            <div>
              <strong>Role</strong>
              <div>
                <Badge>{selectedMember.role}</Badge>
              </div>
            </div>

            <div>
              <strong>Status</strong>
              <div>{selectedMember.isActive ? "Active" : "Inactive"}</div>
            </div>

            <div>
              <strong>Phone</strong>
              <div>{selectedMember.phone || "—"}</div>
            </div>

            <div>
              <strong>Job title</strong>
              <div>{selectedMember.jobTitle || "—"}</div>
            </div>

            <div>
              <strong>Last login</strong>
              <div>
                {selectedMember.lastLoginAt
                  ? new Date(selectedMember.lastLoginAt).toLocaleString()
                  : "Never"}
              </div>
            </div>

            <div>
              <strong>Created</strong>
              <div>
                {selectedMember.createdAt
                  ? new Date(selectedMember.createdAt).toLocaleString()
                  : "—"}
              </div>
            </div>

            <div>
              <strong>Updated</strong>
              <div>
                {selectedMember.updatedAt
                  ? new Date(selectedMember.updatedAt).toLocaleString()
                  : "—"}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Page>
  );
}
