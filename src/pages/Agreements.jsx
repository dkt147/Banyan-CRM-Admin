import React from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
const rows = [
  [
    "Novo Health Ltd",
    "Membership_Agreement_v3.pdf",
    "Membership",
    "HK$7,400/mo",
    "Sent · viewed",
    "Sent this morning",
  ],
  [
    "Lumen Studio",
    "Venue_Hire_Agreement.pdf",
    "Venue hire",
    "HK$32,500",
    "Unsigned 6 days",
    "Chase today",
  ],
  [
    "Harbour Pictures",
    "Shoot_Agreement_signed.pdf",
    "Photo / video shoot",
    "HK$11,500",
    "Signed",
    "Deposit invoice due",
  ],
  [
    "Saltwater Design Co.",
    "Office_Agreement_2025.pdf",
    "Private office",
    "HK$96,000/yr",
    "Active",
    "Expires 18 Oct · reminder sent",
  ],
  [
    "Wing Tai Consulting",
    "Membership_Agreement_2025.pdf",
    "Membership · 3 members",
    "HK$54,000/yr",
    "Active",
    "Renewal tracked",
  ],
];
export default function Agreements() {
  return (
    <Page
      title="Agreements"
      kicker="DocuSign · sent, tracked and stored on the deal"
      actions={<button className="btn primary">Send for signature</button>}
    >
      <div className="metrics five">
        <MetricX label="Awaiting signature" value="4" />
        <MetricX label="Signed this month" value="12" />
        <MetricX label="Unsigned over 5 days" value="1" />
        <MetricX label="Expiring in 90 days" value="6" />
      </div>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client & document</th>
              <th>Type</th>
              <th>Value</th>
              <th>Status</th>
              <th>Expiry / action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>
                <td>
                  <b>{r[0]}</b>
                  <span>{r[1]}</span>
                </td>
                <td>{r[2]}</td>
                <td>{r[3]}</td>
                <td>
                  <Badge tone={r[4].includes("Unsigned") ? "warn" : ""}>
                    {r[4]}
                  </Badge>
                </td>
                <td>{r[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="notice">
        <b>Signed agreement → deposit invoice</b>
        <span>
          When DocuSign reports a completed signature, the automation creates
          the Xero draft invoice and a task to send it.
        </span>
      </div>
    </Page>
  );
}
function MetricX({ label, value }) {
  return (
    <div className="metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
