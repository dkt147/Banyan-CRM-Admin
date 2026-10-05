import React, { useEffect, useMemo, useState } from "react";

import { Page, SectionTitle, Empty } from "./Dashboard";

import Badge from "../components/Badge";

import Metric from "../components/Metric";

import Modal from "../components/Modal";

import { useAuth } from "../auth/AuthContext";

export default function Loyalty() {

  const { request } = useAuth();

  const [accounts, setAccounts] = useState([]),
    [tiers, setTiers] = useState([]),
    [redemptions, setRedemptions] = useState([]),
    [ledger, setLedger] = useState([]),
    [contacts, setContacts] = useState([]),
    [modal, setModal] = useState(null),
    [form, setForm] = useState({
      contactId: "",
      points: 100,
      reason: "",
      rewardDescription: "",
      dealId: "",
    }),
    [error, setError] = useState("");

  function getItems(response) {
    const candidates = [
      response?.data?.items,
      response?.items,
      response?.data?.data?.items,
      response?.data?.contacts,
      response?.data?.results,
      response?.results,
      Array.isArray(response?.data) ? response.data : null,
      Array.isArray(response) ? response : null,
    ];

    return candidates.find(Array.isArray) || [];
  }

  function getContactName(contact) {
    const firstName = contact?.firstName || contact?.first_name || "";
    const lastName = contact?.lastName || contact?.last_name || "";
    const fullName =
      contact?.name ||
      contact?.fullName ||
      contact?.displayName ||
      `${firstName} ${lastName}`.trim();

    return fullName || contact?.email || "Unnamed contact";
  }

  async function load() {
    try {
      setError("");

      const [a, t, r, l, c] = await Promise.all([
        request("/loyalty/accounts", { query: { limit: 100 } }),
        request("/loyalty-tiers", {
          query: { limit: 100, sort: "sortOrder", order: "asc" },
        }),
        request("/loyalty-redemptions", {
          query: { limit: 100, sort: "requestedAt", order: "desc" },
        }),
        request("/loyalty-ledger", {
          query: { limit: 100, sort: "createdAt", order: "desc" },
        }),
        request("/contacts", { query: { page: 1, limit: 100 } }),
      ]);

      setAccounts(getItems(a));
      setTiers(getItems(t));
      setRedemptions(getItems(r));
      setLedger(getItems(l));
      setContacts(getItems(c));
    } catch (e) {
      setError(e.message || "Failed to load loyalty data.");
      setContacts([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const points = accounts.reduce(
    (a, x) => a + (Number(x.pointsBalance) || 0),
    0
  );

  const redeemed = accounts.reduce(
    (a, x) => a + (Number(x.lifetimeRedeemed) || 0),
    0
  );

  const pending = redemptions.filter(
    (x) => x.status === "requested"
  ).length;

  function resetForm() {
    setForm({
      contactId: "",
      points: 100,
      reason: "",
      rewardDescription: "",
      dealId: "",
    });
  }

  async function redeem() {
    try {
      setError("");

      await request("/loyalty/redemptions", {
        method: "POST",
        body: {
          contactId: form.contactId,
          points: Number(form.points),
          rewardDescription: form.rewardDescription || "Reward request",
          dealId: form.dealId || undefined,
        },
      });

      setModal(null);
      resetForm();
      load();
    } catch (e) {
      setError(e.message || "Failed to request redemption.");
    }
  }

  async function adjust() {
    try {
      setError("");

      await request("/loyalty/adjust", {
        method: "POST",
        body: {
          contactId: form.contactId,
          points: Number(form.points),
          reason: form.reason,
        },
      });

      setModal(null);
      resetForm();
      load();
    } catch (e) {
      setError(e.message || "Failed to adjust points.");
    }
  }

  async function decide(id, approve) {
    try {
      setError("");

      await request(`/loyalty/redemptions/${id}/decision`, {
        method: "PATCH",
        body: { approve, reason: form.reason || "Operator decision" },
      });

      load();
    } catch (e) {
      setError(e.message || "Failed to update redemption.");
    }
  }

  return (
    <Page
      title="Loyalty rewards"
      kicker="1 point per HK$100 paid"
      actions={
        <>
          <button
            className="btn ghost"
            onClick={() => {
              resetForm();
              setModal("Request redemption");
            }}
          >
            Request redemption
          </button>

          <button
            className="btn primary"
            onClick={() => {
              resetForm();
              setModal("Adjust points");
            }}
          >
            Adjust points
          </button>
        </>
      }
    >
      {error && (
        <div className="notice error">
          <b>Loyalty</b>
          <span>{error}</span>
        </div>
      )}

      <div className="metrics five">
        <Metric
          label="Enrolled clients"
          value={accounts.length}
          sub="CRM loyalty accounts"
        />

        <Metric
          label="Points outstanding"
          value={points.toLocaleString()}
          sub="Current balances"
        />

        <Metric
          label="Redeemed"
          value={redeemed.toLocaleString()}
          sub="Lifetime redeemed"
        />

        <Metric label="Tiers" value={tiers.length} sub="Configured tiers" />

        <Metric
          label="Awaiting action"
          value={pending}
          sub="Pending redemptions"
          accent
        />
      </div>

      <section>
        <SectionTitle title="The tiers" note="Configured from MongoDB" />

        <div className="tier-grid">
          {tiers.map((t) => (
            <div className="tier-card" key={t._id}>
              <div>
                <b>◈ {t.name}</b>
                <span>{Number(t.minSpend || 0).toLocaleString()}+ HKD</span>
              </div>

              <small>
                {t.maxSpend
                  ? `Up to ${Number(t.maxSpend).toLocaleString()}`
                  : "No upper limit"}
              </small>

              {(t.benefits || []).map((b) => (
                <span key={b}>{b}</span>
              ))}

              <div className="actions">
                <button
                  className="btn ghost"
                  onClick={async () => {
                    try {
                      await request(`/loyalty-tiers/${t._id}`, {
                        method: "PATCH",
                        body: {
                          discountPercent: t.discountPercent,
                          isActive: !t.isActive,
                        },
                      });
                      load();
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Toggle
                </button>

                <button
                  className="btn ghost"
                  onClick={async () => {
                    if (!confirm("Delete tier?")) return;

                    try {
                      await request(`/loyalty-tiers/${t._id}`, {
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
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="Loyalty accounts" />

        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Tier</th>
                <th>Points</th>
                <th>Lifetime spend</th>
              </tr>
            </thead>

            <tbody>
              {accounts.map((a) => (
                <tr key={a._id}>
                  <td>
                    <b>
                      {a.contactId?.firstName} {a.contactId?.lastName}
                    </b>
                    <span>{a.contactId?.email || ""}</span>
                  </td>

                  <td>{a.tierId?.name || "—"}</td>
                  <td>{a.pointsBalance}</td>
                  <td>
                    HK$
                    {Number(a.lifetimeSpend || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {accounts.length === 0 && (
            <Empty text="No loyalty accounts yet. They are created when points are earned or adjusted." />
          )}
        </div>
      </section>

      <section>
        <SectionTitle title="Redemptions needing a decision" />

        {redemptions
          .filter((x) => x.status === "requested")
          .map((r) => (
            <div className="decision panel" key={r._id}>
              <div>
                <b>
                  {r.contactId?.firstName} {r.contactId?.lastName}
                </b>
                <Badge tone="warn">{r.points} points</Badge>
              </div>

              <p>{r.rewardDescription || "Reward request"}</p>

              <button
                className="btn primary"
                onClick={() => decide(r._id, true)}
              >
                Approve
              </button>

              <button
                className="btn ghost"
                onClick={() => decide(r._id, false)}
              >
                Decline
              </button>
            </div>
          ))}

        {pending === 0 && <Empty text="No pending redemptions." />}
      </section>

      <section>
        <SectionTitle title="Points ledger" />

        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Contact</th>
                <th>Points</th>
                <th>Balance after</th>
                <th>Reason</th>
              </tr>
            </thead>

            <tbody>
              {ledger.map((x) => (
                <tr key={x._id}>
                  <td>{x.type}</td>
                  <td>
                    {x.contactId?.firstName} {x.contactId?.lastName}
                  </td>
                  <td>{x.points}</td>
                  <td>{x.balanceAfter}</td>
                  <td>{x.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {ledger.length === 0 && <Empty text="No ledger entries." />}
        </div>
      </section>

      {modal && (
        <Modal
          title={modal}
          onClose={() => {
            setModal(null);
            resetForm();
          }}
          actions={
            <>
              <button
                className="btn ghost"
                onClick={() => {
                  setModal(null);
                  resetForm();
                }}
              >
                Cancel
              </button>

              <button
                className="btn primary"
                onClick={modal === "Request redemption" ? redeem : adjust}
              >
                Confirm
              </button>
            </>
          }
        >
          <label>
            Contact

            <select
              value={form.contactId}
              onChange={(e) =>
                setForm({ ...form, contactId: e.target.value })
              }
            >
              <option value="">
                {contacts.length === 0
                  ? "No contacts found"
                  : "Select contact"}
              </option>

              {contacts.map((c) => {
                const id = c._id || c.id;

                if (!id) return null;

                return (
                  <option key={id} value={id}>
                    {getContactName(c)}
                  </option>
                );
              })}
            </select>
          </label>

          <div className="form-grid">
            <label>
              Points

              <input
                type="number"
                value={form.points}
                onChange={(e) =>
                  setForm({ ...form, points: e.target.value })
                }
              />
            </label>

            <label>
              {modal === "Request redemption" ? "Reward" : "Reason"}

              <input
                value={
                  modal === "Request redemption"
                    ? form.rewardDescription
                    : form.reason
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    [modal === "Request redemption"
                      ? "rewardDescription"
                      : "reason"]: e.target.value,
                  })
                }
              />
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}
