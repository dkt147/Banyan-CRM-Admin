import React, { useEffect, useState } from "react";
import { Page, Empty, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const blank = {
  name: "",
  legalName: "",
  industry: "",
  website: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  notes: "",
};
export default function Companies() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState(null),
    [modal, setModal] = useState(false),
    [form, setForm] = useState(blank),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  async function load() {
    try {
      const r = await request("/companies", {
        query: { limit: 100, search: search || undefined, isArchived: "false" },
      });
      const x = r.data?.items || [];
      setRows(x);
      setSelected((s) => (s ? x.find((c) => c._id === s._id) || x[0] : x[0]));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [search]);
  function open(c = null) {
    setSelected(c);
    setForm(
      c
        ? {
            ...blank,
            ...c,
            city: c.address?.city || "",
            country: c.address?.country || "",
          }
        : blank,
    );
    setModal(true);
  }
  async function save() {
    try {
      const body = {
        name: form.name,
        legalName: form.legalName || null,
        industry: form.industry || null,
        website: form.website || null,
        email: form.email || null,
        phone: form.phone || null,
        address: { city: form.city || null, country: form.country || null },
        notes: form.notes || null,
      };
      await request(selected ? `/companies/${selected._id}` : "/companies", {
        method: selected ? "PATCH" : "POST",
        body,
      });
      setModal(false);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function archive(id) {
    if (!confirm("Archive this company?")) return;
    try {
      await request(`/companies/${id}/archive`, { method: "PATCH" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(id) {
    if (!confirm("Delete this company?")) return;
    try {
      await request(`/companies/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Companies"
      kicker="Organizations and accounts"
      actions={
        <button className="btn primary" onClick={() => open()}>
          New company
        </button>
      }
    >
      {error && (
        <div className="notice error">
          <b>Companies</b>
          <span>{error}</span>
        </div>
      )}
      <div className="toolbar">
        <input
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>{rows.length} active companies</span>
      </div>
      <div className="contact-grid">
        <section className="panel contact-list">
          {rows.length === 0 ? (
            <Empty text="No companies found." />
          ) : (
            rows.map((c) => (
              <button
                className={`contact-row ${selected?._id === c._id ? "selected" : ""}`}
                key={c._id}
                onClick={() => setSelected(c)}
              >
                <span className="avatar">{(c.name || "C")[0]}</span>
                <div>
                  <b>{c.name}</b>
                  <span>{c.industry || c.email || "Company"}</span>
                </div>
              </button>
            ))
          )}
        </section>
        <section className="panel contact-detail">
          {!selected ? (
            <Empty text="Select a company." />
          ) : (
            <>
              <div className="profile-head">
                <div>
                  <span className="eyebrow">Company</span>
                  <h2>{selected.name}</h2>
                </div>
                <div className="actions">
                  <button className="btn ghost" onClick={() => open(selected)}>
                    Edit
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => archive(selected._id)}
                  >
                    Archive
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => remove(selected._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="detail-grid">
                <Info label="Legal name" value={selected.legalName || "—"} />
                <Info label="Industry" value={selected.industry || "—"} />
                <Info label="Email" value={selected.email || "—"} />
                <Info label="Phone" value={selected.phone || "—"} />
                <Info label="Website" value={selected.website || "—"} />
                <Info label="City" value={selected.address?.city || "—"} />
              </div>
              <SectionTitle title="Notes" />
              <p className="detail-note">{selected.notes || "No notes."}</p>
            </>
          )}
        </section>
      </div>
      {modal && (
        <Modal
          title={selected ? "Edit company" : "New company"}
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={save}>
                Save
              </button>
            </>
          }
        >
          <div className="form-grid">
            <Field
              l="Name"
              v={form.name}
              s="name"
              setForm={setForm}
              form={form}
            />
            <Field
              l="Legal name"
              v={form.legalName}
              s="legalName"
              setForm={setForm}
              form={form}
            />
            <Field
              l="Industry"
              v={form.industry}
              s="industry"
              setForm={setForm}
              form={form}
            />
            <Field
              l="Email"
              v={form.email}
              s="email"
              setForm={setForm}
              form={form}
            />
            <Field
              l="Phone"
              v={form.phone}
              s="phone"
              setForm={setForm}
              form={form}
            />
            <Field
              l="Website"
              v={form.website}
              s="website"
              setForm={setForm}
              form={form}
            />
            <Field
              l="City"
              v={form.city}
              s="city"
              setForm={setForm}
              form={form}
            />
            <Field
              l="Country"
              v={form.country}
              s="country"
              setForm={setForm}
              form={form}
            />
          </div>
          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </Modal>
      )}
    </Page>
  );
}
function Field({ l, v, s, setForm, form }) {
  return (
    <label>
      {l}
      <input
        value={v || ""}
        onChange={(e) => setForm({ ...form, [s]: e.target.value })}
      />
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
