import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Badge from "../../components/Badge";
import { Card, DetailLayout, FieldGrid, fmtDate, fmtDateTime } from "../../components/DetailLayout";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../utils/permissions";
import { recordHref } from "../../utils/recordLinks";
import { invalidateLookups, personLabel, useLookups } from "../../utils/useLookups";
import { fromHkInput } from "../../utils/hkTime";
import NewCompanyModal from "../../components/NewCompanyModal";
import MembershipModal from "../../components/MembershipModal";
import NextTaskPrompt from "../../components/NextTaskPrompt";

// Pipelines whose won deals are memberships: offer to add the membership straight away.
const MEMBERSHIP_PIPELINES = ["membership", "private-office", "virtual-office"];
import { sourceLabel } from "../../utils/sourceLabel";

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
  const { pipelines, companies } = useLookups(["pipelines", "companies"]);
  const [newCompany, setNewCompany] = useState(false);
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [move, setMove] = useState({ pipelineId: "", stageId: "", stages: [], saving: false });
  const [dealStages, setDealStages] = useState([]);   // stages of the deal's current pipeline (stage bar)
  const [stepping, setStepping] = useState("");       // stage id being moved to from the bar
  const [closing, setClosing] = useState(null);       // { status: "won"|"lost", paid, reason, busy, error }
  const [wonMembership, setWonMembership] = useState(false);
  const [membershipAdded, setMembershipAdded] = useState(false);
  // After a stage move: "What's next?" unless that stage makes its own follow-up task.
  const [askNext, setAskNext] = useState(null);

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

  const dealPipelineId = deal?.pipelineId?._id || "";
  useEffect(() => {
    if (!dealPipelineId) return;
    request(`/pipelines/${dealPipelineId}/stages`, { query: { isActive: true, sort: "sortOrder", order: "asc" } })
      .then((r) => setDealStages(r.data?.items || r.data || []))
      .catch(() => setDealStages([]));
  }, [dealPipelineId, request]);

  // Stage bar: click a stage (or "Next") to move the deal there. The backend still enforces
  // the Won/Lost rules (payment confirmed / lost reason) and its message is shown.
  async function goToStage(stage) {
    if (!stage || stage._id === deal?.stageId?._id) return;
    setStepping(stage._id); setActionError("");
    try { await patch({ pipelineId: dealPipelineId, stageId: stage._id }); promptNext(stage); }
    catch (e) { setActionError(e.message); }
    finally { setStepping(""); }
  }

  // Won/Lost is the deal's status, separate from its stage. Won needs payment confirmed; Lost needs a reason.
  async function submitClose(e) {
    e.preventDefault();
    if (closing.status === "won" && !closing.paid) { setClosing({ ...closing, error: "Tick “Payment received” first. Finance must confirm payment before a deal is Won." }); return; }
    if (closing.status === "lost" && !closing.reason.trim()) { setClosing({ ...closing, error: "Give a reason the deal was lost." }); return; }
    setClosing({ ...closing, busy: true, error: "" });
    try {
      await patch(closing.status === "won" ? { status: "won", paymentReceivedConfirmed: true } : { status: "lost", lostReason: closing.reason.trim() });
      if (closing.status === "won" && MEMBERSHIP_PIPELINES.includes(deal?.pipelineId?.key) && deal?.contactId) setWonMembership(true);
      setClosing(null);
    } catch (err) { setClosing((c) => ({ ...c, busy: false, error: err.message })); }
  }
  function promptNext(stage) {
    if (!stage || stage.isClosedWon || stage.isClosedLost || stage.followUp?.enabled) { setAskNext(null); return; }
    setAskNext({ stage, key: `${stage._id}-${Date.now()}` });
  }
  async function reopen() {
    setActionError("");
    try { await patch({ status: "open" }); } catch (e) { setActionError(e.message); }
  }

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
    if ("companyId" in body && !body.companyId) body.companyId = null;
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
    try { await patch({ pipelineId, stageId }); promptNext(move.stages.find((s) => s._id === stageId)); setMove({ pipelineId: "", stageId: "", stages: move.stages, saving: false }); }
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
      actions={canWrite && deal && <>
        <button type="button" className="btn ghost" onClick={() => setNewCompany(true)}>New company</button>
        <button type="button" className="btn ghost" onClick={remove}>Delete</button>
      </>}
    >
      {actionError && <div className="notice error"><b>Deals</b><span>{actionError}</span></div>}
      {deal && dealStages.length > 0 && (() => {
        const current = dealStages.findIndex((s) => s._id === deal.stageId?._id);
        const next = dealStages.slice(current + 1).find((s) => !s.isClosedLost);
        return (
          <section className="dl-stagebar" aria-label="Pipeline stage">
            <ol>
              {dealStages.map((s, i) => {
                const state = i === current ? "current" : current >= 0 && i < current ? "done" : "todo";
                const tone = s.isClosedWon ? " won" : s.isClosedLost ? " lost" : "";
                return (
                  <li key={s._id} className={`dl-stage ${state}${tone}`}>
                    <button type="button" disabled={!canWrite || Boolean(stepping) || i === current}
                      aria-current={i === current ? "step" : undefined}
                      title={i === current ? "Current stage" : `Move to ${s.name}`}
                      onClick={() => goToStage(s)}>
                      {stepping === s._id ? "Moving…" : s.name}
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="dl-stage-actions">
              {canWrite && next && deal.status === "open" && (
                <button type="button" className="btn primary dl-stage-next" disabled={Boolean(stepping)} onClick={() => goToStage(next)}>
                  Next: {next.name} →
                </button>
              )}
              {canWrite && deal.status === "open" && !closing && <>
                <button type="button" className="btn ghost" onClick={() => setClosing({ status: "won", paid: Boolean(deal.metadata?.paymentReceivedConfirmed), reason: "", busy: false, error: "" })}>Mark won</button>
                <button type="button" className="btn ghost" onClick={() => setClosing({ status: "lost", paid: false, reason: deal.lostReason || "", busy: false, error: "" })}>Mark lost</button>
              </>}
              {canWrite && deal.status !== "open" && <>
                <span className="lk-muted">Deal {deal.status === "won" ? "won" : "lost"}{deal.status === "lost" && deal.lostReason ? `: ${deal.lostReason}` : ""}.{membershipAdded ? " Membership added." : ""}</span>
                {deal.status === "won" && !membershipAdded && MEMBERSHIP_PIPELINES.includes(deal.pipelineId?.key) && contact && (
                  <button type="button" className="btn ghost" onClick={() => setWonMembership(true)}>Add membership</button>
                )}
                <button type="button" className="btn ghost" onClick={reopen}>Reopen</button>
              </>}
            </div>
            {closing && (
              <form className="dl-close-form" onSubmit={submitClose}>
                {closing.status === "won"
                  ? <label className="fm-inline"><input type="checkbox" checked={closing.paid} disabled={closing.busy} onChange={(e) => setClosing({ ...closing, paid: e.target.checked })} /> Payment received (confirmed by finance)</label>
                  : <label>Why was it lost?<input autoFocus value={closing.reason} disabled={closing.busy} maxLength={500} placeholder="e.g. Chose another provider on price" onChange={(e) => setClosing({ ...closing, reason: e.target.value })} /></label>}
                <div className="next-task-actions">
                  <button type="submit" className="btn primary" disabled={closing.busy}>{closing.busy ? "Saving…" : closing.status === "won" ? "Mark won" : "Mark lost"}</button>
                  <button type="button" className="btn ghost" disabled={closing.busy} onClick={() => setClosing(null)}>Cancel</button>
                </div>
                {closing.error && <p className="lk-warn-text">{closing.error}</p>}
              </form>
            )}
          </section>
        );
      })()}
      {askNext && deal && canWrite && (
        <NextTaskPrompt key={askNext.key} onDealPage heading={`Moved to ${askNext.stage.name}. What's next?`}
          task={{ priority: "medium", assignedTo: deal.ownerId?._id || deal.ownerId }}
          links={{ deal, contact, company }} onDone={() => setAskNext(null)} />
      )}
      {wonMembership && contact && (
        <MembershipModal contact={contact} company={company} deal={deal}
          onClose={() => setWonMembership(false)}
          onCreated={() => { setWonMembership(false); setMembershipAdded(true); }} />
      )}
      {deal && <>
        <Card title="People">
          <dl className="dl-fields">
            <div className="dl-field"><dt>Contact</dt><dd>{contact ? <Link to={recordHref.contact(contact._id)}>{personLabel(contact)}</Link> : "—"}{contact?.email && <small className="dl-sub">{contact.email}</small>}</dd></div>
            <div className="dl-field"><dt>Company</dt><dd>{company ? <Link to={recordHref.company(company._id)}>{company.name}</Link> : "—"}</dd></div>
            <div className="dl-field"><dt>Owner</dt><dd>{deal.ownerId?.name || "—"}</dd></div>
            <div className="dl-field"><dt>Source</dt><dd>{sourceLabel(deal.source)}</dd></div>
          </dl>
        </Card>
        <FieldGrid
          canEdit={canWrite}
          onSave={save}
          fields={[
            { key: "title", label: "Title", value: deal.title, required: true, span: true },
            {
              key: "companyId", label: "Company", type: "select", value: company?._id || "",
              options: [["", "No company"], ...companies.map((c) => [c._id, c.name]), ...(company && !companies.some((c) => c._id === company._id) ? [[company._id, company.name]] : [])],
              display: company ? <Link to={recordHref.company(company._id)}>{company.name}</Link> : "—",
            },
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
        {canWrite && <Card title="Move to another pipeline or stage">
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
      {newCompany && <NewCompanyModal onClose={() => setNewCompany(false)} onCreated={async (co) => {
        await patch({ companyId: co._id });
        // A contact without a company gets the new one too, so both records stay in step.
        if (contact && !contact.companyId) await request(`/contacts/${contact._id}`, { method: "PATCH", body: { companyId: co._id } }).catch(() => {});
        setNewCompany(false);
      }} />}
    </DetailLayout>
  );
}
