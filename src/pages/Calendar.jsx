import React from "react";
import { useState } from "react";
import { Page, SectionTitle } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
const bookings = [
  ["09:00", "Harbour Room", "Fiona Ng · 10 pax", "Confirmed booking"],
  ["11:00", "Viewing 1204B", "Meridian Legal", "Trial & viewing"],
  ["13:00", "Podcast studio", "Sonder Media", "Confirmed booking"],
  ["15:00", "Terrace Room", "Kestrel · 6 pax", "Confirmed booking"],
  ["18:00", "Harbour Room", "Novo Health", "Photoshoot"],
];
export default function Calendar() {
  const [modal, setModal] = useState(false);
  return (
    <Page
      title="Availability · 9–13 September"
      kicker="Two-way sync with Google Calendar"
      actions={
        <button className="btn primary" onClick={() => setModal(true)}>
          Check & hold a slot
        </button>
      }
    >
      <div className="metrics three">
        <div className="metric">
          <span className="eyebrow">Meeting room credits</span>
          <strong>82%</strong>
          <span className="muted">12 members near limit</span>
        </div>
        <div className="metric">
          <span className="eyebrow">Inbound bookings</span>
          <strong>8</strong>
          <span className="muted">this week · booking feed</span>
        </div>
        <div className="metric">
          <span className="eyebrow">Sync</span>
          <strong>Healthy</strong>
          <span className="muted">Google Calendar · 2-way</span>
        </div>
      </div>
      <section className="panel calendar">
        <div className="calendar-head">
          <div className="seg">
            <button className="on">Day</button>
            <button>Week</button>
            <button>Month</button>
          </div>
          <span>Tue 9 · Today</span>
        </div>
        <div className="calendar-grid">
          <div className="times">
            {["09:00", "11:00", "13:00", "15:00", "18:00"].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          <div className="day-column">
            <div className="day-name">
              Tue 9 <small>Today</small>
            </div>
            {bookings.map((b) => (
              <div className="calendar-event" key={b[0]}>
                <b>{b[1]}</b>
                <span>{b[2]}</span>
                <Badge>{b[3]}</Badge>
              </div>
            ))}
          </div>
          <div className="day-column">
            <div className="day-name">Wed 10</div>
            <div className="hold">Open</div>
            <div className="calendar-event muted-event">
              <b>Trial day</b>
              <span>Talia Berger</span>
            </div>
          </div>
          <div className="day-column">
            <div className="day-name">Thu 11</div>
            <div className="calendar-event">
              <b>Harbour Room</b>
              <span>Novo Health</span>
            </div>
          </div>
          <div className="day-column">
            <div className="day-name">Fri 12</div>
            <div className="hold">Open</div>
          </div>
          <div className="day-column">
            <div className="day-name">Sat 13</div>
            <div className="calendar-event">
              <b>Photoshoot cont.</b>
              <span>Harbour Pictures</span>
            </div>
          </div>
        </div>
      </section>
      {modal && (
        <Modal
          title="Check & hold a slot"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={() => setModal(false)}>
                Hold slot
              </button>
            </>
          }
        >
          <label>
            Space
            <select>
              <option>Harbour Room</option>
              <option>Terrace Room</option>
              <option>Podcast studio</option>
            </select>
          </label>
          <label>
            Date
            <input type="date" />
          </label>
          <label>
            Start
            <input type="time" defaultValue="18:00" />
          </label>
          <label>
            Duration
            <select>
              <option>1 hour</option>
              <option>2 hours</option>
              <option>Half day</option>
            </select>
          </label>
        </Modal>
      )}
    </Page>
  );
}
