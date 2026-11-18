import React, { useState } from "react";
import Modal from "./Modal";
import { useAuth } from "../auth/AuthContext";
import { invalidateLookups } from "../utils/useLookups";

// Create a company without leaving the contact or deal page (POST /companies).
// onCreated(company) links it to the current record.
export default function NewCompanyModal({ initial = {}, onCreated, onClose }) {
  const { request } = useAuth();
  const [form, setForm] = useState({ name: "", industry: "", website: "", email: "", phone: "", ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    const name = form.name.trim();
    if (name.length < 2) { setError("Company name must be at least 2 characters."); return; }
    let website = form.website.trim();
    if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
    const body = { name, industry: form.industry.trim() || null, website: website || null, email: form.email.trim() || null, phone: form.phone.trim() || null };
    setSaving(true); setError("");
    try {
      const r = await request("/companies", { method: "POST", body });
      invalidateLookups("companies");
      await onCreated(r.data);
    } catch (e) { setError(e.message || "Could not create the company."); setSaving(false); }
  }

  return (
    <Modal title="New company" onClose={() => !saving && onClose()} actions={<>
      <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
      <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? "Creating…" : "Create and link"}</button>
    </>}>
      {error && <div className="notice error"><b>Company</b><span>{error}</span></div>}
      <div className="form-grid">
        <label className="form-span-2">Company name<span className="required-mark"> *</span><input autoFocus value={form.name} onChange={set("name")} placeholder="e.g. Harbour Ventures Ltd" /></label>
        <label>Industry<input value={form.industry} onChange={set("industry")} /></label>
        <label>Website<input value={form.website} onChange={set("website")} placeholder="example.com" /></label>
        <label>Email<input type="email" value={form.email} onChange={set("email")} /></label>
        <label>Phone<input value={form.phone} onChange={set("phone")} /></label>
      </div>
    </Modal>
  );
}
