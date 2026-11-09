import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Badge from "../../components/Badge";
import { Card, DetailLayout, FieldGrid, fmtDate, fmtDateTime } from "../../components/DetailLayout";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../utils/permissions";
import { recordHref } from "../../utils/recordLinks";
import { invalidateLookups, personLabel, useLookups } from "../../utils/useLookups";
import { fromHkInput } from "../../utils/hkTime";

export const formatMoney = (value, currency = "HKD") => {
  const n = Number(value || 0);
  try { return new Intl.NumberFormat("en-HK", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `${currency} ${n.toLocaleString()}`; }
};
const STATUSES = [["open", "Open"], ["won", "Won"], ["lost", "Lost"]];

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { request } = useAuth();
  const canWrite = usePermissions().can("records.write");
  const { pipelines } = useLookups(["pipelines"]);
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [move, setMove] = useState({ pipelineId: "", stageId: "", stages: [], saving: false });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDeal((await request(`/deals/${id}`)).data || null); }
    catch (e) { setError(e.status === 404 ? "This deal was not found." : e.message || "Could not load the deal."); }
    finally { setLoading(false); }
  }, [id, request]);
  useEffect(() => { load(); }, [load]);

  const pipelineId = move.pipelineId || deal?.pipelineId?._id || "";
  useEffect(() => {
    if (!pipelineId) return;
    request(`/pipelines/${pipelineId}/stages`, { query: { isActive: true, sort: "sortOrder", order: "asc" } })
      .then((r) => setMove((m) => ({ ...m, stages: r.data?.items || r.data || [] })))
      .catch(() => setMove((m) => ({ ...m, stages: [] })));
  }, [pipelineId, request]);

  async function patch(body) {
    const response = await request(`/deals/${id}`, { method: "PATCH", body });
    setDeal(response.data);
    invalidateLookups("deals");
  }
  async function save(changed) {
    const body = { ...changed };
    if ("value" in body) {
      const n = body.value === "" ? 0 : Number(body.value);
      if (Number.isNaN(n) || n < 0) throw new Error("Deal value must be a positive number.");
      body.value = n;
    }
    if ("paymentReceivedConfirmed" in body) body.paymentReceivedConfirmed = body.paymentReceivedConfirmed === "yes";
    // Dates are Hong Kong calendar dates.
    for (const key of ["expectedCloseDate", "membershipStartAt", "membershipEndAt"])
      if (key in body) body[key] = body[key] ? fromHkInput(body[key]).toISOString() : null;
    await patch(body);
  }
  async function moveStage() {
    const stageId = move.stageId || move.stages[0]?._id;
    if (!stageId) return;
    setMove((m) => ({ ...m, saving: true })); setActionError("");
    try { await patch({ pipelineId, stageId }); setMove({ pipelineId: "", stageId: "", stages: move.stages, saving: false }); }
    catch (e) { setActionError(e.message); setMove((m) => ({ ...m, saving: false })); }
  }
  async function remove() {
    if (!window.confirm(`Delete "${deal.title}"? This cannot be undone.`)) return;
    try { await request(`/deals/${id}`, { method: "DELETE" }); invalidateLookups("deals"); navigate("/deal"); }
    catch (e) { setActionError(e.message); }
  }

  const contact = deal?.contactId && typeof deal.contactId === "object" ? deal.contactId : null;
  const company = deal?.companyId && typeof deal.companyId === "object" ? deal.companyId : null;
  const isVirtualOffice = deal?.pipelineId?.key === "virtual-office";

  return (
    <DetailLayout
      type="deal" id={id} listPath="/deal" listLabel="Deals"
      title={deal?.title} subtitle={deal ? `Deal ${deal.dealNumber ? `#${deal.dealNumber}` : ""} · ${deal.pipelineId?.name || ""}` : ""}
      loading={loading} error={error} onRetry={load}
      badges={deal && <><Badge>{deal.stageId?.name || "—"}</Badge><Badge tone={deal.status === "won" ? "good" : deal.status === "lost" ? "warn" : ""}>{deal.status}</Badge><b className="dl-amount">{formatMoney(deal.value, deal.currency)}</b></>}
      actions={canWrite && deal && <button type="button" className="btn ghost" onClick={remove}>Delete</button>}
    >
      {actionError && <div className="notice error"><b>Deals</b><span>{actionError}</span></div>}
      {deal && <>
        <Card title="People">
          <dl className="dl-fields">
            <div className="dl-field"><dt>Contact</dt><dd>{contact ? <Link to={recordHref.contact(contact._id)}>{personLabel(contact)}</Link> : "—"}{contact?.email && <small className="dl-sub">{contact.email}</small>}</dd></div>
            <div className="dl-field"><dt>Company</dt><dd>{company ? <Link to={recordHref.company(company._id)}>{company.name}</Link> : "—"}</dd></div>
            <div className="dl-field"><dt>Owner</dt><dd>{deal.ownerId?.name || "—"}</dd></div>
            <div className="dl-field"><dt>Source</dt><dd>{deal.source || "—"}</dd></div>
          </dl>
        </Card>
        <FieldGrid
          canEdit={canWrite}
          onSave={save}
          fields={[
            { key: "title", label: "Title", value: deal.title, required: true, span: true },
            { key: "value", label: "Value", type: "number", value: deal.value ?? 0, display: formatMoney(deal.value, deal.currency) },
            { key: "productType", label: "Product type", value: deal.productType },
            { key: "status", label: "Status", type: "select", value: deal.status, options: STATUSES, display: (STATUSES.find(([v]) => v === deal.status) || [])[1] },
            { key: "paymentReceivedConfirmed", label: "Payment received (required for Won)", type: "select", value: deal.metadata?.paymentReceivedConfirmed ? "yes" : "no", options: [["no", "No"], ["yes", "Yes"]], display: deal.metadata?.paymentReceivedConfirmed ? "Yes" : "No" },
            { key: "lostReason", label: "Lost reason (required for Lost)", value: deal.lostReason },
            { key: "expectedCloseDate", label: "Expected close", type: "date", value: deal.expectedCloseDate, display: fmtDate(deal.expectedCloseDate) },
            ...(isVirtualOffice ? [
              { key: "membershipStartAt", label: "Membership start", type: "date", value: deal.membershipStartAt, display: fmtDate(deal.membershipStartAt) },
              { key: "membershipEndAt", label: "Membership end / renewal", type: "date", value: deal.membershipEndAt, display: fmtDate(deal.membershipEndAt) },
            ] : []),
            { key: "description", label: "Description", type: "textarea", value: deal.description, span: true },
          ]}
        />
        {canWrite && <Card title="Pipeline and stage">
          <div className="dl-inline-form">
            <label>Pipeline
              <select value={pipelineId} onChange={(e) => setMove({ ...move, pipelineId: e.target.value, stageId: "" })}>
                {pipelines.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                {!pipelines.some((p) => p._id === deal.pipelineId?._id) && deal.pipelineId && <option value={deal.pipelineId._id}>{deal.pipelineId.name}</option>}
              </select>
            </label>
            <label>Stage
              <select value={move.stageId || (pipelineId === deal.pipelineId?._id ? deal.stageId?._id : "") || ""} onChange={(e) => setMove({ ...move, stageId: e.target.value })}>
                {move.stages.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </label>
            <button type="button" className="btn primary" disabled={move.saving || (!move.stageId && pipelineId === deal.pipelineId?._id)} onClick={moveStage}>{move.saving ? "Moving…" : "Move"}</button>
          </div>
          <p className="lk-muted">Stage changed {fmtDateTime(deal.stageChangedAt)} · last activity {fmtDateTime(deal.lastActivityAt)}</p>
        </Card>}
      </>}
    </DetailLayout>
  );
}
