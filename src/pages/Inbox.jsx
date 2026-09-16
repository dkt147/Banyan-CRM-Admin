import React from "react";
import { useState } from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
const threads = [
  [
    "Meridian Legal",
    "08:52",
    "Re: quote for four desks",
    "Adeline: a few questions before we sign…",
  ],
  ["Cynthia Mok", "08:31", "Can we hold the venue for 24 Oct evening?", ""],
  [
    "Harbour Pictures",
    "Yesterday",
    "Signed agreement attached",
    "Please send the deposit invoice…",
  ],
  ["Kenneth Yau", "Yesterday", "Is the day pass valid on Saturdays?", ""],
  [
    "Priya Raghunathan",
    "Mon",
    "Trial day on Thursday",
    "Looking forward to it — what time…",
  ],
  ["Wendy Lo · Colliers", "Mon", "Two more office enquiries", ""],
  ["Delphine Roux", "Sun", "Merci — I’ll confirm next week", ""],
];
export default function Inbox() {
  const [sel, setSel] = useState(threads[0]);
  return (
    <Page
      title="Inbox"
      kicker="Email and WhatsApp · 12 unanswered"
      actions={<button className="btn ghost">Connect Gmail</button>}
    >
      <div className="inbox-grid">
        <section className="panel thread-list">
          <SectionTitle title="Inbox" note="All 12 · Email 8 · WhatsApp 4" />
          {threads.map((t) => (
            <button
              className={`thread ${sel[0] === t[0] ? "selected" : ""}`}
              onClick={() => setSel(t)}
              key={t[0]}
            >
              <div>
                <b>{t[0]}</b>
                <span>{t[2]}</span>
                <small>{t[3]}</small>
              </div>
              <time>{t[1]}</time>
            </button>
          ))}
        </section>
        <section className="panel conversation">
          <div className="conversation-head">
            <div>
              <span className="eyebrow">
                {sel[0]} · adeline@meridianlegal.hk · 9 messages
              </span>
              <h2>{sel[2]}</h2>
            </div>
            <Badge>Quote sent</Badge>
          </div>
          <div className="linked-deal">
            <b>Linked deal: Private office — 4 desks</b>
            <span>Stage: Quote sent · Quiet 4 days</span>
          </div>
          <div className="message-summary">
            <Badge>AI assist</Badge>
            <p>
              Nine messages since 28 August. Adeline wants suite 1204B for four
              desks from 1 November, needs a 24-month term at a fixed rate, and
              asks whether the deposit can be two months instead of three.
              Nathan Sze must approve. Outstanding: confirmed rate, deposit
              terms, and a signature date.
            </p>
          </div>
          <div className="message">
            <b>Adeline Cheung</b>
            <p>
              Hi JoJo — a few questions before we sign. Can we hold suite 1204B
              while we confirm the deposit terms?
            </p>
            <small>08:52 today</small>
          </div>
          <div className="reply">
            <textarea placeholder="Write a reply or insert a template…" />
            <div>
              <button className="btn ghost">Insert template</button>
              <button className="btn ghost">Create task</button>
              <button className="btn primary">
                Send & move to Negotiation
              </button>
            </div>
          </div>
        </section>
      </div>
    </Page>
  );
}
