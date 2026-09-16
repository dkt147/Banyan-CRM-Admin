import React from "react";
import { useState } from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
const rules = [
  [
    "When a quote is sent,",
    "create",
    "a follow-up task for 3 days later.",
    "All pipelines · ran 34 times this month",
    true,
  ],
  [
    "When an agreement is signed,",
    "create",
    "the deposit invoice in Xero and a task to send it.",
    "DocuSign → Xero · ran 9 times this month",
    true,
  ],
  [
    "When a membership expires in 60 days,",
    "send",
    "the renewal reminder; repeat at 30 days.",
    "Members · 11 in the window",
    true,
  ],
  [
    "When an event is completed,",
    "send",
    "thanks and a Google review request after 2 days.",
    "Venue hire · ran 6 times this month",
    true,
  ],
  [
    "When a website form arrives,",
    "create",
    "the contact and deal, and reply with the product template.",
    "WordPress → CRM · ran 41 times this month",
    true,
  ],
  [
    "When a member has not checked in for 30 days,",
    "flag",
    "them at risk.",
    "Needs the access control feed · off",
    false,
  ],
];
export default function Automation() {
  const [enabled, setEnabled] = useState(rules.map((x) => x[4]));
  return (
    <Page
      title="Automations & connections"
      kicker="Rules, in plain English"
      actions={<button className="btn primary">New rule</button>}
    >
      <div className="automation-grid">
        <section>
          <SectionTitle title="Active rules" />
          {rules.map((r, i) => (
            <div className="rule panel" key={r[0]}>
              <div className="rule-copy">
                <div>
                  <span>{r[0]}</span> <b>{r[1]}</b> <span>{r[2]}</span>
                </div>
                <small>{r[3]}</small>
              </div>
              <button
                className={`switch ${enabled[i] ? "on" : ""}`}
                onClick={() =>
                  setEnabled((e) => e.map((v, j) => (j === i ? !v : v)))
                }
              >
                <i />
              </button>
            </div>
          ))}
        </section>
        <section>
          <SectionTitle title="Inside a rule — stale deal escalation" />
          <div className="panel branch">
            <div>
              <span className="eyebrow">Trigger</span>
              <b>No activity on an open deal</b>
            </div>
            <strong>→</strong>
            <div>
              <span className="eyebrow">Condition</span>
              <b>Days since last activity ≥ 5</b>
            </div>
            <strong>→</strong>
            <div>
              <span className="eyebrow">Action</span>
              <b>Create Tier A task</b>
            </div>
            <div className="branch-note">
              7 days → Tier B · 10 days → Tier C. The operator can override any
              escalation.
            </div>
          </div>
          <SectionTitle title="Connected tools" />
          <div className="connections">
            {[
              ["Gmail", "Two-way email · OAuth", "Connected"],
              ["WhatsApp Business", "Messages + templates", "Connected"],
              ["Google Calendar", "Two-way availability", "Connected"],
              ["Xero", "Invoices + payment status", "Connected"],
              ["DocuSign", "Agreements + signature events", "Connected"],
              ["WordPress", "Website lead webhook", "Connected"],
              ["Access control", "Check-in feed", "Not connected"],
            ].map((x) => (
              <div className="connection panel" key={x[0]}>
                <div>
                  <b>{x[0]}</b>
                  <span>{x[1]}</span>
                </div>
                <Badge tone={x[2] === "Connected" ? "" : "warn"}>{x[2]}</Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
