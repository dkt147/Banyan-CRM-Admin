import React, { useEffect, useMemo, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

export default function Pipelines() {
  const { request } = useAuth();
  const [pipelines, setPipelines] = useState([]),
    [pipe, setPipe] = useState(null),
    [stages, setStages] = useState([]),
    [deals, setDeals] = useState([]),
    [contacts, setContacts] = useState([]),
    [companies, setCompanies] = useState([]);
  const [view, setView] = useState("Kanban"),
    [drawer, setDrawer] = useState(null),
    [newDeal, setNewDeal] = useState(false),
    [form, setForm] = useState({
      title: "",
      contactId: "",
      companyId: "",
      value: "",
      productType: "membership",
      source: "website",
    }),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function loadPipelines() {
    const r = await request("/pipelines", { query: { limit: 100 } });
    const rows = r.data?.items || r.data || [];
    setPipelines(rows);
    setPipe((p) =>
      p ? rows.find((x) => x._id === p._id) || rows[0] : rows[0],
    );
  }
  async function loadData(p) {
    if (!p) return;
    try {
      const [s, d, c, co] = await Promise.all([
        request(`/pipelines/${p._id}/stages`),
        request("/deals", { query: { pipelineId: p._id, limit: 100 } }),
        request("/contacts", { query: { limit: 100 } }),
        request("/companies", { query: { limit: 100 } }),
      ]);
      setStages(s.data || []);
      setDeals(d.data?.items || []);
      setContacts(c.data?.items || []);
      setCompanies(co.data?.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    loadPipelines().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    loadData(pipe);
  }, [pipe]);
  const grouped = useMemo(
    () =>
      Object.fromEntries(
        stages.map((s) => [
          s._id,
          deals.filter(
            (d) => String(d.stageId?._id || d.stageId) === String(s._id),
          ),
        ]),
      ),
    [stages, deals],
  );
  async function createDeal() {
    setSaving(true);
    try {
      const stage = stages[0];
      if (!stage) throw new Error("Selected pipeline has no stages.");
      const payload = {
        ...form,
        value: Number(form.value) || 0,
        pipelineId: pipe._id,
        stageId: stage._id,
      };
      if (!payload.companyId) delete payload.companyId;
      const r = await request("/deals", { method: "POST", body: payload });
      setDeals((d) => [r.data, ...d]);
      setNewDeal(false);
      setForm({
        title: "",
        contactId: "",
        companyId: "",
        value: "",
        productType: "membership",
        source: "website",
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function moveDeal(deal, stageId) {
    try {
      const r = await request(`/deals/${deal._id}/move`, {
        method: "PATCH",
        body: { stageId },
      });
      setDeals((ds) => ds.map((d) => (d._id === deal._id ? r.data : d)));
      setDrawer(r.data);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Pipelines"
      kicker={`${deals.length} open/current deals`}
      actions={
        <>
          <div className="seg">
            <button
              className={view === "Kanban" ? "on" : ""}
              onClick={() => setView("Kanban")}
            >
              Kanban
            </button>
            <button
              className={view === "Table" ? "on" : ""}
              onClick={() => setView("Table")}
            >
              Table
            </button>
          </div>
          <button
            className="btn ghost"
            onClick={async () => {
              const name = prompt("Pipeline name");
              if (!name) return;
              const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              try {
                await request("/pipelines", {
                  method: "POST",
                  body: {
                    name,
                    key,
                    isActive: true,
                    sortOrder: pipelines.length,
                  },
                });
                await loadPipelines();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            New pipeline
          </button>
          <button className="btn primary" onClick={() => setNewDeal(true)}>
            New deal
          </button>
        </>
      }
    >
      {error && (
        <div className="notice error">
          <b>Pipelines</b>
          <span>{error}</span>
        </div>
      )}
      <div className="pipeline-tabs">
        {pipelines.map((p) => (
          <button
            key={p._id}
            className={pipe?._id === p._id ? "active" : ""}
            onClick={() => setPipe(p)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="pipeline-summary">
        <b>{deals.length} open</b>
        <span>{pipe?.name || "Pipeline"}</span>
        <span>{stages.length} stages</span>
        {pipe && (
          <>
            <button
              className="btn ghost"
              onClick={async () => {
                const name = prompt("Stage name");
                if (!name) return;
                const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                try {
                  await request(`/pipelines/${pipe._id}/stages`, {
                    method: "POST",
                    body: {
                      name,
                      key,
                      sortOrder: stages.length,
                      probability: 0,
                      isActive: true,
                    },
                  });
                  loadData(pipe);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Add stage
            </button>
            <button
              className="btn ghost"
              onClick={async () => {
                if (!confirm("Delete this pipeline?")) return;
                try {
                  await request(`/pipelines/${pipe._id}`, { method: "DELETE" });
                  await loadPipelines();
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Delete pipeline
            </button>
          </>
        )}
      </div>
      {view === "Kanban" ? (
        <div className="kanban">
          {stages.map((s) => (
            <div className="kanban-col" key={s._id}>
              <div className="kanban-head">
                <b>{s.name}</b>
                <span>
                  {grouped[s._id]
                    ?.reduce((a, d) => a + (d.value || 0), 0)
                    .toLocaleString("en-HK")}{" "}
                  <button
                    className="btn ghost"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Delete stage?")) return;
                      try {
                        await request(`/pipelines/stages/${s._id}`, {
                          method: "DELETE",
                        });
                        loadData(pipe);
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    ×
                  </button>
                </span>
              </div>
              {(grouped[s._id] || []).map((d) => (
                <button
                  className="deal-card"
                  key={d._id}
                  onClick={() => setDrawer(d)}
                >
                  <b>{d.title}</b>
                  <span>
                    {d.productType || "Deal"} · HK$
                    {Number(d.value || 0).toLocaleString()}
                  </span>
                  <small>
                    {d.contactId?.firstName || "Contact"}{" "}
                    {d.contactId?.lastName || ""}
                  </small>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Contact</th>
                <th>Stage</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d._id} onClick={() => setDrawer(d)}>
                  <td>
                    <b>{d.title}</b>
                  </td>
                  <td>
                    {d.contactId?.firstName} {d.contactId?.lastName}
                  </td>
                  <td>
                    <Badge>{d.stageId?.name || "—"}</Badge>
                  </td>
                  <td>HK${Number(d.value || 0).toLocaleString()}</td>
                  <td>{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {drawer && (
        <DealDrawer
          deal={drawer}
          stages={stages}
          onMove={moveDeal}
          onClose={() => setDrawer(null)}
        />
      )}
      {newDeal && (
        <Modal
          title="New deal"
          onClose={() => setNewDeal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setNewDeal(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={saving}
                onClick={createDeal}
              >
                {saving ? "Creating…" : "Create deal"}
              </button>
            </>
          }
        >
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Private office — 4 desks"
            />
          </label>
          <label>
            Contact
            <select
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
            >
              <option value="">Select contact</option>
              {contacts.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Company
            <select
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
            >
              <option value="">No company</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Value
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </label>
            <label>
              Product type
              <select
                value={form.productType}
                onChange={(e) =>
                  setForm({ ...form, productType: e.target.value })
                }
              >
                <option value="membership">Membership</option>
                <option value="private_office">Private office</option>
                <option value="venue_hire">Venue hire</option>
                <option value="transactional">Transactional</option>
              </select>
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}
function DealDrawer({ deal, stages, onMove, onClose }) {
  return (
    <div className="drawer">
      <div className="drawer-head">
        <div>
          <span className="eyebrow">Deal · {deal.productType || "CRM"}</span>
          <h2>{deal.title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="drawer-body">
        <div className="deal-meta">
          <Badge>{deal.status}</Badge>
          <Badge>HK${Number(deal.value || 0).toLocaleString()}</Badge>
        </div>
        <dl>
          <dt>Contact</dt>
          <dd>
            {deal.contactId?.firstName} {deal.contactId?.lastName}
          </dd>
          <dt>Company</dt>
          <dd>{deal.companyId?.name || "—"}</dd>
          <dt>Stage</dt>
          <dd>{deal.stageId?.name || "—"}</dd>
          <dt>Source</dt>
          <dd>{deal.source || "—"}</dd>
        </dl>
        <SectionTitle title="Move stage" />
        <div className="form-grid">
          {stages.map((s) => (
            <button
              key={s._id}
              className="btn ghost"
              onClick={() => onMove(deal, s._id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <div className="drawer-actions">
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
