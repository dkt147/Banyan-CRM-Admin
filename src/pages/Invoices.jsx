import React from "react";
import { Page, SectionTitle } from "./Dashboard";
import Metric from "../components/Metric";
import Badge from "../components/Badge";
const rows = [
  [
    "Harbour Pictures",
    "Shoot deposit · 50%",
    "HK$5,750",
    "16 Sep",
    "Draft",
    "Auto · on signature",
  ],
  [
    "Aurora Beauty",
    "Event space · final balance",
    "HK$14,000",
    "28 Aug",
    "Overdue 12d",
    "Xero",
  ],
  [
    "Sonder Media",
    "Podcast studio · 4 hours",
    "HK$26,000",
    "20 Sep",
    "Awaiting",
    "Xero",
  ],
  [
    "Novo Health Ltd",
    "Membership · September",
    "HK$7,400",
    "1 Sep",
    "Paid",
    "Recurring",
  ],
  [
    "Saltwater Design Co.",
    "Private office · September",
    "HK$18,500",
    "1 Sep",
    "Paid",
    "Recurring",
  ],
];
export default function Invoices() {
  return (
    <Page
      title="Invoices"
      kicker="Two-way sync with Xero · payments via Stripe"
      actions={<button className="btn primary">Create invoice in Xero</button>}
    >
      <div className="sync-line">
        <span>Last synced 4 minutes ago</span>
        <Badge>Healthy</Badge>
      </div>
      <div className="metrics four">
        <Metric label="Awaiting payment" value="HK$148,300" sub="7 invoices" />
        <Metric label="Overdue" value="HK$21,800" sub="2 invoices" accent />
        <Metric
          label="Paid this month"
          value="HK$509,000"
          sub="▲ 8% vs August"
        />
        <Metric
          label="Recurring active"
          value="47"
          sub="Memberships billing monthly"
        />
      </div>
      <section className="panel table-wrap">
        <div className="table-tabs">
          {["All", "Drafts 3", "Awaiting 7", "Overdue 2", "Paid"].map((x) => (
            <button key={x} className={x === "All" ? "on" : ""}>
              {x}
            </button>
          ))}
        </div>
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>What for</th>
              <th>Amount</th>
              <th>Due</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0] + r[1]}>
                <td>
                  <b>{r[0]}</b>
                </td>
                <td>{r[1]}</td>
                <td>{r[2]}</td>
                <td>{r[3]}</td>
                <td>
                  <Badge tone={r[4].startsWith("Overdue") ? "warn" : ""}>
                    {r[4]}
                  </Badge>
                </td>
                <td>{r[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Page>
  );
}
