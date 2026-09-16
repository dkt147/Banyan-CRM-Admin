import React from "react";
import { useState } from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
export default function Contacts() {
  const [sel, setSel] = useState(0);
  const c = ["Adeline Cheung", "Meridian Legal · Ops Director"];
  return (
    <Page
      title="Contacts"
      kicker="1,284 contacts"
      actions={
        <>
          <input
            className="search-input"
            placeholder="Search name, company, phone…"
          />
          <button className="btn primary">New contact</button>
        </>
      }
    >
      <div className="contact-grid">
        <section className="panel contact-list">
          <div className="filters">
            {[
              "All",
              "Prospect",
              "Active member",
              "Event client",
              "Broker",
              "VIP",
            ].map((x) => (
              <button key={x} className={x === "All" ? "on" : ""}>
                {x}
              </button>
            ))}
          </div>
          {[
            ["Adeline Cheung", "Meridian Legal · Ops Director"],
            ["Cynthia Mok", "Lumen Studio · Producer"],
            ["Marcus Oyelaran", "Independent · Active member"],
            ["Priya Raghunathan", "Kestrel Analytics · Founder"],
            ["Idris Bello", "Bello Advisory · Prospect"],
            ["Rina Takeshita", "Takeshita Studio · Prospect"],
            ["Wendy Lo", "Colliers HK · Broker"],
          ].map((x, i) => (
            <button
              className={`contact-row ${sel === i ? "selected" : ""}`}
              onClick={() => setSel(i)}
              key={x[0]}
            >
              <span className="avatar">
                {x[0]
                  .split(" ")
                  .map((s) => s[0])
                  .join("")}
              </span>
              <div>
                <b>{x[0]}</b>
                <span>{x[1]}</span>
              </div>
            </button>
          ))}
        </section>
        <section className="panel contact-detail">
          <div className="profile-head">
            <span className="avatar big">AC</span>
            <div>
              <span className="eyebrow">
                Operations Director · Meridian Legal
              </span>
              <h2>{c[0]}</h2>
              <div className="badges">
                <Badge>Prospect</Badge>
                <Badge>VIP</Badge>
                <Badge>Broker-introduced</Badge>
              </div>
            </div>
            <div className="actions">
              <button className="btn ghost">Send template</button>
              <button className="btn ghost">Log call</button>
              <button className="btn ghost">Enrich</button>
            </div>
          </div>
          <div className="detail-grid">
            <Info label="Email" value="adeline@meridianlegal.hk" />
            <Info label="Phone / WhatsApp" value="+852 9123 4488" />
            <Info label="Referral source" value="Broker — Colliers HK" />
            <Info label="Language" value="English" />
            <Info label="Owner" value="JoJo Lam" />
            <Info label="Company" value="Meridian Legal" />
          </div>
          <SectionTitle title="Open deals" />
          <div className="mini-deal">
            <b>Private office — 4 desks</b>
            <Badge>Quote sent</Badge>
            <span>HK$24,000/mo · 4 days quiet</span>
          </div>
          <SectionTitle title="Activity" />
          <div className="timeline">
            <p>
              <b>Quote sent</b>
              <span>Yesterday · 09:14</span>
            </p>
            <p>
              <b>Viewing completed</b>
              <span>2 Sep · Suite 1204B</span>
            </p>
            <p>
              <b>Website enquiry</b>
              <span>28 Aug</span>
            </p>
          </div>
        </section>
      </div>
    </Page>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <span className="eyebrow">{label}</span>
      <b>{value}</b>
    </div>
  );
}
