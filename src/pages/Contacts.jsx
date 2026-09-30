import React, { useEffect, useMemo, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const blank = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  whatsapp: "",
  jobTitle: "",
  companyId: "",
  source: "",
  language: "en",
  notes: "",
};

export default function Contacts() {
  const { request } = useAuth();
  const [contacts, setContacts] = useState([]),
    [companies, setCompanies] = useState([]),
    [selected, setSelected] = useState(null);
  const [search, setSearch] = useState(""),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState(false),
    [form, setForm] = useState(blank),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [c, co] = await Promise.all([
        request("/contacts", { query: { limit: 100, search } }),
        request("/companies", { query: { limit: 100 } }),
      ]);
      const rows = c.data?.items || [];
      setContacts(rows);
      setCompanies(co.data?.items || []);
      setSelected((prev) =>
        prev ? rows.find((x) => x._id === prev._id) || rows[0] : rows[0],
      );
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [search]);

  async function saveContact() {
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      if (!payload.companyId) delete payload.companyId;
      const r =
        editing && selected
          ? await request(`/contacts/${selected._id}`, {
              method: "PATCH",
              body: payload,
            })
          : await request("/contacts", { method: "POST", body: payload });
      setModal(false);
      setForm(blank);
      setEditing(false);
      await load();
      setSelected(r.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  const companyName = useMemo(
    () => Object.fromEntries(companies.map((c) => [c._id, c.name])),
    [companies],
  );
  const updateField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Page
      title="Contacts"
      kicker={`${contacts.length} loaded contacts`}
      actions={
        <>
          <input
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, phone…"
          />
          <button
            className="btn primary"
            onClick={() => {
              setEditing(false);
              setSelected(null);
              setForm(blank);
              setModal(true);
            }}
          >
            New contact
          </button>
        </>
      }
    >
      {error && (
        <div className="notice error">
          <b>Contacts</b>
          <span>{error}</span>
        </div>
      )}
      <div className="contact-grid">
        <section className="panel contact-list">
          <div className="filters">
            <button className="on">All</button>
          </div>
          {contacts.length === 0 ? (
            <Empty text="No contacts found." />
          ) : (
            contacts.map((c) => (
              <button
                className={`contact-row ${selected?._id === c._id ? "selected" : ""}`}
                onClick={() => setSelected(c)}
                key={c._id}
              >
                <span className="avatar">
                  {`${c.firstName?.[0] || ""}${c.lastName?.[0] || ""}`.toUpperCase()}
                </span>
                <div>
                  <b>{c.fullName || `${c.firstName} ${c.lastName}`}</b>
                  <span>
                    {companyName[c.companyId?._id || c.companyId] ||
                      c.jobTitle ||
                      c.email ||
                      "Contact"}
                  </span>
                </div>
              </button>
            ))
          )}
        </section>
        <section className="panel contact-detail">
          {!selected ? (
            <Empty text="Select a contact." />
          ) : (
            <>
              <div className="profile-head">
                <span className="avatar big">
                  {`${selected.firstName?.[0] || ""}${selected.lastName?.[0] || ""}`.toUpperCase()}
                </span>
                <div>
                  <span className="eyebrow">
                    {selected.jobTitle || "Contact"} ·{" "}
                    {companyName[
                      selected.companyId?._id || selected.companyId
                    ] || "No company"}
                  </span>
                  <h2>
                    {selected.fullName ||
                      `${selected.firstName} ${selected.lastName}`}
                  </h2>
                  <div className="badges">
                    <Badge>{selected.source || "Direct"}</Badge>
                    {selected.language && <Badge>{selected.language}</Badge>}
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setEditing(true);
                      setForm({
                        ...blank,
                        firstName: selected.firstName || "",
                        lastName: selected.lastName || "",
                        email: selected.email || "",
                        phone: selected.phone || "",
                        whatsapp: selected.whatsapp || "",
                        jobTitle: selected.jobTitle || "",
                        companyId:
                          selected.companyId?._id || selected.companyId || "",
                        source: selected.source || "",
                        language: selected.language || "en",
                        notes: selected.notes || "",
                      });
                      setModal(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      try {
                        await request("/activities", {
                          method: "POST",
                          body: {
                            type: "call",
                            contactId: selected._id,
                            subject: "Call logged",
                            body: "Call logged from CRM",
                          },
                        });
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Log call
                  </button>
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      if (!confirm("Archive this contact?")) return;
                      try {
                        await request(`/contacts/${selected._id}/archive`, {
                          method: "PATCH",
                        });
                        await load();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Archive
                  </button>
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      if (!confirm("Delete this contact?")) return;
                      try {
                        await request(`/contacts/${selected._id}`, {
                          method: "DELETE",
                        });
                        await load();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="detail-grid">
                <Info label="Email" value={selected.email || "—"} />
                <Info
                  label="Phone / WhatsApp"
                  value={selected.phone || selected.whatsapp || "—"}
                />
                <Info label="Source" value={selected.source || "—"} />
                <Info label="Language" value={selected.language || "—"} />
                <Info
                  label="Owner"
                  value={selected.ownerId?.name || "Assigned user"}
                />
                <Info
                  label="Company"
                  value={
                    companyName[
                      selected.companyId?._id || selected.companyId
                    ] || "—"
                  }
                />
              </div>
              <SectionTitle title="Notes" />
              <p className="detail-note">{selected.notes || "No notes yet."}</p>
            </>
          )}
        </section>
      </div>
      {modal && (
        <Modal
          title={selected?._id ? "Edit contact" : "New contact"}
          onClose={() => {
            setModal(false);
            setForm(blank);
            setEditing(false);
          }}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={saving}
                onClick={saveContact}
              >
                {saving ? "Saving…" : editing ? "Save" : "Create contact"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <Field
              label="First name"
              value={form.firstName}
              onChange={(v) => updateField("firstName", v)}
            />
            <Field
              label="Last name"
              value={form.lastName}
              onChange={(v) => updateField("lastName", v)}
            />
            <Field
              label="Email"
              value={form.email}
              onChange={(v) => updateField("email", v)}
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => updateField("phone", v)}
            />
            <Field
              label="Job title"
              value={form.jobTitle}
              onChange={(v) => updateField("jobTitle", v)}
            />
            <label>
              Company
              <select
                value={form.companyId}
                onChange={(e) => updateField("companyId", e.target.value)}
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </label>
        </Modal>
      )}
    </Page>
  );
}
function Field({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <span className="eyebrow">{label}</span>
      <b>{value}</b>
    </div>
  );
}
