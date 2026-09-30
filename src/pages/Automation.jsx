import React, { useEffect, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
export default function Automation() {
  const { request } = useAuth();
  const [rules, setRules] = useState([]),
    [integrations, setIntegrations] = useState([]),
    [modal, setModal] = useState(false),
    [form, setForm] = useState({
      name: "",
      description: "",
      trigger: "",
      conditions: [],
      actions: [],
      isEnabled: true,
    }),
    [error, setError] = useState("");
  async function load() {
    try {
      const [r, i] = await Promise.all([
        request("/automations"),
        request("/integrations", { query: { limit: 100 } }),
      ]);
      setRules(r.data || []);
      setIntegrations(i.data?.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create() {
    try {
      await request("/automations", { method: "POST", body: form });
      setModal(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function toggle(r) {
    try {
      await request(`/automations/${r._id}`, {
        method: "PATCH",
        body: { isEnabled: !r.isEnabled },
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function execute(r) {
    try {
      await request(`/automations/${r._id}/execute`, {
        method: "POST",
        body: { context: { source: "crm-ui" } },
      });
      alert("Automation executed.");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Automations & connections"
      kicker="Rules and integration status"
      actions={
        <button className="btn primary" onClick={() => setModal(true)}>
          New rule
        </button>
      }
    >
      {error && (
        <div className="notice error">
          <b>Automation</b>
          <span>{error}</span>
        </div>
      )}
      <div className="automation-grid">
        <section>
          <SectionTitle title="Rules" />
          {rules.length === 0 ? (
            <Empty text="No automation rules configured." />
          ) : (
            rules.map((r) => (
              <div className="rule panel" key={r._id}>
                <div className="rule-copy">
                  <div>
                    <span>{r.name}</span> <b>{r.trigger}</b>
                  </div>
                  <small>
                    {r.description ||
                      `${r.actions?.length || 0} actions · ${r.conditions?.length || 0} conditions`}
                  </small>
                </div>
                <button
                  className={`switch ${r.isEnabled ? "on" : ""}`}
                  onClick={() => toggle(r)}
                >
                  <i />
                </button>
                <button className="btn ghost" onClick={() => execute(r)}>
                  Run
                </button>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    try {
                      const x = await request(
                        `/automations/${r._id}/executions`,
                      );
                      alert(`Executions: ${(x.data || []).length}`);
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  History
                </button>
              </div>
            ))
          )}
        </section>
        <section>
          <SectionTitle title="Connected tools" />
          {integrations.length === 0 ? (
            <Empty text="No integration records." />
          ) : (
            integrations.map((i) => (
              <div className="connection panel" key={i._id}>
                <div>
                  <b>{i.provider}</b>
                  <span>
                    {i.accountName || i.externalAccountId || "No account"}
                  </span>
                </div>
                <Badge tone={i.status === "connected" ? "" : "warn"}>
                  {i.status}
                </Badge>
              </div>
            ))
          )}
        </section>
      </div>
      {modal && (
        <Modal
          title="New automation rule"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={create}>
                Create rule
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
            Trigger
            <input
              value={form.trigger}
              onChange={(e) => setForm({ ...form, trigger: e.target.value })}
              placeholder="deal_stage_changed"
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
        </Modal>
      )}
    </Page>
  );
}
