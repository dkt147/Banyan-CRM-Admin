import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FunnelSimple,
  X,
  Plus,
  Check,
  ClockCounterClockwise,
  Trash,
} from "@phosphor-icons/react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Page, Empty } from "./Dashboard";
import Modal from "../components/Modal";
import { BulkBar, FilterChips, SavedViews, SearchBox, runBulk, useSelection } from "../components/ListKit";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";
import { fromHkInput } from "../utils/hkTime";
import { usePermissions } from "../utils/permissions";

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
  contactId: "",
  dealId: "",
};
const EMPTY_FILTERS = {
  search: "",
  status: "",
  priority: "",
  assignedTo: "",
  contactId: "",
  companyId: "",
  dealId: "",
  from: "",
  to: "",
};
const EMPTY_SUMMARY = {
  overdue: 0,
  dueToday: 0,
  thisWeek: 0,
  dealsGoneQuiet: 0,
};

function getPersonName(item) {
  if (!item) return "Unknown contact";
  if (item.name) return item.name;
  if (item.firstName || item.lastName)
    return `${item.firstName || ""} ${item.lastName || ""}`.trim();
  return item.email || "Unknown contact";
}

function getCompanyName(item) {
  return item?.name || item?.legalName || "Unknown company";
}

function getDealName(item) {
  return item?.title || item?.name || "Related deal";
}

function dateKeyInTimezone(value, timeZone = "Asia/Hong_Kong") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isSameDay(first, second, timeZone) {
  return (
    dateKeyInTimezone(first, timeZone) === dateKeyInTimezone(second, timeZone)
  );
}

function isActionable(task, now = new Date()) {
  if (["completed", "cancelled"].includes(task.status)) return false;
  if (task.status === "snoozed")
    return Boolean(task.snoozedUntil && new Date(task.snoozedUntil) <= now);
  return true;
}

function formatDate(value, options = {}, timeZone = "Asia/Hong_Kong") {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat(undefined, { timeZone, ...options }).format(
    date,
  );
}

function formatMoney(value, currency = "HKD") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

// A task's contact is its own contactId, or the linked deal's contact for older tasks
// that were created with a deal only.
function taskLinks(task) {
  const deal = task?.dealId && typeof task.dealId === "object" ? task.dealId : null;
  const contact =
    (task?.contactId && typeof task.contactId === "object" ? task.contactId : null) ||
    (deal?.contactId && typeof deal.contactId === "object" ? deal.contactId : null);
  const company = task?.companyId && typeof task.companyId === "object" ? task.companyId : null;
  return { deal, contact, company };
}

function joinWithDots(nodes) {
  return nodes
    .filter(Boolean)
    .flatMap((node, index) => (index ? [<span key={`sep-${index}`}> · </span>, node] : [node]));
}

function getInitialsCount(filters) {
  return Object.values(filters).filter((value) => value !== "").length;
}

