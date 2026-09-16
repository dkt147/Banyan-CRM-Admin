import React from "react";
import { useState } from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { pipelineData } from "../data/mock";
export default function Pipelines() {
  const [pipe, setPipe] = useState("Membership"),
    [view, setView] = useState("Kanban"),
    [drawer, setDrawer] = useState(false),
    [newDeal, setNewDeal] = useState(false);
  const d = pipelineData[pipe];
  return (
    <Page
      title="Pipelines"
      kicker="Membership · 14 open deals"
      actions={
        <>
          <div className="seg">
            <button
              className={view === "Kanban" ? "on" : ""}
              onClick={() => setView("Kanban")}
            >
              Kanban
            </button>
            <button
              className={view === "Table" ? "on" : ""}
              onClick={() => setView("Table")}
            >
              Table
            </button>
            <button
              className={view === "Calendar" ? "on" : ""}
              onClick={() => setView("Calendar")}
            >
              Calendar
            </button>
          </div>
          <button className="btn primary" onClick={() => setNewDeal(true)}>
            New deal
          </button>
        </>
      }
    >
      <div className="pipeline-tabs">
        {Object.keys(pipelineData).map((x) => (
          <button
            className={pipe === x ? "active" : ""}
            onClick={() => setPipe(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="pipeline-summary">
        <b>{d.value} open</b>
        <span>avg close {d.close}</span>
        <span>{d.count} deals</span>
      </div>
      {view === "Kanban" ? (
        <div className="kanban">
          {d.stages.map(([stage, value, cards]) => (
            <div className="kanban-col" key={stage}>
              <div className="kanban-head">
                <b>{stage}</b>
                <span>{value}</span>
              </div>
              {cards.map((c) => (
                <button
                  className="deal-card"
                  key={c[0]}
                  onClick={() => setDrawer(c)}
                >
                  <b>{c[0]}</b>
                  <span>{c[1]}</span>
                  <small>
                    {c[2]} {c[3] && `· ${c[3]}`}
                  </small>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Product</th>
                <th>Stage</th>
                <th>Value</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {d.stages.flatMap(([s, , cards]) =>
                cards.map((c) => (
                  <tr key={c[0]} onClick={() => setDrawer(c)}>
                    <td>
                      <b>{c[0]}</b>
                    </td>
                    <td>{c[1]}</td>
                    <td>
                      <Badge>{s}</Badge>
                    </td>
                    <td>—</td>
                    <td>{c[2]}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
      {drawer && <DealDrawer card={drawer} onClose={() => setDrawer(false)} />}{" "}
      {newDeal && (
        <Modal
          title="New deal"
          onClose={() => setNewDeal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setNewDeal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={() => setNewDeal(false)}>
                Create deal
              </button>
            </>
          }
        >
          <label>
            Contact
            <input placeholder="Search contact" />
          </label>
          <label>
            Pipeline
            <select defaultValue={pipe}>
              {Object.keys(pipelineData).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Value
            <input placeholder="HK$" />
          </label>
        </Modal>
      )}
    </Page>
  );
}
function DealDrawer({ card, onClose }) {
  return (
    <div className="drawer">
      <div className="drawer-head">
        <div>
          <span className="eyebrow">Deal · Private office / Membership</span>
          <h2>{card[0]}</h2>
        </div>
        <button className="icon-btn" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="drawer-body">
        <div className="deal-meta">
          <Badge>{card[2]}</Badge>
          <Badge>{card[3] || "Website form"}</Badge>
        </div>
        <dl>
          <dt>Product</dt>
          <dd>{card[1]}</dd>
          <dt>Contact</dt>
          <dd>Adeline Cheung · Meridian Legal</dd>
          <dt>Agreement</dt>
          <dd>Awaiting signature</dd>
          <dt>Invoice</dt>
          <dd>Xero draft prepared</dd>
        </dl>
        <SectionTitle title="Activity" />
        <div className="timeline">
          <p>
            <b>Quote sent</b>
            <span>Yesterday · email template inserted</span>
          </p>
          <p>
            <b>Viewing completed</b>
            <span>2 Sep · suite 1204B</span>
          </p>
          <p>
            <b>Deal created</b>
            <span>28 Aug · website enquiry</span>
          </p>
        </div>
      </div>
      <div className="drawer-actions">
        <button className="btn ghost">Log call + set next action</button>
        <button className="btn ghost">Send template</button>
        <button className="btn primary">Move stage</button>
      </div>
    </div>
  );
}
