import React from "react";
import Metric from "../components/Metric";
import Badge from "../components/Badge";
export default function Dashboard() {
  return (
    <Page
      title="Good morning, JoJo"
      kicker="Tuesday 9 September 2026 · Week 37"
      actions={
        <>
          <button className="btn ghost">Overview</button>
          <button className="btn ghost">Sources</button>
        </>
      }
    >
      <div className="metrics four">
        <Metric
          label="Open pipeline"
          value="HK$1,840,000"
          sub="▲ 12% vs last month · 42 deals"
        />
        <Metric
          label="Occupancy"
          value="86%"
          sub="38/44 desks · 9/11 offices"
        />
        <Metric
          label="Renewals · 60 days"
          value="HK$412,000"
          sub="recurring at stake"
        />
        <Metric
          label="Needs action"
          value="7"
          sub="3 overdue · 2 unpaid invoices"
          accent
        />
      </div>
      <div className="two-col">
        <section className="panel">
          <SectionTitle
            title="Pipeline value by stage"
            note="Four motions running in parallel"
          />
          <div className="pipeline-bars">
            <Bar
              label="Membership"
              value="HK$486,000 · 14"
              parts={[
                "Enquiry 5",
                "Template 3",
                "Trial 2",
                "Agreement 2",
                "Deposit 1",
              ]}
            />
            <Bar
              label="Private office"
              value="HK$1,020,000 · 9"
              parts={[
                "Enquiry 2",
                "Viewing 3",
                "Quote 2",
                "Negotiation 1",
                "Move-in 1",
              ]}
            />
            <Bar
              label="Venue hire & studio"
              value="HK$268,000 · 13"
              parts={["Enquiry 4", "Quote 4", "Agreement 3", "Deposit 2"]}
            />
            <Bar
              label="Transactional"
              value="Automated"
              parts={["Booking received", "Confirmed", "Completed"]}
            />
          </div>
        </section>
        <section className="panel">
          <SectionTitle title="Today's queue" note="3 overdue" />
          <div className="queue">
            <Row
              title="Follow up on quote — Lumen Studio"
              sub="Venue hire · HK$38,000 · overdue 3 days"
              tag="Overdue"
            />
            <Row
              title="Viewing — Meridian Legal"
              sub="Private office 1204B · 15:30"
              tag="Today"
            />
            <Row
              title="Call Saltwater about renewal"
              sub="Private office · renews 18 Oct"
              tag="17:00"
            />
            <Row
              title="Reply to Kenneth Yau"
              sub="WhatsApp · Saturday availability"
              tag="Anytime"
            />
          </div>
        </section>
      </div>
      <div className="three-col">
        <section className="panel">
          <SectionTitle title="Inbox" note="12 unanswered" />
          <Row
            title="Re: quote for four desks"
            sub="Adeline Cheung · 9 messages"
            tag="08:52"
          />
          <Row
            title="Can we hold the venue for 24 Oct?"
            sub="Cynthia Mok"
            tag="08:31"
          />
          <Row
            title="Signed agreement attached"
            sub="Harbour Pictures"
            tag="Yesterday"
          />
        </section>
        <section className="panel">
          <SectionTitle title="Revenue mix · August" />
          <div className="mix">
            <div>
              <b>Membership</b>
              <span>HK$318k</span>
            </div>
            <div>
              <b>Private office</b>
              <span>HK$212k</span>
            </div>
            <div>
              <b>Venue / studio</b>
              <span>HK$96k</span>
            </div>
            <div>
              <b>Transactional</b>
              <span>HK$41k</span>
            </div>
          </div>
        </section>
        <section className="panel ai-panel">
          <span className="eyebrow">Banyan AI</span>
          <h3>Three things worth knowing</h3>
          <p>Lumen Studio crossed the Gold threshold after the June payment.</p>
          <p>
            Meridian Legal has been quiet for 4 days; their viewing is today.
          </p>
          <p>Saltwater has used 94% of room credits for three months.</p>
        </section>
      </div>
    </Page>
  );
}
function Bar({ label, value, parts }) {
  return (
    <div className="bar-row">
      <div className="bar-head">
        <b>{label}</b>
        <span>{value}</span>
      </div>
      <div className="stage-track">
        {parts.map((p, i) => (
          <span key={p} style={{ flex: 1 }}>
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}
function Row({ title, sub, tag }) {
  return (
    <div className="row">
      <div>
        <b>{title}</b>
        <span>{sub}</span>
      </div>
      <Badge>{tag}</Badge>
    </div>
  );
}
export function Page({ title, kicker, actions, children }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{kicker}</span>
          <h1>{title}</h1>
        </div>
        <div className="actions">{actions}</div>
      </div>
      {children}
    </div>
  );
}
export function SectionTitle({ title, note }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {note && <span>{note}</span>}
    </div>
  );
}