export default function Tasks() {
  const { request, user } = useAuth();
  const canWrite = usePermissions().can("records.write");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedTaskId = searchParams.get("id");
  const [tasks, setTasks] = useState([]);
  const [notice, setNotice] = useState("");
  const sel = useSelection(tasks);
  const [members, setMembers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [workspaceTimezone, setWorkspaceTimezone] = useState("Asia/Hong_Kong");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterDraft, setFilterDraft] = useState(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const activeFilterCount = useMemo(() => getInitialsCount(filters), [filters]);

  const loadTasks = useCallback(
    async (customFilters) => {
      try {
        setLoading(true);
        setError("");
        const query = { page: 1, limit: 100 };
        Object.entries(customFilters).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined)
            query[key] = value;
        });
        const response = await request("/tasks", { query });
        setTasks(Array.isArray(response?.data) ? response.data : []);
      } catch (e) {
        setError(e.message || "Failed to load tasks.");
        setTasks([]);
      } finally {
        setLoading(false);
      }
    },
    [request],
  );

  const loadSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const response = await request("/tasks/summary");
      const next = response?.data || {};
      const normalizedSummary = {
        overdue: Number.isInteger(next.overdue) ? next.overdue : 0,
        dueToday: Number.isInteger(next.dueToday) ? next.dueToday : 0,
        thisWeek: Number.isInteger(next.thisWeek) ? next.thisWeek : 0,
        dealsGoneQuiet: Number.isInteger(next.dealsGoneQuiet)
          ? next.dealsGoneQuiet
          : 0,
      };
      setSummary(normalizedSummary);
      window.dispatchEvent(
        new CustomEvent("banyan:task-summary-updated", {
          detail: normalizedSummary,
        }),
      );
    } catch (e) {
      setError(
        (current) => current || e.message || "Failed to load task summary.",
      );
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoadingSummary(false);
    }
  }, [request]);

  const loadFilterOptions = useCallback(async () => {
    try {
      setLoadingOptions(true);
      const results = await Promise.allSettled([
        request("/members"),
        request("/companies", {
          query: { page: 1, limit: 100, isArchived: false },
        }),
        request("/contacts", {
          query: { page: 1, limit: 100, isArchived: false },
        }),
        request("/deals", { query: { page: 1, limit: 100 } }),
        request("/workspace"),
      ]);
      const unwrap = (result) => {
        if (result.status !== "fulfilled") return [];
        const data = result.value?.data;
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.items)) return data.items;
        return [];
      };
      setMembers(unwrap(results[0]));
      setCompanies(unwrap(results[1]));
      setContacts(unwrap(results[2]));
      setDeals(unwrap(results[3]));
      if (results[4].status === "fulfilled") {
        const timeZone = results[4].value?.data?.timezone;
        if (typeof timeZone === "string" && timeZone.trim()) {
          try {
            new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
            setWorkspaceTimezone(timeZone);
          } catch {
            setWorkspaceTimezone("Asia/Hong_Kong");
          }
        }
      }
    } catch (e) {
      setError(
        (current) => current || e.message || "Failed to load filter options.",
      );
    } finally {
      setLoadingOptions(false);
    }
  }, [request]);

  useEffect(() => {
    loadTasks(EMPTY_FILTERS);
    loadSummary();
    loadFilterOptions();
  }, [loadTasks, loadSummary, loadFilterOptions]);

  // Applies quick filters, chips and saved views immediately.
  function applyQuick(patch) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setFilterDraft(next);
    loadTasks(next);
  }

  async function bulk(kind) {
    const ids = sel.ids();
    if (kind === "delete" && !window.confirm(`Delete ${ids.length} task(s)?`)) return;
    const result = await runBulk(ids, (id) =>
      kind === "delete"
        ? request(`/tasks/${id}`, { method: "DELETE" })
        : request(`/tasks/${id}/complete`, { method: "PATCH", body: {} }));
    setNotice(`${result.ok} ${kind === "delete" ? "deleted" : "completed"}${result.failed ? `, ${result.failed} failed: ${result.firstError}` : ""}.`);
    sel.clear();
    await Promise.all([loadTasks(filters), loadSummary()]);
  }

  useEffect(() => {
    if (!filterOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setFilterOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filterOpen]);

  function updateFilter(name, value) {
    setFilterDraft((current) => ({ ...current, [name]: value }));
  }

  function openFilters() {
    setFilterDraft(filters);
    setFilterOpen(true);
  }

  function applyFilters() {
    setFilters(filterDraft);
    setFilterOpen(false);
    loadTasks(filterDraft);
  }

  function clearFilters() {
    setFilterDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    loadTasks(EMPTY_FILTERS);
  }

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
      const body = {
        ...form,
        dueAt: fromHkInput(form.dueAt).toISOString(),
        assignedTo: user?._id,
      };
      // Optional links: omit when not chosen (the API rejects empty ids).
      if (!body.contactId) delete body.contactId;
      if (!body.dealId) delete body.dealId;
      await request("/tasks", {
        method: "POST",
        body,
      });
      setModal(false);
      setForm(EMPTY_FORM);
      await Promise.all([loadTasks(filters), loadSummary()]);
    } catch (e) {
      setError(e.message || "Failed to create task.");
    } finally {
      setSaving(false);
    }
  }

  async function action(task, type) {
    try {
      setError("");
      const body =
        type === "snooze"
          ? {
              snoozedUntil: new Date(
                Date.now() + 24 * 60 * 60 * 1000,
              ).toISOString(),
            }
          : {};
      await request(`/tasks/${task._id}/${type}`, { method: "PATCH", body });
      await Promise.all([loadTasks(filters), loadSummary()]);
    } catch (e) {
      setError(e.message || `Failed to ${type} task.`);
    }
  }

  async function removeTask(task) {
    if (!window.confirm("Delete this task?")) return;
    try {
      setError("");
      await request(`/tasks/${task._id}`, { method: "DELETE" });
      await Promise.all([loadTasks(filters), loadSummary()]);
    } catch (e) {
      setError(e.message || "Failed to delete task.");
    }
  }

  const groups = useMemo(() => {
    const now = new Date();
    const todayKey = dateKeyInTimezone(now, workspaceTimezone);
    const todayCalendar = new Date(`${todayKey}T00:00:00.000Z`);
    const daysSinceMonday =
      todayCalendar.getUTCDay() === 0 ? 6 : todayCalendar.getUTCDay() - 1;
    const nextMondayKey = addCalendarDays(todayKey, 7 - daysSinceMonday);
    const tomorrowKey = addCalendarDays(todayKey, 1);
    const sets = {
      overdue: [],
      today: [],
      thisWeek: [],
      upcoming: [],
      completed: [],
      snoozed: [],
      cancelled: [],
    };

    tasks.forEach((task) => {
      if (task.status === "completed") {
        if (
          filters.status === "completed" ||
          (task.completedAt &&
            isSameDay(task.completedAt, now, workspaceTimezone))
        ) {
          sets.completed.push(task);
        }
        return;
      }
      if (task.status === "cancelled") {
        if (filters.status === "cancelled") sets.cancelled.push(task);
        return;
      }
      if (task.status === "snoozed" && filters.status === "snoozed") {
        sets.snoozed.push(task);
        return;
      }
      if (!task.dueAt || !isActionable(task, now)) return;
      const dueKey = dateKeyInTimezone(task.dueAt, workspaceTimezone);
      if (dueKey < todayKey) sets.overdue.push(task);
      else if (dueKey === todayKey) sets.today.push(task);
      else if (dueKey < nextMondayKey && dueKey >= tomorrowKey)
        sets.thisWeek.push(task);
      else if (dueKey >= nextMondayKey) sets.upcoming.push(task);
    });

    return [
      ["overdue", "Overdue", sets.overdue],
      ["today", "Today", sets.today],
      ["thisWeek", "This week", sets.thisWeek],
      ["upcoming", "Upcoming", sets.upcoming],
      ["snoozed", "Snoozed tasks", sets.snoozed],
      [
        "completed",
        filters.status === "completed" ? "Completed" : "Completed today",
        sets.completed,
      ],
      ["cancelled", "Cancelled", sets.cancelled],
    ].filter(([, , items]) => items.length > 0);
  }, [tasks, filters.status, workspaceTimezone]);

  function renderFilterFields() {
    return (
      <div className="task-filter-fields">
        <label>
          Status
          <select
            value={filterDraft.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            value={filterDraft.priority}
            onChange={(e) => updateFilter("priority", e.target.value)}
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigned to
          <select
            value={filterDraft.assignedTo}
            onChange={(e) => updateFilter("assignedTo", e.target.value)}
            disabled={loadingOptions}
          >
            <option value="">All members</option>
            {members.map((member) => (
              <option key={member._id} value={member._id}>
                {getPersonName(member)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Company
          <select
            value={filterDraft.companyId}
            onChange={(e) => updateFilter("companyId", e.target.value)}
            disabled={loadingOptions}
          >
            <option value="">All companies</option>
            {companies.map((company) => (
              <option key={company._id} value={company._id}>
                {getCompanyName(company)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contact
          <select
            value={filterDraft.contactId}
            onChange={(e) => updateFilter("contactId", e.target.value)}
            disabled={loadingOptions}
          >
            <option value="">All contacts</option>
            {contacts.map((contact) => (
              <option key={contact._id} value={contact._id}>
                {getPersonName(contact)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Deal
          <select
            value={filterDraft.dealId}
            onChange={(e) => updateFilter("dealId", e.target.value)}
            disabled={loadingOptions}
          >
            <option value="">All deals</option>
            {deals.map((deal) => (
              <option key={deal._id} value={deal._id}>
                {getDealName(deal)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due from
          <input
            type="date"
            value={filterDraft.from}
            onChange={(e) => updateFilter("from", e.target.value)}
          />
        </label>
        <label>
          Due to
          <input
            type="date"
            value={filterDraft.to}
            onChange={(e) => updateFilter("to", e.target.value)}
            min={filterDraft.from || undefined}
          />
        </label>
      </div>
    );
  }

  if (linkedTaskId) return <Navigate to={recordHref.task(linkedTaskId)} replace />;

  const STATUS_CHIPS = STATUS_OPTIONS.map((o) => ({ key: o.value, label: o.label, active: filters.status === o.value }));

  return (
    <Page
      title="Tasks"
      kicker="Follow-ups"
      className="tasks-page"
      actions={
        <div className="tasks-titlebar">
          <div className="tasks-toolbar-actions">
            <button
              type="button"
              className="btn ghost task-filter-trigger"
              onClick={openFilters}
              aria-haspopup="dialog"
              aria-expanded={filterOpen}
            >
              <FunnelSimple size={16} weight="regular" />
              Filters
              {activeFilterCount > 0 && (
                <span className="task-filter-count">{activeFilterCount}</span>
              )}
            </button>
            {canWrite && <button
              type="button"
              className="btn primary"
              onClick={() => {
                setError("");
                setModal(true);
              }}
            >
              <Plus size={15} weight="bold" /> New task
            </button>}
          </div>
        </div>
      }
    >
      {error && (
        <div className="notice error task-error">
          <b>Tasks</b>
          <span>{error}</span>
        </div>
      )}

      <section className="lk-toolbar">
        <SearchBox value={filters.search} onChange={(search) => applyQuick({ search })} placeholder="Search task title or description" />
        <SavedViews page="tasks" current={filters} onApply={(state) => applyQuick({ ...EMPTY_FILTERS, ...state })} />
      </section>
      <section className="lk-filterbar">
        <FilterChips label="Status" chips={STATUS_CHIPS} onToggle={(status) => applyQuick({ status: filters.status === status ? "" : status })} />
        <FilterChips chips={[{ key: "mine", label: "Assigned to me", active: Boolean(user?._id) && filters.assignedTo === user?._id }]}
          onToggle={() => applyQuick({ assignedTo: filters.assignedTo === user?._id ? "" : user?._id || "" })}
          onClear={activeFilterCount ? () => applyQuick(EMPTY_FILTERS) : undefined} />
      </section>
      {notice && <div className="notice"><b>Tasks</b><span>{notice}</span></div>}
      <BulkBar count={canWrite ? sel.count : 0} onClear={sel.clear}>
        <button type="button" className="btn ghost" onClick={() => bulk("complete")}>Complete</button>
        <button type="button" className="btn ghost" onClick={() => bulk("delete")}>Delete</button>
      </BulkBar>

      <section className="task-summary-grid" aria-label="Task summary">
        <article className="task-summary-card task-summary-overdue">
          <span>Overdue</span>
          <strong>{loadingSummary ? "—" : summary.overdue}</strong>
        </article>
        <article className="task-summary-card">
          <span>Due today</span>
          <strong>{loadingSummary ? "—" : summary.dueToday}</strong>
        </article>
        <article className="task-summary-card">
          <span>This week</span>
          <strong>{loadingSummary ? "—" : summary.thisWeek}</strong>
        </article>
        <article className="task-summary-card">
          <span>Deals gone quiet</span>
          <strong>{loadingSummary ? "—" : summary.dealsGoneQuiet}</strong>
        </article>
      </section>

      {loading ? (
        <div className="task-empty-loading">Loading tasks…</div>
      ) : groups.length === 0 ? (
        <Empty text="No tasks found for the selected filters." />
      ) : (
        groups.map(([key, label, items]) => (
          <section
            className={`task-list-section task-section-${key}`}
            key={key}
          >
            <h2 className="task-section-heading">{label}</h2>
            <div className="task-list-card">
              {items.map((task) => {
                const links = taskLinks(task);
                const meta = joinWithDots([
                  task.description && (
                    <span key="description">{task.description}</span>
                  ),
                  links.deal?._id && (
                    <Link key="deal" className="task-record-link" to={recordHref.deal(links.deal._id)}>
                      {getDealName(links.deal)}
                    </Link>
                  ),
                  links.company?._id && (
                    <Link key="company" className="task-record-link" to={recordHref.company(links.company._id)}>
                      {getCompanyName(links.company)}
                    </Link>
                  ),
                  links.contact?._id && (
                    <Link key="contact" className="task-record-link" to={recordHref.contact(links.contact._id)}>
                      {getPersonName(links.contact)}
                    </Link>
                  ),
                ]);
                const isComplete = task.status === "completed";
                const dueTime = task.dueAt
                  ? formatDate(
                      task.dueAt,
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        month: "short",
                        day: "numeric",
                      },
                      workspaceTimezone,
                    )
                  : "Anytime";

                return (
                  <article
                    className={`task-row ${isComplete ? "is-complete" : ""}`}
                    key={task._id}
                  >
                    {canWrite && <input
                      type="checkbox"
                      className="task-select"
                      aria-label={`Select ${task.title}`}
                      checked={sel.has(task._id)}
                      onChange={() => sel.toggle(task._id)}
                    />}
                    <button
                      type="button"
                      className={`task-complete-toggle ${isComplete ? "checked" : ""}`}
                      aria-label={
                        isComplete ? "Task completed" : `Complete ${task.title}`
                      }
                      title={isComplete ? "Completed" : "Mark complete"}
                      onClick={() => canWrite && !isComplete && action(task, "complete")}
                      disabled={isComplete || !canWrite}
                    >
                      {isComplete && <Check size={12} weight="bold" />}
                    </button>
                    <div className="task-row-content">
                      <div className="task-row-title-line">
                        <button
                          type="button"
                          className="task-title-button"
                          onClick={() => navigate(recordHref.task(task._id))}
                          title="Open task"
                        >
                          <strong>{task.title}</strong>
                        </button>
                        {task.priority === "urgent" && (
                          <span className="task-priority-pill urgent">
                            Urgent
                          </span>
                        )}
                        {task.priority === "high" && (
                          <span className="task-priority-pill high">
                            High priority
                          </span>
                        )}
                      </div>
                      {meta.length > 0 && <p className="task-row-meta">{meta}</p>}
                      <p className="task-row-facts">
                        <span className={`task-status task-status-${task.status}`}>
                          {STATUS_OPTIONS.find((o) => o.value === task.status)?.label || task.status}
                        </span>
                        <span>Assigned to {task.assignedTo?.name || "—"}</span>
                      </p>
                      {task.source === "automation" && (
                        <p className="task-row-automation">
                          Auto-created by automation
                          {task.metadata?.ruleName
                            ? ` · ${task.metadata.ruleName}`
                            : ""}
                        </p>
                      )}
                      {task.status === "snoozed" &&
                        task.snoozedUntil &&
                        new Date(task.snoozedUntil) > new Date() && (
                          <p className="task-row-automation">
                            Snoozed until{" "}
                            {formatDate(
                              task.snoozedUntil,
                              {},
                              workspaceTimezone,
                            )}
                          </p>
                        )}
                    </div>
                    <div className="task-row-side">
                      <time dateTime={task.dueAt || undefined}>{dueTime}</time>
                      {canWrite && !isComplete && task.status !== "cancelled" && (
                        <div className="task-row-actions">
                          <button
                            type="button"
                            className="btn primary task-action-primary"
                            onClick={() => action(task, "complete")}
                          >
                            Complete
                          </button>
                          {key === "overdue" && (
                            <button
                              type="button"
                              className="btn ghost task-action-secondary"
                              onClick={() => action(task, "snooze")}
                            >
                              <ClockCounterClockwise size={13} /> Snooze
                            </button>
                          )}
                          <button
                            type="button"
                            className="task-icon-action"
                            title="Delete task"
                            aria-label={`Delete ${task.title}`}
                            onClick={() => removeTask(task)}
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {filterOpen && (
        <div
          className="task-filter-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFilterOpen(false);
          }}
        >
          <aside
            className="task-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-filter-title"
          >
            <header className="task-filter-drawer-head">
              <div>
                <span className="eyebrow">Task management</span>
                <h2 id="task-filter-title">Filters</h2>
                <p>Refine tasks by status, ownership, records, or due date.</p>
              </div>
              <button
                type="button"
                className="task-drawer-close"
                onClick={() => setFilterOpen(false)}
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </header>
            <div className="task-filter-drawer-body">
              {renderFilterFields()}
            </div>
            <footer className="task-filter-drawer-footer">
              <button
                type="button"
                className="btn ghost"
                onClick={clearFilters}
              >
                Clear all
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={applyFilters}
              >
                Apply filters
              </button>
            </footer>
          </aside>
        </div>
      )}

      {modal && (
        <Modal
          title="New task"
          onClose={() => setModal(false)}
          actions={
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={saving}
                onClick={create}
              >
                {saving ? "Saving…" : "Create task"}
              </button>
            </>
          }
        >
          <label>
            Task title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Follow up with client"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <div className="form-grid">
            <label>
              Due
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </label>
            <label>
              Priority
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Deal
              <select
                value={form.dealId}
                onChange={(e) => setForm({ ...form, dealId: e.target.value })}
                disabled={loadingOptions}
              >
                <option value="">No deal</option>
                {deals.map((deal) => (
                  <option key={deal._id} value={deal._id}>
                    {getDealName(deal)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contact
              <select
                value={form.contactId}
                onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                disabled={loadingOptions}
              >
                <option value="">
                  {form.dealId ? "Use the deal's contact" : "No contact"}
                </option>
                {contacts.map((contact) => (
                  <option key={contact._id} value={contact._id}>
                    {getPersonName(contact)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      )}

    </Page>
  );
}
