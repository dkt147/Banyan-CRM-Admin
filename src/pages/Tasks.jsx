import React, { useEffect, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

export default function Tasks() {
  const { request, user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueAt: "",
    priority: "medium",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setError("");

      const r = await request("/tasks", {
        query: {
          limit: 100,
        },
      });

      setTasks(r.data?.tasks || r.data?.items || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
      const r = await request("/tasks", {
        method: "POST",
        body: {
          ...form,
          dueAt: new Date(form.dueAt).toISOString(),
          assignedTo: user?._id,
        },
      });

      setTasks((current) => [r.data, ...current]);

      setModal(null);

      setForm({
        title: "",
        description: "",
        dueAt: "",
        priority: "medium",
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function action(task, type) {
    try {
      setError("");

      const body =
        type === "complete"
          ? {}
          : {
              snoozedUntil: new Date(
                Date.now() + 24 * 60 * 60 * 1000,
              ).toISOString(),
            };

      const r = await request(`/tasks/${task._id}/${type}`, {
        method: "PATCH",
        body,
      });

      setTasks((current) =>
        current.map((item) => (item._id === task._id ? r.data : item)),
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeTask(task) {
    if (!window.confirm("Delete this task?")) {
      return;
    }

    try {
      setError("");

      await request(`/tasks/${task._id}`, {
        method: "DELETE",
      });

      setTasks((current) => current.filter((item) => item._id !== task._id));
    } catch (e) {
      setError(e.message);
    }
  }

  const groups = ["overdue", "today", "upcoming", "completed"]
    .map((key) => {
      return [
        key,
        tasks.filter((task) => {
          const date = new Date(task.dueAt);
          const now = new Date();

          if (key === "completed") {
            return task.status === "completed";
          }

          if (task.status === "completed") {
            return false;
          }

          if (key === "overdue") {
            return date < now;
          }

          if (key === "today") {
            return date.toDateString() === now.toDateString();
          }

          return date > now && date.toDateString() !== now.toDateString();
        }),
      ];
    })
    .filter(([, items]) => items.length > 0);

  return (
    <Page
      title="Tasks"
      kicker={`${tasks.filter((task) => task.status !== "completed").length} active tasks`}
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

      {groups.length === 0 ? (
        <Empty text="No tasks found." />
      ) : (
        groups.map(([name, items]) => (
          <section className="task-group" key={name}>
            <SectionTitle title={name[0].toUpperCase() + name.slice(1)} />

            {items.map((task) => (
              <div
                className={`task-card ${
                  task.status === "completed" ? "complete" : ""
                }`}
                key={task._id}
              >
                <div>
                  <div className="task-title">
                    <b>{task.title}</b>

                    <Badge tone={name === "overdue" ? "warn" : ""}>
                      {task.priority}
                    </Badge>
                  </div>

                  <span>
                    {task.description || "No description"} · due{" "}
                    {new Date(task.dueAt).toLocaleString()}
                  </span>
                </div>

                <div className="task-actions">
                  {task.status !== "completed" && (
                    <>
                      <button
                        className="btn ghost"
                        onClick={() => action(task, "complete")}
                      >
                        Complete
                      </button>

                      <button
                        className="btn ghost"
                        onClick={() => action(task, "snooze")}
                      >
                        Snooze
                      </button>

                      <button
                        className="btn ghost"
                        onClick={() => removeTask(task)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      {modal && (
        <Modal
          title="New task"
          onClose={() => setModal(null)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(null)}>
                Cancel
              </button>

              <button
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
                  description: e.target.value,
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
                    priority: e.target.value,
                  })
                }
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="urgent">urgent</option>
              </select>
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}
