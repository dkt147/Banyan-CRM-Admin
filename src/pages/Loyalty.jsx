import React from "react";
import { useState } from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { loyaltyClients } from "../data/mock";
import Metric from "../components/Metric";
const tiers = [
  [
    "Bronze",
    "19 clients",
    "Under HK$100,000 lifetime",
    ["5% off venue hire", "Priority on provisional holds"],
    "bronze",
  ],
  [
    "Silver",
    "11 clients",
    "HK$100,000 – 250,000",
    ["10% off venue hire", "Two free meeting room hours a quarter"],
    "silver",
  ],
  [
    "Gold",
    "6 clients",
    "HK$250,000 – 500,000",
    [
      "15% off venue hire",
      "Free AV and coordinator",
      "One complimentary studio half-day a year",
    ],
    "gold",
  ],
  [
    "Platinum",
    "2 clients",
    "Above HK$500,000 lifetime",
    [
      "20% off venue hire",
      "First refusal on peak dates",
      "Named account contact",
    ],
    "platinum",
  ],
];
export default function Loyalty() {
  const [modal, setModal] = useState(null);
  return (
    <Page
      title="Loyalty rewards"
      kicker="Event & venue clients · 1 point per HK$100 spent"
      actions={
        <>
          <span className="muted">
            Points accrue when an invoice is paid, never when it is raised
          </span>
          <button
            className="btn primary"
            onClick={() => setModal("Adjust points")}
          >
            Adjust points
          </button>
        </>
      }
    >
      <div className="metrics five">
        <Metric
          label="Enrolled clients"
          value="38"
          sub="Automatic on first event"
        />
        <Metric
          label="Points outstanding"
          value="14,820"
          sub="≈ HK$44,500 in rewards"
        />
        <Metric
          label="Redeemed this quarter"
          value="3,150"
          sub="7 redemptions"
        />
        <Metric
          label="Repeat event rate"
          value="46%"
          sub="▲ 9 pts since launch"
        />
        <Metric
          label="Awaiting action"
          value="2"
          sub="1 upgrade · 1 redemption"
          accent
        />
      </div>
      <section>
        <SectionTitle
          title="The four tiers"
          note="Tier is set by cumulative paid spend, recalculated on every payment"
        />
        <div className="tier-grid">
          {tiers.map((t) => (
            <div className={`tier-card ${t[4]}`} key={t[0]}>
              <div>
                <b>◈ {t[0]}</b>
                <span>{t[1]}</span>
              </div>
              <small>{t[2]}</small>
              {t[3].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle title="Needs a decision" />
        <div className="decision-grid">
          <Decision
            title="Lumen Studio → Gold"
            tag="Upgrade earned"
            body="Crossed HK$250,000 lifetime when the June balance cleared"
            action="Send upgrade notice"
            onClick={() => setModal("Send upgrade notice")}
          />
          <Decision
            title="Aurora Beauty · 1,200 points"
            tag="Redemption requested"
            body="Wants the studio half-day against their November shoot"
            action="Approve & apply to deal"
            onClick={() => setModal("Approve redemption")}
          />
        </div>
      </section>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Tier</th>
              <th>Lifetime spend</th>
              <th>Points</th>
              <th>To next tier</th>
              <th>Last event</th>
            </tr>
          </thead>
          <tbody>
            {loyaltyClients.map((r) => (
              <tr
                key={r[0]}
                className={r[0] === "Lumen Studio" ? "highlight" : ""}
              >
                <td>
                  <b>{r[0]}</b>
                  <span>{r[1]}</span>
                </td>
                <td>
                  <Badge tone={r[2].includes("Platinum") ? "platinum" : ""}>
                    {r[2]}
                  </Badge>
                </td>
                <td>{r[3]}</td>
                <td>{r[4]}</td>
                <td>{r[5]}</td>
                <td>{r[6]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="loyalty-bottom">
        <section className="panel">
          <SectionTitle
            title="Points ledger — Lumen Studio"
            note="Balance 2,640"
          />
          {[
            [
              "Product launch · event space",
              "14 Jun · invoice paid HK$32,500",
              "+325",
            ],
            [
              "Meeting room hours redeemed",
              "2 Jun · Silver quarterly benefit",
              "−400",
            ],
            [
              "Spring campaign shoot · studio",
              "18 Apr · invoice paid HK$11,500",
              "+115",
            ],
            [
              "Team offsite · venue hire",
              "3 Mar · invoice paid HK$28,000",
              "+280",
            ],
            ["Enrolled · first event", "11 Nov 2025 · Bronze", "—"],
          ].map((x) => (
            <div className="ledger" key={x[0]}>
              <div>
                <b>{x[0]}</b>
                <span>{x[1]}</span>
              </div>
              <strong className={x[2].startsWith("−") ? "negative" : ""}>
                {x[2]}
              </strong>
            </div>
          ))}
        </section>
        <div className="stack">
          <section className="notice green">
            <b>What runs on its own</b>
            <span>
              Invoice marked paid in Xero → points added at 1 per HK$100.
            </span>
            <span>
              Threshold crossed → upgrade flagged for approval, then notice
              sends.
            </span>
            <span>
              Redemption approved → discount applied as a deal line item.
            </span>
            <span>
              No event for 12 months → win-back flag; tier held for a further
              year.
            </span>
          </section>
          <section className="panel">
            <SectionTitle title="Where the tier shows up" />
            <p>A tier badge on the contact and company record.</p>
            <p>On venue and studio deal cards before quoting.</p>
            <p>
              In venue hire and photoshoot quote templates as a discount line.
            </p>
          </section>
          <section className="panel">
            <SectionTitle title="Tier distribution" />
            {[
              ["Bronze", 19],
              ["Silver", 11],
              ["Gold", 6],
              ["Platinum", 2],
            ].map((x) => (
              <div className="dist" key={x[0]}>
                <div>
                  <span>{x[0]}</span>
                  <b>{x[1]}</b>
                </div>
                <div className="dist-track">
                  <i style={{ width: `${(x[1] / 38) * 100}%` }} />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
      {modal && (
        <Modal
          title={modal}
          onClose={() => setModal(null)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={() => setModal(null)}>
                Confirm
              </button>
            </>
          }
        >
          <p>
            This action is intentionally operator-approved in the prototype. The
            production backend should create an auditable loyalty ledger entry
            and link it to the deal.
          </p>
          <label>
            Reason
            <textarea placeholder="Add a reason…" />
          </label>
        </Modal>
      )}
    </Page>
  );
}
function Decision({ title, tag, body, action, onClick }) {
  return (
    <div className="decision">
      <div>
        <b>{title}</b>
        <Badge tone="warn">{tag}</Badge>
      </div>
      <p>{body}</p>
      <button className="btn primary" onClick={onClick}>
        {action}
      </button>
      <button className="btn ghost">Hold / Decline</button>
    </div>
  );
}
