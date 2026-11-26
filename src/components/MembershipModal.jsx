import React, { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { useAuth } from "../auth/AuthContext";

// Add a membership from a contact, company or won deal (27 Nov: production had no
// memberships, so the contact page's membership card said "Not a member" for everyone).
// Uses the existing routes, no server change:
//   GET  /membership-plans?isActive=true    POST /membership-plans { name, type, price, billingInterval }
//   POST /memberships { contactId, companyId, planId, status, startAt, renewalAt, monthlyValue, currency, seats, memberCode, notes, metadata }
// Optionally tags the contact "active_member" (PATCH /contacts/:id { tags }).

const todayHk = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
const addMonths = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
};
const hkMidnight = (ymd) => (ymd ? new Date(`${ymd}T00:00:00+08:00`).toISOString() : undefined);
const PLAN_TYPES = [["membership", "Coworking membership"], ["private_office", "Private office"], ["virtual_office", "Virtual office"], ["other", "Other"]];
const TYPE_BY_PIPELINE = { membership: "membership", "private-office": "private_office", "virtual-office": "virtual_office" };
const personName = (c) => [c?.firstName, c?.lastName].filter(Boolean).join(" ") || c?.email || "Contact";

/**
 * contact    { _id, firstName, lastName, companyId? } (fixed), or null to pick one of the company's people
 * company    { _id, name } optional
 * deal       { _id, title, value, pipelineId: { key } } optional (from "Mark won")
 */
