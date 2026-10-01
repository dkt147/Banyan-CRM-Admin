import React, { useEffect, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "snoozed", label: "Snoozed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  dueAt: "",
  priority: "medium",
};

const EMPTY_FILTERS = {
  status: "",
  priority: "",
  assignedTo: "",
  contactId: "",
  companyId: "",
  dealId: "",
  from: "",
  to: "",
};

function formatStatus(status) {
  if (!status) return "Unknown";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPriority(priority) {
  if (!priority) return "—";

  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getPriorityTone(priority) {
  if (priority === "urgent") return "warn";
  if (priority === "high") return "warn";
  return "";
}

function getStatusTone(status) {
  if (status === "completed") return "";
  if (status === "cancelled") return "warn";
  if (status === "snoozed") return "warn";
  if (status === "in_progress") return "";
  return "";
}

function getPersonName(item) {
  if (!item) return "Unknown";

  if (item.name) return item.name;

  if (item.firstName || item.lastName) {
    return `${item.firstName || ""} ${item.lastName || ""}`.trim();
  }

  if (item.email) return item.email;

  return item._id || "Unknown";
}

function getCompanyName(item) {
  if (!item) return "Unknown";
  return item.name || item.legalName || item._id || "Unknown";
}

function getDealName(item) {
  if (!item) return "Unknown";
  return item.title || item.name || item._id || "Unknown";
}

export default function Tasks() {
  const { request, user } = useAuth();

  const [tasks, setTasks] = useState([]);

  const [members, setMembers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [modal, setModal] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  /*
   * ---------------------------------------------------------
   * Load tasks
   * ---------------------------------------------------------
   */

  async function loadTasks(customFilters = filters) {
    try {
      setLoading(true);
      setError("");

      const query = {
        page: 1,
        limit: 100,
      };

      Object.entries(customFilters).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          query[key] = value;
        }
      });

      const response = await request("/tasks", {
        query,
      });

      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      setError(e.message || "Failed to load tasks.");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * Load dynamic dropdown options
   * ---------------------------------------------------------
   */

  async function loadFilterOptions() {
    try {
      setLoadingOptions(true);

      const results = await Promise.allSettled([
        request("/members"),
        request("/companies", {
          query: {
            page: 1,
            limit: 100,
            isArchived: false,
          },
        }),
        request("/contacts", {
          query: {
            page: 1,
            limit: 100,
            isArchived: false,
          },
        }),
        request("/deals", {
          query: {
            page: 1,
            limit: 100,
          },
        }),
      ]);

      const [
        membersResult,
        companiesResult,
        contactsResult,
        dealsResult,
      ] = results;

      if (membersResult.status === "fulfilled") {
        const data = membersResult.value?.data;

        setMembers(Array.isArray(data) ? data : []);
      }

      if (companiesResult.status === "fulfilled") {
        const data = companiesResult.value?.data;

        if (Array.isArray(data)) {
          setCompanies(data);
        } else if (Array.isArray(data?.items)) {
          setCompanies(data.items);
        } else {
          setCompanies([]);
        }
      }

      if (contactsResult.status === "fulfilled") {
        const data = contactsResult.value?.data;

        if (Array.isArray(data)) {
          setContacts(data);
        } else if (Array.isArray(data?.items)) {
          setContacts(data.items);
        } else {
          setContacts([]);
        }
      }

      if (dealsResult.status === "fulfilled") {
        const data = dealsResult.value?.data;

        if (Array.isArray(data)) {
          setDeals(data);
        } else if (Array.isArray(data?.items)) {
          setDeals(data.items);
        } else {
          setDeals([]);
        }
      }
    } catch (e) {
      setError(e.message || "Failed to load filter options.");
    } finally {
      setLoadingOptions(false);
    }
  }

  useEffect(() => {
    loadTasks();
    loadFilterOptions();
  }, []);

  /*
   * ---------------------------------------------------------
   * Filters
   * ---------------------------------------------------------
   */

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function applyFilters() {
    loadTasks(filters);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    loadTasks(EMPTY_FILTERS);
  }

  /*
   * ---------------------------------------------------------
   * Create task
   * ---------------------------------------------------------
   */

  async function create() {
    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }

    if (!form.dueAt) {
      setError("Due date is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await request("/tasks", {
        method: "POST",
        body: {
          ...form,
          dueAt: new Date(form.dueAt).toISOString(),
          assignedTo: user?._id,
        },
      });

      setTasks((current) => [
        response.data,
        ...current,
      ]);

      setModal(null);
      setForm(EMPTY_FORM);
    } catch (e) {
      setError(e.message || "Failed to create task.");
    } finally {
      setSaving(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * Complete / Snooze
   * ---------------------------------------------------------
   */

  async function action(task, type) {
    try {
      setError("");

      let body = {};

      if (type === "snooze") {
        body = {
          until: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        };
      }

      const response = await request(
        `/tasks/${task._id}/${type}`,
        {
          method: "PATCH",
          body,
        },
      );

      setTasks((current) =>
        current.map((item) =>
          item._id === task._id
            ? response.data
            : item,
        ),
      );
    } catch (e) {
      setError(e.message || `Failed to ${type} task.`);
    }
  }

  /*
   * ---------------------------------------------------------
   * Delete task
   * ---------------------------------------------------------
   */

  async function removeTask(task) {
    if (!window.confirm("Delete this task?")) {
      return;
    }

    try {
      setError("");

      await request(`/tasks/${task._id}`, {
        method: "DELETE",
      });

      setTasks((current) =>
        current.filter(
          (item) => item._id !== task._id,
        ),
      );
    } catch (e) {
      setError(e.message || "Failed to delete task.");
    }
  }

  /*
   * ---------------------------------------------------------
   * Task groups
   * ---------------------------------------------------------
   */

  const groups = [
    "overdue",
    "today",
    "upcoming",
    "completed",
  ]
    .map((key) => {
      return [
        key,
        tasks.filter((task) => {
          const date = new Date(task.dueAt);
          const now = new Date();

          if (key === "completed") {
            return task.status === "completed";
          }

          if (
            task.status === "completed" ||
            task.status === "cancelled"
          ) {
            return false;
          }

          if (key === "overdue") {
            return date < now;
          }

          if (key === "today") {
            return (
              date.toDateString() ===
              now.toDateString()
            );
          }

          return (
            date > now &&
            date.toDateString() !==
              now.toDateString()
          );
        }),
      ];
    })
    .filter(([, items]) => items.length > 0);

  /*
   * ---------------------------------------------------------
   * Render
   * ---------------------------------------------------------
   */

  return (
    <Page
      title="Tasks"
      kicker={`${tasks.filter(
        (task) =>
          task.status !== "completed" &&
          task.status !== "cancelled",
      ).length} active tasks`}
      actions={
        <button
          className="btn primary"
          onClick={() => {
            setError("");
            setModal("New task");
          }}
        >
          New task
        </button>
      }
    >
      {error && (
        <div className="notice error">
          <b>Tasks</b>
          <span>{error}</span>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* Filters */}
      {/* -------------------------------------------------- */}

      <section className="panel">
        <SectionTitle title="Filters" />

        <div className="form-grid">
          {/* Status */}

          <label>
            Status
            <select
              value={filters.status}
              onChange={(e) =>
                updateFilter(
                  "status",
                  e.target.value,
                )
              }
            >
              <option value="">
                All statuses
              </option>

              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* Priority */}

          <label>
            Priority
            <select
              value={filters.priority}
              onChange={(e) =>
                updateFilter(
                  "priority",
                  e.target.value,
                )
              }
            >
              <option value="">
                All priorities
              </option>

              {PRIORITY_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* Assigned To */}

          <label>
            Assigned To
            <select
              value={filters.assignedTo}
              onChange={(e) =>
                updateFilter(
                  "assignedTo",
                  e.target.value,
                )
              }
              disabled={loadingOptions}
            >
              <option value="">
                All members
              </option>

              {members.map((member) => (
                <option
                  key={member._id}
                  value={member._id}
                >
                  {getPersonName(member)}
                </option>
              ))}
            </select>
          </label>

          {/* Company */}

          <label>
            Company
            <select
              value={filters.companyId}
              onChange={(e) =>
                updateFilter(
                  "companyId",
                  e.target.value,
                )
              }
              disabled={loadingOptions}
            >
              <option value="">
                All companies
              </option>

              {companies.map((company) => (
                <option
                  key={company._id}
                  value={company._id}
                >
                  {getCompanyName(company)}
                </option>
              ))}
            </select>
          </label>

          {/* Contact */}

          <label>
            Contact
            <select
              value={filters.contactId}
              onChange={(e) =>
                updateFilter(
                  "contactId",
                  e.target.value,
                )
              }
              disabled={loadingOptions}
            >
              <option value="">
                All contacts
              </option>

              {contacts.map((contact) => (
                <option
                  key={contact._id}
                  value={contact._id}
                >
                  {getPersonName(contact)}
                </option>
              ))}
            </select>
          </label>

          {/* Deal */}

          <label>
            Deal
            <select
              value={filters.dealId}
              onChange={(e) =>
                updateFilter(
                  "dealId",
                  e.target.value,
                )
              }
              disabled={loadingOptions}
            >
              <option value="">
                All deals
              </option>

              {deals.map((deal) => (
                <option
                  key={deal._id}
                  value={deal._id}
                >
                  {getDealName(deal)}
                </option>
              ))}
            </select>
          </label>

          {/* From */}

          <label>
            From
            <input
              type="date"
              value={filters.from}
              onChange={(e) =>
                updateFilter(
                  "from",
                  e.target.value,
                )
              }
            />
          </label>

          {/* To */}

          <label>
            To
            <input
              type="date"
              value={filters.to}
              onChange={(e) =>
                updateFilter(
                  "to",
                  e.target.value,
                )
              }
            />
          </label>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "16px",
          }}
        >
          <button
            className="btn primary"
            onClick={applyFilters}
          >
            Apply filters
          </button>

          <button
            className="btn ghost"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>
      </section>

      {/* -------------------------------------------------- */}
      {/* Tasks */}
      {/* -------------------------------------------------- */}

      {loading ? (
        <div className="panel">
          <span className="muted">
            Loading tasks...
          </span>
        </div>
      ) : groups.length === 0 ? (
        <Empty text="No tasks found." />
      ) : (
        groups.map(([name, items]) => (
          <section
            className="task-group"
            key={name}
          >
            <SectionTitle
              title={
                name.charAt(0).toUpperCase() +
                name.slice(1)
              }
            />

            {items.map((task) => (
              <div
                className={`task-card ${
                  task.status === "completed"
                    ? "complete"
                    : ""
                }`}
                key={task._id}
              >
                <div>
                  <div className="task-title">
                    <b>{task.title}</b>

                    <Badge
                      tone={getPriorityTone(
                        task.priority,
                      )}
                    >
                      {formatPriority(
                        task.priority,
                      )}
                    </Badge>

                    <Badge
                      tone={getStatusTone(
                        task.status,
                      )}
                    >
                      {formatStatus(
                        task.status,
                      )}
                    </Badge>
                  </div>

                  <span>
                    {task.description ||
                      "No description"}{" "}
                    · due{" "}
                    {task.dueAt
                      ? new Date(
                          task.dueAt,
                        ).toLocaleString()
                      : "No due date"}
                  </span>

                  {/* Related records */}

                  <div
                    className="muted"
                    style={{
                      marginTop: "6px",
                      fontSize: "13px",
                    }}
                  >
                    {task.assignedTo?.name &&
                      `Assigned to: ${task.assignedTo.name}`}

                    {task.contactId &&
                      ` · Contact: ${
                        getPersonName(
                          task.contactId,
                        )
                      }`}

                    {task.companyId &&
                      ` · Company: ${
                        getCompanyName(
                          task.companyId,
                        )
                      }`}

                    {task.dealId &&
                      ` · Deal: ${
                        getDealName(
                          task.dealId,
                        )
                      }`}
                  </div>
                </div>

                <div className="task-actions">
                  {task.status !== "completed" &&
                    task.status !== "cancelled" && (
                      <>
                        <button
                          className="btn ghost"
                          onClick={() =>
                            action(
                              task,
                              "complete",
                            )
                          }
                        >
                          Complete
                        </button>

                        <button
                          className="btn ghost"
                          onClick={() =>
                            action(
                              task,
                              "snooze",
                            )
                          }
                        >
                          Snooze
                        </button>
                      </>
                    )}

                  <button
                    className="btn ghost"
                    onClick={() =>
                      removeTask(task)
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      {/* -------------------------------------------------- */}
      {/* Create Task Modal */}
      {/* -------------------------------------------------- */}

      {modal && (
        <Modal
          title="New task"
          onClose={() => setModal(null)}
          actions={
            <>
              <button
                className="btn ghost"
                onClick={() =>
                  setModal(null)
                }
              >
                Cancel
              </button>

              <button
                className="btn primary"
                disabled={saving}
                onClick={create}
              >
                {saving
                  ? "Saving…"
                  : "Create task"}
              </button>
            </>
          }
        >
          <label>
            Task title

            <input
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
              placeholder="Follow up with client"
            />
          </label>

          <label>
            Description

            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description:
                    e.target.value,
                })
              }
            />
          </label>

          <div className="form-grid">
            <label>
              Due

              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dueAt: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Priority

              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority:
                      e.target.value,
                  })
                }
              >
                {PRIORITY_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}