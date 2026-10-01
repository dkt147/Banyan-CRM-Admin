import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";

const formatDate = (date) => {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date) => {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value, currency = "HKD") => {
  const number = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(number);
  } catch {
    return `${currency} ${number.toLocaleString()}`;
  }
};

function DetailRow({ label, value }) {
  return (
    <div className="deal-detail-row">
      <div className="deal-detail-label">{label}</div>
      <div className="deal-detail-value">{value || "—"}</div>
    </div>
  );
}

function Modal({ children, onClose, width = 620 }) {
  return (
    <div
      className="deal-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="deal-modal"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default function Deal() {
  const { request } = useAuth();

  const [deals, setDeals] = useState([]);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);

  const [editDeal, setEditDeal] = useState(null);
  const [detailDeal, setDetailDeal] = useState(null);

  const [detailLoading, setDetailLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [editForm, setEditForm] = useState({
    title: "",
    value: "",
    description: "",
  });

  const loadDeals = async () => {
    try {
      setError("");
      setLoading(true);

      const response = await request("/deals", {
        query: {
          page: 1,
          limit: 100,
        },
      });

      setDeals(response.data?.items || []);
    } catch (e) {
      setError(e.message || "Failed to load deals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, []);

  const openEditModal = (deal) => {
    setError("");

    setEditForm({
      title: deal.title || "",
      value:
        deal.value !== undefined && deal.value !== null
          ? String(deal.value)
          : "",
      description: deal.description || "",
    });

    setEditDeal(deal);
  };

  const closeEditModal = () => {
    if (saving) return;

    setEditDeal(null);

    setEditForm({
      title: "",
      value: "",
      description: "",
    });
  };

  const handleEditChange = (field, value) => {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleUpdateDeal = async (e) => {
    e.preventDefault();

    if (!editDeal) return;

    const title = editForm.title.trim();

    if (!title) {
      setError("Deal title is required.");
      return;
    }

    const numericValue = editForm.value === "" ? 0 : Number(editForm.value);

    if (Number.isNaN(numericValue) || numericValue < 0) {
      setError("Deal value must be a valid positive number.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await request(`/deals/${editDeal._id}`, {
        method: "PATCH",
        body: {
          title,
          value: numericValue,
          description: editForm.description.trim(),
        },
      });

      const updatedDeal = response.data;

      if (updatedDeal) {
        setDeals((currentDeals) =>
          currentDeals.map((deal) =>
            deal._id === updatedDeal._id ? updatedDeal : deal,
          ),
        );
      } else {
        await loadDeals();
      }

      closeEditModal();
    } catch (e) {
      setError(e.message || "Failed to update deal.");
    } finally {
      setSaving(false);
    }
  };

  const openDealDetails = async (deal) => {
    try {
      setError("");
      setDetailLoading(true);
      setDetailDeal(deal);

      const response = await request(`/deals/${deal._id}`);

      if (response.data) {
        setDetailDeal(response.data);
      }
    } catch (e) {
      setError(e.message || "Failed to load deal details.");
      setDetailDeal(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailsModal = () => {
    if (detailLoading) return;

    setDetailDeal(null);
  };

  const handleDeleteDeal = async (deal) => {
    const confirmed = window.confirm(
      `Delete "${deal.title}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setDeletingId(deal._id);
      setError("");

      await request(`/deals/${deal._id}`, {
        method: "DELETE",
      });

      setDeals((currentDeals) =>
        currentDeals.filter((item) => item._id !== deal._id),
      );

      if (detailDeal?._id === deal._id) {
        setDetailDeal(null);
      }

      if (editDeal?._id === deal._id) {
        setEditDeal(null);
      }
    } catch (e) {
      setError(e.message || "Failed to delete deal.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Page title="Deals" kicker="All workspace deals">
      <style>{`
        .deals-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .deals-count {
          font-size: 14px;
          color: #666;
        }

        .deals-table-wrap {
          overflow-x: auto;
        }

        .deals-table {
          width: 100%;
          min-width: 950px;
          border-collapse: collapse;
        }

        .deals-table th {
          white-space: nowrap;
          padding: 13px 14px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid #e5e5e5;
        }

        .deals-table td {
          padding: 14px;
          border-bottom: 1px solid #ededed;
          vertical-align: middle;
        }

        .deal-row {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .deal-row:hover {
          background: #fafafa;
        }

        .deal-title-cell {
          min-width: 190px;
        }

        .deal-title {
          display: block;
          font-weight: 700;
          color: #222;
          margin-bottom: 4px;
        }

        .deal-subtitle {
          display: block;
          font-size: 12px;
          color: #777;
        }

        .deal-contact {
          min-width: 150px;
        }

        .deal-contact-name {
          font-weight: 600;
        }

        .deal-contact-email {
          display: block;
          margin-top: 3px;
          font-size: 12px;
          color: #777;
        }

        .deal-actions {
          display: flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
        }

        .deal-actions .btn {
          min-width: 62px;
        }

        .deal-hint {
          margin-top: 10px;
          font-size: 12px;
          color: #888;
        }

        .deal-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(2px);
        }

        .deal-modal {
          width: 100%;
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          animation: dealModalIn 0.16s ease-out;
        }

        @keyframes dealModalIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.99);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .deal-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 24px;
          border-bottom: 1px solid #ededed;
        }

        .deal-modal-title {
          margin: 0;
          font-size: 20px;
          font-weight: 750;
          color: #222;
        }

        .deal-modal-subtitle {
          margin-top: 5px;
          font-size: 13px;
          color: #777;
        }

        .deal-modal-close {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border: 1px solid #ddd;
          border-radius: 7px;
          background: #fff;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          color: #555;
        }

        .deal-modal-close:hover {
          background: #f5f5f5;
        }

        .deal-modal-body {
          padding: 24px;
        }

        .deal-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 24px;
          border-top: 1px solid #ededed;
          background: #fafafa;
        }

        .deal-form-group {
          margin-bottom: 18px;
        }

        .deal-form-label {
          display: block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 650;
          color: #333;
        }

        .deal-form-input,
        .deal-form-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d8d8d8;
          border-radius: 7px;
          padding: 10px 12px;
          font: inherit;
          color: #222;
          background: #fff;
          outline: none;
        }

        .deal-form-input:focus,
        .deal-form-textarea:focus {
          border-color: #888;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05);
        }

        .deal-form-textarea {
          min-height: 110px;
          resize: vertical;
        }

        .deal-form-grid {
          display: grid;
          grid-template-columns: 1fr 180px;
          gap: 16px;
        }

        .deal-details-section {
          margin-bottom: 24px;
        }

        .deal-section-title {
          margin: 0 0 12px;
          font-size: 13px;
          font-weight: 750;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .deal-details-card {
          border: 1px solid #e8e8e8;
          border-radius: 9px;
          overflow: hidden;
        }

        .deal-detail-row {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 20px;
          padding: 12px 14px;
          border-bottom: 1px solid #ededed;
        }

        .deal-detail-row:last-child {
          border-bottom: 0;
        }

        .deal-detail-label {
          color: #777;
          font-size: 13px;
        }

        .deal-detail-value {
          color: #222;
          font-size: 13px;
          font-weight: 550;
          word-break: break-word;
        }

        .deal-description {
          white-space: pre-wrap;
          line-height: 1.55;
          color: #444;
        }

        .deal-loading {
          padding: 40px;
          text-align: center;
          color: #777;
        }

        .deal-error {
          margin-bottom: 16px;
          padding: 12px 14px;
          border: 1px solid #f0caca;
          border-radius: 7px;
          background: #fff5f5;
          color: #a33;
        }

        .deal-detail-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
          padding: 16px;
          border: 1px solid #e8e8e8;
          border-radius: 9px;
          background: #fafafa;
        }

        .deal-detail-price {
          font-size: 24px;
          font-weight: 800;
          color: #222;
        }

        .deal-detail-price-label {
          margin-top: 3px;
          font-size: 12px;
          color: #777;
        }

        @media (max-width: 700px) {
          .deal-modal-backdrop {
            padding: 10px;
          }

          .deal-modal-header,
          .deal-modal-body {
            padding: 18px;
          }

          .deal-modal-footer {
            padding: 14px 18px;
          }

          .deal-form-grid {
            grid-template-columns: 1fr;
          }

          .deal-detail-row {
            grid-template-columns: 1fr;
            gap: 5px;
          }

          .deal-detail-top {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="deals-toolbar">
        <div className="deals-count">
          <b>{deals.length}</b> {deals.length === 1 ? "deal" : "deals"}
        </div>

        <button className="btn ghost" onClick={loadDeals} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="deal-error">
          <b>Deals:</b> {error}
        </div>
      )}

      <section className="panel table-wrap deals-table-wrap">
        <table className="deals-table">
          <thead>
            <tr>
              <th>Deal</th>
              <th>Contact</th>
              <th>Company</th>
              <th>Pipeline</th>
              <th>Stage</th>
              <th>Value</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {deals.map((d) => {
              const contactName = [
                d.contactId?.firstName,
                d.contactId?.lastName,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <tr
                  key={d._id}
                  className="deal-row"
                  onDoubleClick={() => openDealDetails(d)}
                  title="Double-click to view deal details"
                >
                  <td className="deal-title-cell">
                    <span className="deal-title">
                      {d.title || "Untitled deal"}
                    </span>

                    <span className="deal-subtitle">
                      {d.productType || "No product type"}
                    </span>
                  </td>

                  <td className="deal-contact">
                    <span className="deal-contact-name">
                      {contactName || "—"}
                    </span>

                    {d.contactId?.email && (
                      <span className="deal-contact-email">
                        {d.contactId.email}
                      </span>
                    )}
                  </td>

                  <td>{d.companyId?.name || "—"}</td>

                  <td>{d.pipelineId?.name || "—"}</td>

                  <td>
                    <Badge>{d.stageId?.name || "—"}</Badge>
                  </td>

                  <td>
                    <b>{formatCurrency(d.value, d.currency)}</b>
                  </td>

                  <td>
                    <Badge>{d.status || "—"}</Badge>
                  </td>

                  <td>
                    <div className="deal-actions">
                      <button
                        className="btn ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(d);
                        }}
                      >
                        Edit
                      </button>

                      <button
                        className="btn ghost"
                        disabled={deletingId === d._id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDeal(d);
                        }}
                      >
                        {deletingId === d._id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {loading && deals.length === 0 && (
          <div className="deal-loading">Loading deals...</div>
        )}

        {!loading && deals.length === 0 && <Empty text="No deals found." />}
      </section>

      <div className="deal-hint">
        Double-click a deal row to view its complete details.
      </div>

      {/* =========================
          EDIT DEAL MODAL
      ========================== */}

      {editDeal && (
        <Modal onClose={closeEditModal} width={620}>
          <form onSubmit={handleUpdateDeal}>
            <div className="deal-modal-header">
              <div>
                <h2 className="deal-modal-title">Edit Deal</h2>

                <div className="deal-modal-subtitle">
                  Update the deal information below.
                </div>
              </div>

              <button
                type="button"
                className="deal-modal-close"
                onClick={closeEditModal}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="deal-modal-body">
              <div className="deal-form-grid">
                <div className="deal-form-group">
                  <label className="deal-form-label">Deal title</label>

                  <input
                    className="deal-form-input"
                    type="text"
                    value={editForm.title}
                    onChange={(e) => handleEditChange("title", e.target.value)}
                    placeholder="Enter deal title"
                    autoFocus
                  />
                </div>

                <div className="deal-form-group">
                  <label className="deal-form-label">Value</label>

                  <input
                    className="deal-form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.value}
                    onChange={(e) => handleEditChange("value", e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="deal-form-group">
                <label className="deal-form-label">Description</label>

                <textarea
                  className="deal-form-textarea"
                  value={editForm.description}
                  onChange={(e) =>
                    handleEditChange("description", e.target.value)
                  }
                  placeholder="Enter deal description"
                />
              </div>
            </div>

            <div className="deal-modal-footer">
              <button
                type="button"
                className="btn ghost"
                onClick={closeEditModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button type="submit" className="btn" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================
          DEAL DETAILS MODAL
      ========================== */}

      {detailDeal && (
        <Modal onClose={closeDetailsModal} width={760}>
          <div className="deal-modal-header">
            <div>
              <h2 className="deal-modal-title">
                {detailDeal.title || "Deal details"}
              </h2>

              <div className="deal-modal-subtitle">
                Complete deal information
              </div>
            </div>

            <button
              type="button"
              className="deal-modal-close"
              onClick={closeDetailsModal}
              disabled={detailLoading}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="deal-modal-body">
            {detailLoading ? (
              <div className="deal-loading">Loading deal details...</div>
            ) : (
              <>
                <div className="deal-detail-top">
                  <div>
                    <div className="deal-detail-price">
                      {formatCurrency(detailDeal.value, detailDeal.currency)}
                    </div>

                    <div className="deal-detail-price-label">Deal value</div>
                  </div>

                  <Badge>{detailDeal.status || "—"}</Badge>
                </div>

                <div className="deal-details-section">
                  <h3 className="deal-section-title">Deal information</h3>

                  <div className="deal-details-card">
                    <DetailRow label="Deal ID" value={detailDeal._id} />

                    <DetailRow label="Title" value={detailDeal.title} />

                    <DetailRow
                      label="Product type"
                      value={detailDeal.productType}
                    />

                    <DetailRow label="Currency" value={detailDeal.currency} />

                    <DetailRow
                      label="Value"
                      value={formatCurrency(
                        detailDeal.value,
                        detailDeal.currency,
                      )}
                    />

                    <DetailRow
                      label="Recurring value"
                      value={formatCurrency(
                        detailDeal.recurringValue,
                        detailDeal.currency,
                      )}
                    />

                    <DetailRow label="Status" value={detailDeal.status} />

                    <DetailRow
                      label="Expected close date"
                      value={formatDate(detailDeal.expectedCloseDate)}
                    />

                    <DetailRow
                      label="Next action"
                      value={formatDateTime(detailDeal.nextActionAt)}
                    />

                    <DetailRow
                      label="Stage changed"
                      value={formatDateTime(detailDeal.stageChangedAt)}
                    />
                  </div>
                </div>

                <div className="deal-details-section">
                  <h3 className="deal-section-title">Pipeline</h3>

                  <div className="deal-details-card">
                    <DetailRow
                      label="Pipeline"
                      value={detailDeal.pipelineId?.name}
                    />

                    <DetailRow label="Stage" value={detailDeal.stageId?.name} />

                    <DetailRow
                      label="Stage key"
                      value={detailDeal.stageId?.key}
                    />

                    <DetailRow
                      label="Probability"
                      value={
                        detailDeal.stageId?.probability !== undefined
                          ? `${detailDeal.stageId.probability}%`
                          : "—"
                      }
                    />
                  </div>
                </div>

                <div className="deal-details-section">
                  <h3 className="deal-section-title">Contact</h3>

                  <div className="deal-details-card">
                    <DetailRow
                      label="Name"
                      value={
                        [
                          detailDeal.contactId?.firstName,
                          detailDeal.contactId?.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"
                      }
                    />

                    <DetailRow
                      label="Email"
                      value={detailDeal.contactId?.email}
                    />

                    <DetailRow
                      label="Phone"
                      value={detailDeal.contactId?.phone}
                    />

                    <DetailRow
                      label="WhatsApp"
                      value={detailDeal.contactId?.whatsapp}
                    />

                    <DetailRow
                      label="Job title"
                      value={detailDeal.contactId?.jobTitle}
                    />
                  </div>
                </div>

                <div className="deal-details-section">
                  <h3 className="deal-section-title">Company</h3>

                  <div className="deal-details-card">
                    <DetailRow
                      label="Company"
                      value={detailDeal.companyId?.name}
                    />

                    <DetailRow
                      label="Legal name"
                      value={detailDeal.companyId?.legalName}
                    />

                    <DetailRow
                      label="Industry"
                      value={detailDeal.companyId?.industry}
                    />

                    <DetailRow
                      label="Website"
                      value={detailDeal.companyId?.website}
                    />

                    <DetailRow
                      label="Phone"
                      value={detailDeal.companyId?.phone}
                    />

                    <DetailRow
                      label="Email"
                      value={detailDeal.companyId?.email}
                    />
                  </div>
                </div>

                <div className="deal-details-section">
                  <h3 className="deal-section-title">Owner</h3>

                  <div className="deal-details-card">
                    <DetailRow label="Name" value={detailDeal.ownerId?.name} />

                    <DetailRow
                      label="Email"
                      value={detailDeal.ownerId?.email}
                    />

                    <DetailRow label="Role" value={detailDeal.ownerId?.role} />
                  </div>
                </div>

                <div className="deal-details-section">
                  <h3 className="deal-section-title">Description</h3>

                  <div className="deal-details-card">
                    <div
                      className="deal-detail-value deal-description"
                      style={{ padding: "14px" }}
                    >
                      {detailDeal.description || "No description provided."}
                    </div>
                  </div>
                </div>

                <div className="deal-details-section">
                  <h3 className="deal-section-title">Dates</h3>

                  <div className="deal-details-card">
                    <DetailRow
                      label="Created"
                      value={formatDateTime(detailDeal.createdAt)}
                    />

                    <DetailRow
                      label="Last updated"
                      value={formatDateTime(detailDeal.updatedAt)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {!detailLoading && (
            <div className="deal-modal-footer">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const current = detailDeal;
                  closeDetailsModal();
                  openEditModal(current);
                }}
              >
                Edit deal
              </button>

              <button
                type="button"
                className="btn ghost"
                onClick={() => handleDeleteDeal(detailDeal)}
                disabled={deletingId === detailDeal._id}
              >
                {deletingId === detailDeal._id ? "Deleting..." : "Delete"}
              </button>

              <button type="button" className="btn" onClick={closeDetailsModal}>
                Close
              </button>
            </div>
          )}
        </Modal>
      )}
    </Page>
  );
}
