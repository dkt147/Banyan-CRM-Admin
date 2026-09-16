import React from "react";
export default function Metric({ label, value, sub, accent }) {
  return (
    <div className="metric">
      <span className="eyebrow">{label}</span>
      <strong className={accent ? "accent" : ""}>{value}</strong>
      <span className="muted">{sub}</span>
    </div>
  );
}
