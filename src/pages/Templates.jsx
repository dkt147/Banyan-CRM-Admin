import React from "react";
import { useState } from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
import { templates } from "../data/mock";
export default function Templates() {
  const [idx, setIdx] = useState(1),
    t = templates[idx];
  return (
    <Page
      title="Email templates"
      kicker="One click to insert, fields filled from the deal. Every send is logged to the contact."
      actions={<button className="btn primary">New template</button>}
    >
      <div className="template-grid">
        <section className="panel template-list">
          {templates.map((x, i) => (
            <button
              className={i === idx ? "selected" : ""}
              onClick={() => setIdx(i)}
              key={x[0]}
            >
              <b>{x[0]}</b>
              <span>
                {x[2]} · {x[3]}
              </span>
            </button>
          ))}
        </section>
        <section className="panel template-editor">
          <div className="template-head">
            <div>
              <span className="eyebrow">{t[2]}</span>
              <h2>{t[0]}</h2>
              <p>{t[1]}</p>
            </div>
            <div>
              <button className="btn ghost">Duplicate</button>
              <button className="btn ghost">Edit</button>
            </div>
          </div>
          <div className="template-meta">
            <span>
              Auto-fills: <b>{t[3]}</b>
            </span>
            <span>
              Sends at stage: <b>{t[4]}</b>
            </span>
            <span>
              Follow-up: <b>{t[5] || "None"}</b>
            </span>
          </div>
          <div className="email-preview">
            <div className="email-top">
              <b>{t[1]}</b>
              <span>JoJo Lam · Banyan Workspace</span>
              <span>to adeline@meridianlegal.hk</span>
            </div>
            <div className="email-body">
              <strong>BANYAN WORKSPACE</strong>
              <small>Quarry Bay, Hong Kong</small>
              <p>Hi Adeline,</p>
              <p>
                Thanks for getting in touch. I’ve set out the options below and
                filled the details from your deal. If everything looks right,
                the next step is ready from the button below.
              </p>
              <div className="price-row">
                <span>Selected plan</span>
                <b>HK$24,000 / month</b>
              </div>
              <button className="btn primary">View your options</button>
              <p>
                Warm regards,
                <br />
                JoJo Lam
                <br />
                Community Manager, Banyan Workspace
              </p>
              <small>
                Suite 1204, Eastern Harbour Centre, 28 Hoi Chak Street, Quarry
                Bay · MTR Quarry Bay Exit C<br />
                +852 2159 5599 · info@banyanworkspace.com
              </small>
            </div>
          </div>
          <button className="btn primary">Insert into reply</button>
        </section>
      </div>
    </Page>
  );
}
