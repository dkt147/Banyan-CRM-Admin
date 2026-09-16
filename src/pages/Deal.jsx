import React from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
export default function Deal() {
  return (
    <Page
      title="Meridian Legal"
      kicker="Deal · Private office · Quote sent"
      actions={
        <>
          <button className="btn ghost">Send template</button>
          <button className="btn primary">Move stage</button>
        </>
      }
    >
      <div className="deal-layout">
        <section className="panel">
          <div className="deal-hero">
            <div>
              <span className="eyebrow">Private office — 4 desks</span>
              <h2>Meridian Legal</h2>
              <p>Adeline Cheung · Operations Director</p>
            </div>
            <Badge>Quote sent</Badge>
          </div>
          <div className="detail-grid">
            <div>
              <span className="eyebrow">Value</span>
              <b>HK$24,000 / month</b>
            </div>
            <div>
              <span className="eyebrow">Term</span>
              <b>24 months</b>
            </div>
            <div>
              <span className="eyebrow">Referral</span>
              <b>Colliers HK</b>
            </div>
            <div>
              <span className="eyebrow">AI signal</span>
              <b>Quiet 4 days</b>
            </div>
          </div>
          <SectionTitle title="Next action" />
          <div className="next-action">
            <b>Confirm rate, deposit terms and signature date.</b>
            <span>Nathan Sze approval required for two-month deposit.</span>
            <button className="btn primary">Log call + set next action</button>
          </div>
          <SectionTitle title="Activity" />
          <div className="timeline">
            <p>
              <b>Quote sent</b>
              <span>Yesterday · Template: Private office enquiry</span>
            </p>
            <p>
              <b>Viewing completed</b>
              <span>2 Sep · Suite 1204B</span>
            </p>
            <p>
              <b>Website enquiry</b>
              <span>28 Aug · deal created</span>
            </p>
          </div>
        </section>
        <aside className="panel deal-side">
          <SectionTitle title="Connected records" />
          <Info l="Contact" v="Adeline Cheung" />
          <Info l="Company" v="Meridian Legal" />
          <Info l="Agreement" v="Awaiting signature" />
          <Info l="Invoice" v="Not created yet" />
          <Info l="Calendar" v="Viewing completed" />
          <SectionTitle title="Documents" />
          <div className="doc">
            Private_Office_Quote.pdf <span>PDF</span>
          </div>
          <div className="doc">
            Office_Agreement_v3.pdf <span>DocuSign</span>
          </div>
        </aside>
      </div>
    </Page>
  );
}
function Info({ l, v }) {
  return (
    <div className="side-info">
      <span className="eyebrow">{l}</span>
      <b>{v}</b>
    </div>
  );
}