export default function MembershipModal({ contact, company, deal, onClose, onCreated }) {
  const { request } = useAuth();
  const [plans, setPlans] = useState(null);
  const [people, setPeople] = useState(contact ? [contact] : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const planType = TYPE_BY_PIPELINE[deal?.pipelineId?.key] || "membership";
  const start = todayHk();
  const [form, setForm] = useState({
    contactId: contact?._id || "", planId: "", status: "active", startAt: start, renewalAt: addMonths(start, 1),
    monthlyValue: deal?.value ? String(deal.value) : "", seats: "1", memberCode: "", notes: deal ? `From deal: ${deal.title}` : "",
    tagMember: true, newPlan: { name: "", type: planType, price: "" },
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    let alive = true;
    request("/membership-plans", { query: { isActive: true, limit: 100, sort: "name", order: "asc" } })
      .then((r) => {
        if (!alive) return;
        const items = r.data?.items || (Array.isArray(r.data) ? r.data : []);
        setPlans(items);
        const match = items.find((p) => p.type === planType) || items[0];
        if (match) setForm((f) => ({ ...f, planId: match._id, monthlyValue: f.monthlyValue || (match.price ? String(match.price) : "") }));
        else setForm((f) => ({ ...f, planId: "new" }));
      })
      .catch((e) => alive && (setPlans([]), setError(e.message || "Could not load the plans.")));
    if (!contact && company?._id) {
      request("/contacts", { query: { companyId: company._id, limit: 100, page: 1 } })
        .then((r) => alive && setPeople(r.data?.items || []))
        .catch(() => alive && setPeople([]));
    }
    return () => { alive = false; };
  }, [request]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = useMemo(() => (plans || []).find((p) => p._id === form.planId) || null, [plans, form.planId]);
  function pickPlan(id) {
    const p = (plans || []).find((x) => x._id === id);
    set({ planId: id, monthlyValue: deal?.value ? form.monthlyValue : p?.price ? String(p.price) : form.monthlyValue });
  }

  async function save() {
    setError("");
    if (!form.contactId) { setError("Choose the member (a contact)."); return; }
    if (!form.planId) { setError("Choose a plan."); return; }
    if (form.planId === "new" && !form.newPlan.name.trim()) { setError("Give the new plan a name, e.g. Hot desk."); return; }
    if (!form.startAt) { setError("Choose the start date."); return; }
    if (form.renewalAt && form.renewalAt < form.startAt) { setError("The renewal date must be after the start date."); return; }
    const monthly = form.monthlyValue === "" ? 0 : Number(form.monthlyValue);
    if (Number.isNaN(monthly) || monthly < 0) { setError("The monthly price must be a number."); return; }
    const seats = Number(form.seats) || 1;
    if (seats < 1 || seats > 500) { setError("Seats must be between 1 and 500."); return; }
    setBusy(true);
    try {
      let planId = form.planId;
      if (planId === "new") {
        const price = Number(form.newPlan.price) || monthly || 0;
        const created = await request("/membership-plans", {
          method: "POST",
          body: { name: form.newPlan.name.trim(), type: form.newPlan.type, price, currency: "HKD", billingInterval: "monthly", isActive: true, features: [] },
        });
        planId = created.data?._id;
      }
      const person = (people || []).find((p) => p._id === form.contactId) || contact;
      const companyId = company?._id || (person?.companyId && typeof person.companyId === "object" ? person.companyId._id : person?.companyId) || undefined;
      const res = await request("/memberships", {
        method: "POST",
        body: {
          contactId: form.contactId, companyId, planId, status: form.status,
          startAt: hkMidnight(form.startAt), renewalAt: hkMidnight(form.renewalAt),
          monthlyValue: monthly, currency: "HKD", seats,
          memberCode: form.memberCode.trim() || undefined, notes: form.notes.trim() || undefined,
          metadata: { createdFrom: deal ? "deal_won" : company && !contact ? "company" : "contact", ...(deal ? { dealId: deal._id } : {}) },
        },
      });
      if (form.tagMember) {
        try {
          const c = (await request(`/contacts/${form.contactId}`)).data;
          const tags = Array.isArray(c?.tags) ? c.tags : [];
          if (!tags.includes("active_member")) await request(`/contacts/${form.contactId}`, { method: "PATCH", body: { tags: [...tags.filter((t) => t !== "prospect" && t !== "past_member"), "active_member"] } });
        } catch { /* the membership is saved; the tag is a nice-to-have */ }
      }
      onCreated?.(res.data);
    } catch (e) {
      setError(e.payload?.code === "DUPLICATE_KEY" || e.status === 409 ? "A plan with that name already exists. Choose it from the list." : e.message || "The membership could not be saved.");
      setBusy(false);
    }
  }

  return (
    <Modal title={deal ? "Deal won: add the membership" : "Add membership"} onClose={onClose}
      actions={<>
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>{deal ? "Not now" : "Cancel"}</button>
        <button type="button" className="btn primary" onClick={save} disabled={busy || plans === null}>{busy ? "Saving…" : "Add membership"}</button>
      </>}>
      <div className="form-grid ms-form">
        {deal && <p className="lk-muted ms-span">So the contact page shows them as a member. You can also do this later from the contact page.</p>}
        {contact ? (
          <label>Member<input value={personName(contact)} disabled /></label>
        ) : (
          <label>Member
            <select value={form.contactId} onChange={(e) => set({ contactId: e.target.value })} disabled={people === null}>
              <option value="">{people === null ? "Loading…" : people.length ? "Choose…" : "No contacts at this company"}</option>
              {(people || []).map((p) => <option key={p._id} value={p._id}>{personName(p)}</option>)}
            </select>
          </label>
        )}
        <label>Plan
          <select value={form.planId} onChange={(e) => pickPlan(e.target.value)} disabled={plans === null}>
            {plans === null && <option value="">Loading…</option>}
            {(plans || []).map((p) => <option key={p._id} value={p._id}>{p.name}{p.price ? ` · HK$${Number(p.price).toLocaleString("en-HK")}/month` : ""}</option>)}
            <option value="new">+ New plan…</option>
          </select>
        </label>
        {form.planId === "new" && (
          <>
            <label>New plan name<input value={form.newPlan.name} maxLength={80} placeholder="e.g. Hot desk" onChange={(e) => set({ newPlan: { ...form.newPlan, name: e.target.value } })} /></label>
            <label>Plan type
              <select value={form.newPlan.type} onChange={(e) => set({ newPlan: { ...form.newPlan, type: e.target.value } })}>
                {PLAN_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>Plan list price (HK$ / month)<input type="number" min="0" value={form.newPlan.price} onChange={(e) => set({ newPlan: { ...form.newPlan, price: e.target.value } })} /></label>
          </>
        )}
        <label>Status
          <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
          </select>
        </label>
        <label>Start date<input type="date" value={form.startAt} onChange={(e) => set({ startAt: e.target.value, renewalAt: e.target.value ? addMonths(e.target.value, 1) : form.renewalAt })} /></label>
        <label>Next renewal<input type="date" value={form.renewalAt} min={form.startAt} onChange={(e) => set({ renewalAt: e.target.value })} /></label>
        <label>Monthly price for this member (HK$)<input type="number" min="0" value={form.monthlyValue} placeholder={plan?.price ? String(plan.price) : "0"} onChange={(e) => set({ monthlyValue: e.target.value })} /></label>
        <label>Seats<input type="number" min="1" max="500" value={form.seats} onChange={(e) => set({ seats: e.target.value })} /></label>
        <label>Member code (optional)<input value={form.memberCode} maxLength={40} onChange={(e) => set({ memberCode: e.target.value })} /></label>
        <label className="ms-span">Notes<textarea rows={2} maxLength={1000} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
        <label className="fm-inline ms-span"><input type="checkbox" checked={form.tagMember} onChange={(e) => set({ tagMember: e.target.checked })} /> Tag the contact "Active member"</label>
        {error && <div className="notice error ms-span"><b>Membership</b><span>{error}</span></div>}
      </div>
    </Modal>
  );
}
