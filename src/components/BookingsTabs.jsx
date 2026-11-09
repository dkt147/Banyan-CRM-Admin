import React from "react";
import { Link } from "react-router-dom";

// "Bookings and Calendar" is one sidebar item (brief 6.7) with two views.
export default function BookingsTabs({ active }) {
  return (
    <nav className="bk-tabs" aria-label="Bookings views">
      <Link to="/calendar" className={active === "calendar" ? "active" : ""} aria-current={active === "calendar" ? "page" : undefined}>Calendar</Link>
      <Link to="/bookings" className={active === "list" ? "active" : ""} aria-current={active === "list" ? "page" : undefined}>Bookings list</Link>
    </nav>
  );
}
