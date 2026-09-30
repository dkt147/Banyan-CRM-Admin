import React, { useEffect, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
const planBlank = {
  name: "",
  type: "membership",
  description: "",
  price: 0,
  currency: "HKD",
  billingInterval: "monthly",
  features: [],
  isActive: true,
};
const memBlank = {
  contactId: "",
  companyId: "",
  planId: "",
  memberCode: "",
  startAt: "",
  renewalAt: "",
  status: "active",
  monthlyValue: 0,
  currency: "HKD",
  seats: 1,
  riskLevel: "low",
  notes: "",
};
export default function Memberships() {
  const { request } = useAuth();
  const [plans, setPlans] = useState([]),
    [memberships, setMemberships] = useState([]),
    [contacts, setContacts] = useState([]),
    [companies, setCompanies] = useState([]),
    [checkins, setCheckins] = useState([]),
    [tab, setTab] = useState("memberships"),
    [modal, setModal] = useState(null),
    [form, setForm] = useState(planBlank),
    [error, setError] = useState("");
  async function load() {
    try {
      const [p, m, c, co, ci] = await Promise.all([
        request("/membership-plans", { query: { limit: 100 } }),
        request("/memberships", { query: { limit: 100 } }),
        request("/contacts", { query: { limit: 100 } }),
        request("/companies", { query: { limit: 100 } }),
        request("/check-ins", {
          query: { limit: 100, sort: "checkedInAt", order: "desc" },
        }),
      ]);
      setPlans(p.data?.items || []);
      setMemberships(m.data?.items || []);
      setContacts(c.data?.items || []);
      setCompanies(co.data?.items || []);
      setCheckins(ci.data?.items || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function openPlan() {
    setForm(planBlank);
    setModal("plan");
  }
  function openMembership() {
    setForm(memBlank);
    setModal("membership");
  }
  function openCheckin() {
    setForm({
      contactId: "",
      membershipId: "",
      checkedInAt: "",
      source: "manual",
    });
    setModal("checkin");
  }
  async function save() {
    try {
      if (modal === "plan")
        await request("/membership-plans", {
          method: "POST",
          body: {
            ...form,
            price: Number(form.price) || 0,
            features:
              typeof form.features === "string"
                ? form.features
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                : form.features,
          },
        });
      if (modal === "membership")
        await request("/memberships", {
          method: "POST",
          body: {
            ...form,
            companyId: form.companyId || undefined,
            planId: form.planId || undefined,
            monthlyValue: Number(form.monthlyValue) || 0,
            seats: Number(form.seats) || 1,
            startAt: form.startAt
              ? new Date(form.startAt).toISOString()
              : undefined,
            renewalAt: form.renewalAt
              ? new Date(form.renewalAt).toISOString()
              : undefined,
          },
        });
      if (modal === "checkin")
        await request("/check-ins", {
          method: "POST",
          body: {
            contactId: form.contactId,
            membershipId: form.membershipId || undefined,
            checkedInAt: form.checkedInAt
              ? new Date(form.checkedInAt).toISOString()
              : undefined,
            source: form.source,
          },
        });
      setModal(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Page
      title="Memberships"
      kicker="Plans, active memberships and check-ins"
      actions={
        tab === "plans" ? (
          <button className="btn primary" onClick={openPlan}>
            New plan
          </button>
        ) : tab === "memberships" ? (
          <button className="btn primary" onClick={openMembership}>
            New membership
          </button>
        ) : (
          <button className="btn primary" onClick={openCheckin}>
            Check in
          </button>
        )
      }
    >
      {error && <div className="notice error">{error}</div>}
      <div className="seg tabs">
        <button
          className={tab === "memberships" ? "on" : ""}
          onClick={() => setTab("memberships")}
        >
          Memberships
        </button>
        <button
          className={tab === "plans" ? "on" : ""}
          onClick={() => setTab("plans")}
        >
          Plans
        </button>
        <button
          className={tab === "checkins" ? "on" : ""}
          onClick={() => setTab("checkins")}
        >
          Check-ins
        </button>
      </div>
      {tab === "plans" && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Type</th>
                <th>Price</th>
                <th>Interval</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p._id}>
                  <td>
                    <b>{p.name}</b>
                    <span>{p.description || ""}</span>
                  </td>
                  <td>{p.type || "—"}</td>
                  <td>HK${Number(p.price || 0).toLocaleString()}</td>
                  <td>{p.billingInterval}</td>
                  <td>
                    <Badge>{p.isActive ? "active" : "inactive"}</Badge>{" "}
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        try {
                          await request(`/membership-plans/${p._id}`, {
                            method: "PATCH",
                            body: { isActive: !p.isActive },
                          });
                          load();
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Toggle
                    </button>{" "}
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        if (!confirm("Delete plan?")) return;
                        try {
                          await request(`/membership-plans/${p._id}`, {
                            method: "DELETE",
                          });
                          load();
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {plans.length === 0 && <Empty text="No membership plans." />}
        </section>
      )}
      {tab === "memberships" && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Renewal</th>
                <th>Risk</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m._id}>
                  <td>
                    <b>
                      {m.contactId?.firstName} {m.contactId?.lastName}
                    </b>
                    <span>{m.memberCode || ""}</span>
                  </td>
                  <td>{m.planId?.name || "—"}</td>
                  <td>
                    <Badge>{m.status}</Badge>
                  </td>
                  <td>
                    {m.renewalAt
                      ? new Date(m.renewalAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>{m.riskLevel}</td>
                  <td>
                    HK${Number(m.monthlyValue || 0).toLocaleString()}{" "}
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        try {
                          await request(`/memberships/${m._id}`, {
                            method: "PATCH",
                            body: {
                              status:
                                m.status === "active" ? "paused" : "active",
                            },
                          });
                          load();
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Toggle
                    </button>{" "}
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        if (!confirm("Delete membership?")) return;
                        try {
                          await request(`/memberships/${m._id}`, {
                            method: "DELETE",
                          });
                          load();
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {memberships.length === 0 && <Empty text="No memberships." />}
        </section>
      )}
      {tab === "checkins" && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Membership</th>
                <th>Checked in</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {checkins.map((c) => (
                <tr key={c._id}>
                  <td>
                    {c.contactId?.firstName} {c.contactId?.lastName}
                  </td>
                  <td>
                    {c.membershipId?.memberCode ||
                      c.membershipId?._id?.slice(-6) ||
                      "—"}
                  </td>
                  <td>
                    {c.checkedInAt
                      ? new Date(c.checkedInAt).toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    {c.source}{" "}
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        if (!confirm("Delete check-in?")) return;
                        try {
                          await request(`/check-ins/${c._id}`, {
                            method: "DELETE",
                          });
                          load();
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {checkins.length === 0 && <Empty text="No check-ins." />}
        </section>
      )}
      {modal === "plan" && (
        <Modal
          title="New membership plan"
          onClose={() => setModal(null)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={save}>
                Create
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Type
              <input
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              />
            </label>
            <label>
              Price
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label>
              Interval
              <select
                value={form.billingInterval}
                onChange={(e) =>
                  setForm({ ...form, billingInterval: e.target.value })
                }
              >
                {["monthly", "quarterly", "yearly", "one_off"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label>
            Features (comma separated)
            <input
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
            />
          </label>
        </Modal>
      )}
      {modal === "membership" && (
        <Modal
          title="New membership"
          onClose={() => setModal(null)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={save}>
                Create
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Contact
              <select
                value={form.contactId}
                onChange={(e) =>
                  setForm({ ...form, contactId: e.target.value })
                }
              >
                <option value="">Select</option>
                {contacts.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.firstName} {x.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Company
              <select
                value={form.companyId}
                onChange={(e) =>
                  setForm({ ...form, companyId: e.target.value })
                }
              >
                <option value="">None</option>
                {companies.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Plan
              <select
                value={form.planId}
                onChange={(e) => setForm({ ...form, planId: e.target.value })}
              >
                <option value="">None</option>
                {plans.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Member code
              <input
                value={form.memberCode}
                onChange={(e) =>
                  setForm({ ...form, memberCode: e.target.value })
                }
              />
            </label>
            <label>
              Monthly value
              <input
                type="number"
                value={form.monthlyValue}
                onChange={(e) =>
                  setForm({ ...form, monthlyValue: e.target.value })
                }
              />
            </label>
            <label>
              Seats
              <input
                type="number"
                value={form.seats}
                onChange={(e) => setForm({ ...form, seats: e.target.value })}
              />
            </label>
            <label>
              Start
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </label>
            <label>
              Renewal
              <input
                type="datetime-local"
                value={form.renewalAt}
                onChange={(e) =>
                  setForm({ ...form, renewalAt: e.target.value })
                }
              />
            </label>
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
      {modal === "checkin" && (
        <Modal
          title="Check in member"
          onClose={() => setModal(null)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={save}>
                Check in
              </button>
            </>
          }
        >
          <label>
            Contact
            <select
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
            >
              <option value="">Select</option>
              {contacts.map((x) => (
                <option key={x._id} value={x._id}>
                  {x.firstName} {x.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Membership
            <select
              value={form.membershipId}
              onChange={(e) =>
                setForm({ ...form, membershipId: e.target.value })
              }
            >
              <option value="">None</option>
              {memberships
                .filter(
                  (x) =>
                    !form.contactId ||
                    String(x.contactId?._id || x.contactId) ===
                      String(form.contactId),
                )
                .map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.memberCode || x._id.slice(-6)}
                  </option>
                ))}
            </select>
          </label>
        </Modal>
      )}
    </Page>
  );
}
