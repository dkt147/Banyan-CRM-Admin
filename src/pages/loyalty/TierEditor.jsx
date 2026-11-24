import React, { useState } from "react";
import Modal from "../../components/Modal";
import { useAuth } from "../../auth/AuthContext";

// Add or edit one loyalty tier (POST/PATCH /loyalty-tiers). A company's tier is the active
// tier with the highest "from" spend at or below its paid spend over the last 12 months.
export default function TierEditor({ tier, tiers, onClose, onSaved }) {
  const { request } = useAuth();
  const [v, setV] = useState({
    name: tier?.name || "",
    minSpend: tier ? String(tier.minSpend ?? 0) : "",
    benefits: (tier?.benefits || []).join("\n"),
    isActive: tier ? tier.isActive !== false : true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    const name = v.name.trim();
    const minSpend = Number(v.minSpend);
    if (!name) { setError("Give the tier a name."); return; }
    if (v.minSpend === "" || !Number.isFinite(minSpend) || minSpend < 0) { setError("Enter the spend (HK$) the tier starts from, 0 or more."); return; }
    const others = (tiers || []).filter((t) => t._id !== tier?._id);
    if (others.some((t) => t.name.trim().toLowerCase() === name.toLowerCase())) { setError(`There is already a tier called “${name}”.`); return; }
    if (v.isActive && others.some((t) => t.isActive !== false && Number(t.minSpend || 0) === minSpend)) { setError(`Another active tier already starts at HK$${minSpend.toLocaleString("en-HK")}.`); return; }
    const benefits = v.benefits.split("\n").map((b) => b.trim()).filter(Boolean);
    // Tiers are listed by sortOrder; keep it in step with the spend.
    const sortOrder = [...others.map((t) => Number(t.minSpend || 0)), minSpend].sort((a, b) => a - b).indexOf(minSpend) + 1;
    setBusy(true); setError("");
    try {
      const body = { name, minSpend, benefits, isActive: v.isActive, sortOrder };
      if (tier) await request(`/loyalty-tiers/${tier._id}`, { method: "PATCH", body });
      else await request("/loyalty-tiers", { method: "POST", body });
      onSaved();
    } catch (err) { setError(err.message || "Could not save the tier."); setBusy(false); }
  }

  return (
    <Modal title={tier ? `Edit tier: ${tier.name}` : "Add a tier"} onClose={onClose}
      actions={<>
        <button type="submit" form="tier-editor" className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save tier"}</button>
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
      </>}>
      <form id="tier-editor" className="form-grid" onSubmit={save}>
        <label>Name<input autoFocus value={v.name} maxLength={60} disabled={busy} placeholder="e.g. Gold" onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <label>From spend (HK$, last 12 months)<input type="number" min={0} step={100} value={v.minSpend} disabled={busy} placeholder="e.g. 30000" onChange={(e) => setV({ ...v, minSpend: e.target.value })} /></label>
        <label className="form-span-2">Perks (one per line)<textarea rows={4} value={v.benefits} disabled={busy} placeholder={"Priority booking\n2 free meeting room hours a month"} onChange={(e) => setV({ ...v, benefits: e.target.value })} /></label>
        <label className="fm-inline form-span-2"><input type="checkbox" checked={v.isActive} disabled={busy} onChange={(e) => setV({ ...v, isActive: e.target.checked })} /> Active (inactive tiers are never given to a company)</label>
        <p className="lk-muted form-span-2">A company gets the highest active tier its paid spend over the last 12 months has reached. Test payments never count.</p>
        {error && <p className="lk-warn-text form-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
