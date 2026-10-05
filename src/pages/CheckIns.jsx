import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Modal from "../components/Modal";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";

const EMPTY_FORM = {
  contactId: "",
  membershipId: "",
  checkedInAt: "",
  checkedOutAt: "",
  source: "manual",
};

function toLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function iso(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function idOf(value) {
  return typeof value === "object" ? value?._id || "" : value || "";
}

function contactName(value) {
  const c = typeof value === "object" ? value : null;
  if (!c) return value || "—";
  return c.fullName || `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email || c._id;
}

export default function CheckIns() {
  const { request } = useAuth();
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [checkIns, contactRes, membershipRes] = await Promise.all([
        request("/check-ins", { query: { page: 1, limit: 100, sort: "checkedInAt", order: "desc" } }),
        request("/contacts", { query: { page: 1, limit: 100, isArchived: false } }),
        request("/memberships", { query: { page: 1, limit: 100, sort: "renewalAt", order: "asc" } }),
      ]);
      setRows(checkIns.data?.items || []);
      setContacts(Array.isArray(contactRes.data) ? contactRes.data : contactRes.data?.items || []);
      setMemberships(membershipRes.data?.items || []);
    } catch (e) {
      setError(e.message || "Failed to load check-ins.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, checkedInAt: toLocal(new Date()) });
    setError("");
    setModal(true);
  }

  function openEdit(row) {
    setEditingId(row._id);
    setForm({
      contactId: idOf(row.contactId),
      membershipId: idOf(row.membershipId),
      checkedInAt: toLocal(row.checkedInAt),
      checkedOutAt: toLocal(row.checkedOutAt),
      source: row.source || "manual",
    });
    setError("");
    setModal(true);
  }

  async function save() {
    if (!form.contactId) return setError("Contact is required.");
    if (!form.checkedInAt) return setError("Check-in time is required.");
    if (form.checkedOutAt && new Date(form.checkedOutAt) < new Date(form.checkedInAt)) {
      return setError("Check-out time cannot be before check-in time.");
    }
    setSaving(true);
    try {
      const body = {
        contactId: form.contactId,
        membershipId: form.membershipId || undefined,
        checkedInAt: iso(form.checkedInAt),
        checkedOutAt: iso(form.checkedOutAt),
        source: form.source.trim() || "manual",
      };
      await request(editingId ? `/check-ins/${editingId}` : "/check-ins", {
        method: editingId ? "PATCH" : "POST",
        body,
      });
      setModal(false);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e.message || "Failed to save check-in.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm("Delete this check-in record?")) return;
    try {
      await request(`/check-ins/${row._id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete check-in.");
    }
  }

  return (
    <Page title="Check-ins" kicker="Membership attendance records" actions={<button className="btn primary" onClick={openCreate}>New check-in</button>}>
      {error && <div className="notice error"><b>Check-ins</b><span>{error}</span></div>}
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Contact</th><th>Membership</th><th>Checked in</th><th>Checked out</th><th>Source</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td><b>{contactName(row.contactId)}</b></td>
                <td>{row.membershipId?.memberCode || row.membershipId?._id || "—"}</td>
                <td>{row.checkedInAt ? new Date(row.checkedInAt).toLocaleString() : "—"}</td>
                <td>{row.checkedOutAt ? new Date(row.checkedOutAt).toLocaleString() : "—"}</td>
                <td><Badge>{row.source || "manual"}</Badge></td>
                <td><button className="btn ghost" onClick={() => openEdit(row)}>Edit</button>{" "}<button className="btn ghost" onClick={() => remove(row)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text={loading ? "Loading check-ins..." : "No check-ins found."} />}
      </section>

      {modal && (
        <Modal title={editingId ? "Edit check-in" : "New check-in"} onClose={() => !saving && setModal(false)} actions={<><button className="btn ghost" onClick={() => setModal(false)} disabled={saving}>Cancel</button><button className="btn primary" onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Create check-in"}</button></>}>
          <div className="form-grid">
            <label>Contact<select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}><option value="">Select contact</option>{contacts.map((c) => <option key={c._id} value={c._id}>{contactName(c)}</option>)}</select></label>
            <label>Membership<select value={form.membershipId} onChange={(e) => setForm({ ...form, membershipId: e.target.value })}><option value="">No membership</option>{memberships.map((m) => <option key={m._id} value={m._id}>{m.memberCode || m._id} · {m.status}</option>)}</select></label>
            <label>Checked in<input type="datetime-local" value={form.checkedInAt} onChange={(e) => setForm({ ...form, checkedInAt: e.target.value })} /></label>
            <label>Checked out<input type="datetime-local" value={form.checkedOutAt} onChange={(e) => setForm({ ...form, checkedOutAt: e.target.value })} /></label>
            <label>Source<input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="manual" /></label>
          </div>
        </Modal>
      )}
    </Page>
  );
}
