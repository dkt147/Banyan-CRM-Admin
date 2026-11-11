import React from "react";
import { Link } from "react-router-dom";

// "Bookings and Calendar" is one sidebar item (brief 6.7) with three views.
const TABS = [
  ["calendar", "/calendar", "Calendar"],
  ["rooms", "/room-bookings", "Meeting rooms"],
  ["list", "/bookings", "All bookings"],
];

export default function BookingsTabs({ active }) {
  return (
    <nav className="bk-tabs" aria-label="Bookings views">
      {TABS.map(([key, to, label]) => (
        <Link key={key} to={to} className={active === key ? "active" : ""} aria-current={active === key ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
