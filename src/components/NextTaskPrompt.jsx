import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { recordHref } from "../utils/recordLinks";
import { fromHkInput, hkAddDays, toHkInput } from "../utils/hkTime";

const FOLLOW_UP_DAYS = 3;

// 10:00 Hong Kong time, FOLLOW_UP_DAYS from now.
function defaultDue() {
  const day = toHkInput(hkAddDays(new Date(), FOLLOW_UP_DAYS), "date");
  return `${day}T10:00`;
}

/**
 * Shown after a task is completed: offers the next task, linked to the same contact,
 * company and deal. Optional — "No next task" closes it.
 * props: task (the completed task, populated), links ({ deal, contact, company }), onDone(createdTask|null)
 */
export default function NextTaskPrompt({ task, links, onDone }) {
  const { request } = useAuth();
  const [form, setForm] = useState({ title: "", dueAt: defaultDue(), priority: task.priority || "medium" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  async function create(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError("What's the next step? Give the task a title."); return; }
    setSaving(true); setError("");
    try {
      const body = {
        title: form.title.trim(),
        priority: form.priority,
        dueAt: fromHkInput(form.dueAt).toISOString(),
        assignedTo: task.assignedTo?._id || task.assignedTo || undefined,
        contactId: links.contact?._id || undefined,
        companyId: links.company?._id || undefined,
        dealId: links.deal?._id || undefined,
      };
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      const r = await request("/tasks", { method: "POST", body });
      setCreated(r.data || {});
    } catch (err) { setError(err.message || "Could not create the task."); }
    finally { setSaving(false); }
  }

  if (created) return (
    <section className="dl-card next-task" aria-live="polite">
      <h3 className="dl-card-title">Next task created</h3>
      <p>"{created.title || form.title}" is due {new Date(created.dueAt || fromHkInput(form.dueAt)).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</p>
      <div className="next-task-actions">
        {created._id && <Link className="btn ghost" to={recordHref.task(created._id)}>Open it</Link>}
        {links.deal && <Link className="btn ghost" to={recordHref.deal(links.deal._id)}>Go to the deal</Link>}
        <button type="button" className="btn ghost" onClick={() => onDone(created)}>Close</button>
      </div>
    </section>
  );

  const linkedTo = [links.deal && `deal "${links.deal.title}"`, links.contact && "the same contact", links.company && "company"].filter(Boolean);
  return (
    <section className="dl-card next-task" aria-label="Create the next task">
      <h3 className="dl-card-title">Task completed. What's next?</h3>
      <p className="lk-muted">Create the follow-up now{linkedTo.length ? `, linked to ${linkedTo.join(", ")}` : ""}.{links.deal ? " Or move the deal to its next stage from the deal page instead." : ""}</p>
      <form className="next-task-form" onSubmit={create}>
        <label className="next-task-title">Next task
          <input autoFocus value={form.title} disabled={saving} placeholder="e.g. Call to confirm the viewing"
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label>Due
          <input type="datetime-local" value={form.dueAt} disabled={saving} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
        </label>
        <label>Priority
          <select value={form.priority} disabled={saving} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {[["low", "Low"], ["medium", "Medium"], ["high", "High"], ["urgent", "Urgent"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div className="next-task-actions">
          <button type="submit" className="btn primary" disabled={saving}>{saving ? "Creating…" : "Create next task"}</button>
          {links.deal && <Link className="btn ghost" to={recordHref.deal(links.deal._id)}>Update the deal stage</Link>}
          <button type="button" className="btn ghost" disabled={saving} onClick={() => onDone(null)}>No next task</button>
        </div>
      </form>
      {error && <p className="lk-warn-text">{error}</p>}
    </section>
  );
}
