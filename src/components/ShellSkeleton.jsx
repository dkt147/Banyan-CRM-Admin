import React from "react";

/*
 * Full-shell loading state (style guide §5 / §6.17): the sidebar renders as mint
 * shimmer bars and the content area as grey bars, so the layout appears before data.
 */
const NAV_BARS = 12;

export default function ShellSkeleton({ label = "Loading Banyan CRM…" }) {
  return (
    <div className="shell-skeleton" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <aside className="shell-skeleton-sidebar" aria-hidden="true">
        <div className="skeleton skeleton-brand" />
        {Array.from({ length: NAV_BARS }, (_, i) => (
          <div key={i} className="skeleton skeleton-nav" />
        ))}
        <div className="shell-skeleton-footer">
          <div className="skeleton skeleton-nav" />
          <div className="skeleton skeleton-nav short" />
        </div>
      </aside>
      <main className="shell-skeleton-main" aria-hidden="true">
        <div className="shell-skeleton-topbar">
          <div className="skeleton" style={{ width: 160, height: 24 }} />
          <div className="skeleton" style={{ width: 32, height: 24 }} />
          <div className="skeleton" style={{ width: 32, height: 24 }} />
        </div>
        <div className="skeleton" style={{ width: 220, height: 32, marginBottom: 24 }} />
        <div className="shell-skeleton-cards">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton skeleton-card" />)}
        </div>
        <div className="skeleton" style={{ width: "100%", height: 280 }} />
      </main>
    </div>
  );
}
