import React from "react";
import { Page, SectionTitle } from "./Dashboard";
import Metric from "../components/Metric";
import Badge from "../components/Badge";
const flags = [
  [
    "Ceres Nutrition",
    "No check-in 41 days",
    "Virtual office · HK$800/mo · renews 9 Nov",
    "Mail collected once since July. Worth a call before the renewal notice goes out.",
  ],
  [
    "Wing Tai Consulting",
    "Complaint logged",
    "Coworking · 3 members · HK$11,400/mo",
    "Raised noise in the lounge twice in August. Offer the quiet zone desks.",
  ],
  [
    "Saltwater Design Co.",
    "Upsell opportunity",
    "Private office · 6 desks · renews 18 Oct",
    "Meeting room credits at 94% for three months running — propose the next tier.",
  ],
];
export default function Members() {
  return (
    <Page
      title="Members"
      kicker="Lifecycle after the sale"
      actions={<button className="btn primary">Add member</button>}
    >
      <div className="filters large">
        {[
          "All 47",
          "Private office 11",
          "Coworking 24",
          "Virtual 12",
          "At risk 3",
        ].map((x) => (
          <button className={x.startsWith("All") ? "on" : ""} key={x}>
            {x}
          </button>
        ))}
      </div>
      <div className="metrics four">
        <Metric label="Desk occupancy" value="86%" sub="38 of 44 desks" />
        <Metric label="Office occupancy" value="82%" sub="9 of 11 suites" />
        <Metric label="Recurring revenue" value="HK$318k" sub="Per month" />
        <Metric label="At risk" value="HK$34,400/mo" sub="exposed" accent />
      </div>
      <section>
        <SectionTitle title="Flagged for attention" />
        <div className="flag-grid">
          {flags.map((f) => (
            <div className="panel flag" key={f[0]}>
              <div>
                <b>{f[0]}</b>
                <Badge tone="warn">{f[1]}</Badge>
              </div>
              <span>{f[2]}</span>
              <p>{f[3]}</p>
              <button className="btn ghost">Open member</button>
            </div>
          ))}
        </div>
      </section>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Plan</th>
              <th>Started</th>
              <th>Renews</th>
              <th>Add-ons</th>
              <th>Last check-in</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>Saltwater Design Co.</b>
                <span>6 members</span>
              </td>
              <td>Private office · 6 desks</td>
              <td>18 Oct 2025</td>
              <td>18 Oct 2026</td>
              <td>Lockers · cards</td>
              <td>8 Sep</td>
            </tr>
            <tr>
              <td>
                <b>Meridian Legal</b>
                <span>4 members</span>
              </td>
              <td>Private office · 4 desks</td>
              <td>1 Nov 2025</td>
              <td>1 Nov 2026</td>
              <td>Meeting room credits</td>
              <td>Today</td>
            </tr>
          </tbody>
        </table>
      </section>
    </Page>
  );
}
