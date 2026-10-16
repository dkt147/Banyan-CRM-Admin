import React, { useEffect, useState } from "react";
import { Page, SectionTitle } from "./Dashboard";
import { useAuth } from "../auth/AuthContext";
export default function Workspace() {
  const { request, user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    timezone: "Asia/Hong_Kong",
    currency: "HKD",
    logoUrl: "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    request("/workspace")
      .then((r) => setForm((x) => ({ ...x, ...r.data })))
      .catch((e) => setError(e.message));
  }, [request]);
  async function save() {
    try {
      await request("/workspace", { method: "PATCH", body: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Workspace settings"
      kicker="Workspace and organization configuration"
      className="workspace-page"
    >
      <section className="panel workspace-panel">
        <SectionTitle
          title="Workspace profile"
          note={`Signed in as ${user?.email || ""}`}
        />
        {error && <div className="notice error">{error}</div>}
        {saved && <div className="notice">Workspace saved.</div>}
        <div className="form-grid workspace-form-grid">
          <Field l="Name" k="name" f={form} s={setForm} />
          <Field l="Slug" k="slug" f={form} s={setForm} />
          <Field l="Timezone" k="timezone" f={form} s={setForm} />
          <Field l="Currency" k="currency" f={form} s={setForm} />
          <Field l="Logo URL" k="logoUrl" f={form} s={setForm} />
        </div>
        <label className="workspace-description-field">
          Description
          <textarea
            rows={5}
            value={form.description || ""}
            placeholder="Add a short description of your workspace and organization…"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <small className="form-help">This description helps identify your workspace.</small>
        </label>
        <div className="actions workspace-save-actions">
          <button className="btn primary" onClick={save}>
            Save workspace
          </button>
        </div>
      </section>
    </Page>
  );
}
function Field({ l, k, f, s }) {
  return (
    <label>
      {l}
      <input
        value={f[k] || ""}
        onChange={(e) => s({ ...f, [k]: e.target.value })}
      />
    </label>
  );
}
