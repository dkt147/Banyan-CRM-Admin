import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Badge from "../../components/Badge";
import { Card, DetailLayout, FieldGrid, fmtDateTime } from "../../components/DetailLayout";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../utils/permissions";
import { recordHref } from "../../utils/recordLinks";
import { personLabel, useLookups } from "../../utils/useLookups";
import { fromHkInput } from "../../utils/hkTime";

export const TASK_STATUSES = [["pending", "Pending"], ["in_progress", "In progress"], ["completed", "Completed"], ["snoozed", "Snoozed"], ["cancelled", "Cancelled"]];
export const TASK_PRIORITIES = [["low", "Low"], ["medium", "Medium"], ["high", "High"], ["urgent", "Urgent"]];
export const labelOf = (list, value) => (list.find(([v]) => v === value) || [])[1] || value || "—";

// A task's contact is its own, or its deal's contact for tasks created with a deal only.
export function taskLinks(task) {
  const deal = task?.dealId && typeof task.dealId === "object" ? task.dealId : null;
  const contact = (task?.contactId && typeof task.contactId === "object" ? task.contactId : null)
    || (deal?.contactId && typeof deal.contactId === "object" ? deal.contactId : null);
  const company = task?.companyId && typeof task.companyId === "object" ? task.companyId : null;
  return { deal, contact, company };
}

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { request } = useAuth();
  const canWrite = usePermissions().can("records.write");
  const { members, contacts, deals } = useLookups(["members", "contacts", "deals"]);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTask((await request(`/tasks/${id}`)).data || null); }
    catch (e) { setError(e.status === 404 ? "This task was not found or is not assigned to you." : e.message || "Could not load the task."); }
    finally { setLoading(false); }
  }, [id, request]);
  useEffect(() => { load(); }, [load]);

  async function save(changed) {
    const body = { ...changed };
    if ("dueAt" in body) body.dueAt = fromHkInput(body.dueAt).toISOString();
    for (const key of ["contactId", "dealId"]) if (key in body && !body[key]) body[key] = null;
    if ("description" in body && !body.description.trim()) body.description = null;
    setTask((await request(`/tasks/${id}`, { method: "PATCH", body })).data);
  }
  async function act(type) {
    setActionError("");
    try {
      const body = type === "snooze" ? { snoozedUntil: new Date(Date.now() + 86400000).toISOString() } : {};
      setTask((await request(`/tasks/${id}/${type}`, { method: "PATCH", body })).data);
    } catch (e) { setActionError(e.message); }
  }
  async function remove() {
    if (!window.confirm("Delete this task?")) return;
    try { await request(`/tasks/${id}`, { method: "DELETE" }); navigate("/tasks"); }
    catch (e) { setActionError(e.message); }
  }

  const links = taskLinks(task);
  const open = task && !["completed", "cancelled"].includes(task.status);
  const withCurrent = (rows, current, label) => current && !rows.some((r) => r._id === current._id) ? [...rows, current] : rows;

  return (
    <DetailLayout
      type="task" id={id} listPath="/tasks" listLabel="Tasks"
      title={task?.title} subtitle={task ? `Due ${fmtDateTime(task.dueAt)}` : ""}
      loading={loading} error={error} onRetry={load}
      badges={task && <><Badge>{labelOf(TASK_STATUSES, task.status)}</Badge><Badge tone={["high", "urgent"].includes(task.priority) ? "warn" : ""}>{labelOf(TASK_PRIORITIES, task.priority)} priority</Badge>{task.source !== "manual" && <Badge>{task.source === "automation" ? "Automation" : "System"}</Badge>}</>}
      actions={canWrite && task && <>
        {open && <button type="button" className="btn primary" onClick={() => act("complete")}>Complete</button>}
        {open && <button type="button" className="btn ghost" onClick={() => act("snooze")}>Snooze 1 day</button>}
        <button type="button" className="btn ghost" onClick={remove}>Delete</button>
      </>}
    >
      {actionError && <div className="notice error"><b>Tasks</b><span>{actionError}</span></div>}
      {task && <>
        <Card title="Linked records">
          <dl className="dl-fields">
            <div className="dl-field"><dt>Deal</dt><dd>{links.deal ? <Link to={recordHref.deal(links.deal._id)}>{links.deal.title}</Link> : "—"}</dd></div>
            <div className="dl-field"><dt>Contact</dt><dd>{links.contact ? <Link to={recordHref.contact(links.contact._id)}>{personLabel(links.contact)}</Link> : "—"}</dd></div>
            <div className="dl-field"><dt>Company</dt><dd>{links.company ? <Link to={recordHref.company(links.company._id)}>{links.company.name}</Link> : "—"}</dd></div>
            <div className="dl-field"><dt>Booking</dt><dd>{task.bookingId ? <Link to={recordHref.booking(task.bookingId)}>Open booking</Link> : "—"}</dd></div>
          </dl>
        </Card>
        <FieldGrid
          canEdit={canWrite}
          onSave={save}
          fields={[
            { key: "title", label: "Title", value: task.title, required: true, span: true },
            { key: "status", label: "Status", type: "select", value: task.status, options: TASK_STATUSES, display: labelOf(TASK_STATUSES, task.status) },
            { key: "priority", label: "Priority", type: "select", value: task.priority, options: TASK_PRIORITIES, display: labelOf(TASK_PRIORITIES, task.priority) },
            { key: "dueAt", label: "Due", type: "datetime-local", value: task.dueAt, required: true, display: fmtDateTime(task.dueAt) },
            { key: "assignedTo", label: "Assigned to", type: "select", value: task.assignedTo?._id || "", options: withCurrent(members, task.assignedTo).map((m) => [m._id, m.name || m.email]), display: task.assignedTo?.name || "—" },
            { key: "dealId", label: "Deal", type: "select", value: links.deal?._id && task.dealId ? links.deal._id : "", options: [["", "No deal"], ...withCurrent(deals, links.deal).map((d) => [d._id, d.title])], display: links.deal?.title || "—" },
            { key: "contactId", label: "Contact", type: "select", value: task.contactId?._id || "", options: [["", "No contact"], ...withCurrent(contacts, task.contactId?._id ? task.contactId : null).map((c) => [c._id, personLabel(c)])], display: links.contact ? personLabel(links.contact) : "—" },
            { key: "description", label: "Description", type: "textarea", value: task.description, span: true },
          ]}
        />
        <Card title="Record">
          <dl className="dl-fields">
            <div className="dl-field"><dt>Created by</dt><dd>{task.createdBy?.name || "—"}</dd></div>
            <div className="dl-field"><dt>Created</dt><dd>{fmtDateTime(task.createdAt)}</dd></div>
            <div className="dl-field"><dt>Completed</dt><dd>{fmtDateTime(task.completedAt)}</dd></div>
            <div className="dl-field"><dt>Snoozed until</dt><dd>{fmtDateTime(task.snoozedUntil)}</dd></div>
          </dl>
        </Card>
      </>}
    </DetailLayout>
  );
}
