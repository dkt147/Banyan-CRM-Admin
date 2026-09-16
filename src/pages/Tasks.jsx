import React from "react";
import { useState } from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
const groups = [
  [
    "Overdue",
    [
      [
        "Follow up on quote — Lumen Studio",
        "Venue hire · HK$38,000 · quote sent 6 days ago · Cynthia Mok",
        "Auto-created by “quote sent → follow up in 3 days” · overdue 3 days",
        "Log call",
      ],
      [
        "Issue deposit invoice — Harbour Pictures",
        "Photoshoot · HK$5,750 deposit · agreement signed yesterday",
        "Auto-created on signature · Xero draft prepared",
        "Send invoice",
      ],
      [
        "Re-engage — Delphine Roux",
        "Coworking · HK$3,800/mo · no reply since 3 Sep",
        "Flagged inactive · Tier A threshold is 5 days",
        "Send template",
      ],
    ],
  ],
  [
    "Today",
    [
      [
        "Viewing — Meridian Legal, 15:30",
        "Private office 1204B · Adeline Cheung + Nathan Sze",
        "15:30",
        "Confirm",
      ],
      [
        "Confirm trial day — Priya Raghunathan",
        "Coworking · trial booked for Thursday",
        "14:00",
        "Confirm",
      ],
      [
        "Call Saltwater about renewal",
        "Private office · renews 18 Oct · 60-day reminder",
        "17:00",
        "Call",
      ],
      [
        "Reply to Kenneth Yau on WhatsApp",
        "Day pass · Saturday availability question",
        "Anytime",
        "Reply",
      ],
    ],
  ],
  [
    "Completed today",
    [
      ["Send agreement — Novo Health Ltd", "Agreement sent", "Done", ""],
      [
        "Post-event review request — Aurora Beauty launch",
        "Review request sent",
        "Done",
        "",
      ],
      [
        "Confirm meeting room — Fiona Ng, 24 Oct",
        "Calendar confirmed",
        "Done",
        "",
      ],
    ],
  ],
];
export default function Tasks() {
  const [done, setDone] = useState([]),
    [modal, setModal] = useState(null);
  return (
    <Page
      title="Tasks"
      kicker="Follow-ups · 3 overdue"
      actions={
        <button className="btn primary" onClick={() => setModal("New task")}>
          New task
        </button>
      }
    >
      <div className="notice">
        <b>Every task below was created by a rule, not by hand.</b>
        <span>
          Automations keep the queue moving; the operator only decides what
          needs attention.
        </span>
      </div>
      {groups.map(([name, items]) => (
        <section className="task-group" key={name}>
          <SectionTitle title={name} />
          {items.map(([title, sub, meta, action]) => (
            <div
              className={`task-card ${done.includes(title) ? "complete" : ""}`}
              key={title}
            >
              <div>
                <div className="task-title">
                  <b>{title}</b>
                  <Badge tone={name === "Overdue" ? "warn" : ""}>{meta}</Badge>
                </div>
                <span>{sub}</span>
              </div>
              {action && (
                <div className="task-actions">
                  <button
                    className="btn ghost"
                    onClick={() => setDone((d) => [...d, title])}
                  >
                    {done.includes(title) ? "Completed" : action}
                  </button>
                  {name === "Overdue" && (
                    <button
                      className="btn ghost"
                      onClick={() => setModal("Snooze task")}
                    >
                      Snooze
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
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
                Save
              </button>
            </>
          }
        >
          <label>
            Task title
            <input placeholder="Follow up with client" />
          </label>
          <label>
            Due date
            <input type="date" />
          </label>
        </Modal>
      )}
    </Page>
  );
}
