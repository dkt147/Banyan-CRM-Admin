import React, { useEffect, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const empty = {
  name: "",
  subject: "",
  body: "",
  category: "membership",
  triggerStage: "",
  variables: [],
  followUp: { enabled: false, delayDays: 0 },
  isActive: true,
};
export default function Templates() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState(null),
    [modal, setModal] = useState(false),
    [form, setForm] = useState(empty),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await request("/templates", { query: { limit: 100 } });
      const x = r.data?.items || [];
      setRows(x);
      setSelected((s) => (s ? x.find((t) => t._id === s._id) || x[0] : x[0]));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function openNew() {
    setSelected(null);
    setForm(empty);
    setModal(true);
  }
  function edit() {
    if (selected) {
      setForm({ ...selected });
      setModal(true);
    }
  }
  async function save() {
    try {
      const body = {
        ...form,
        variables: Array.isArray(form.variables) ? form.variables : [],
      };
      if (selected)
        await request(`/templates/${selected._id}`, { method: "PATCH", body });
      else await request("/templates", { method: "POST", body });
      setModal(false);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove() {
    if (!selected) return;
    if (!confirm("Delete this template?")) return;
    try {
      await request(`/templates/${selected._id}`, { method: "DELETE" });
      setSelected(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function duplicate() {
    if (!selected) return;
    try {
      await request("/templates", {
        method: "POST",
        body: {
          name: `${selected.name} copy`,
          subject: selected.subject,
          body: selected.body,
          category: selected.category,
          variables: selected.variables || [],
          triggerStage: selected.triggerStage,
          followUp: selected.followUp,
          isActive: selected.isActive,
        },
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Templates"
      kicker="Reusable customer communication"
      actions={
        <button className="btn primary" onClick={openNew}>
          New template
        </button>
      }
    >
      {error && (
        <div className="notice error">
          <b>Templates</b>
          <span>{error}</span>
        </div>
      )}
      <div className="contact-grid">
        <section className="panel contact-list">
          {rows.length === 0 ? (
            <Empty text="No templates yet." />
          ) : (
            rows.map((t) => (
              <button
                key={t._id}
                className={`contact-row ${selected?._id === t._id ? "selected" : ""}`}
                onClick={() => setSelected(t)}
              >
                <div>
                  <b>{t.name}</b>
                  <span>
                    {t.category || "General"} ·{" "}
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </button>
            ))
          )}
        </section>
        <section className="panel contact-detail">
          {!selected ? (
            <Empty text="Select a template." />
          ) : (
            <>
              <div className="profile-head">
                <div>
                  <span className="eyebrow">
                    {selected.category || "Template"}
                  </span>
                  <h2>{selected.name}</h2>
                </div>
                <div className="actions">
                  <button className="btn ghost" onClick={duplicate}>
                    Duplicate
                  </button>
                  <button className="btn ghost" onClick={edit}>
                    Edit
                  </button>
                  <button className="btn ghost" onClick={remove}>
                    Delete
                  </button>
                </div>
              </div>
              <SectionTitle title={selected.subject} />
              <div className="template-preview">{selected.body}</div>
            </>
          )}
        </section>
      </div>
      {modal && (
        <Modal
          title={selected ? "Edit template" : "New template"}
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={save}>
                Save template
              </button>
            </>
          }
        >
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Subject
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </label>
          <label>
            Category
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label>
            Body
            <textarea
              rows="9"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
        </Modal>
      )}
    </Page>
  );
}
