import React from "react";
import { Link } from "react-router-dom";
import { Page } from "./Dashboard";
import Icon from "../components/Icon";

// Settings hub: every entry opens an existing settings screen.
const SECTIONS = [
  ["/workspace", "Gear", "Workspace", "Name, timezone and currency"],
  ["/members", "UsersThree", "Team and roles", "Invite users and manage access"],
  ["/integrations", "PlugsConnected", "Integrations", "Google, Gmail, WhatsApp, Stripe, Xero, DocuSign"],
  ["/templates", "EnvelopeOpen", "Email and WhatsApp templates", "Reusable messages with merge fields"],
  ["/pipelines", "Kanban", "Pipelines and stages", "Stages, probabilities and the deal board"],
  ["/audit-logs", "ListChecks", "Audit log", "Administrative history"],
  ["/notifications", "Bell", "Notifications", "Workspace alerts"],
];

export default function Settings() {
  return (
    <Page title="Settings" kicker="Workspace configuration">
      <div className="st-grid">
        {SECTIONS.map(([to, icon, title, text]) => (
          <Link key={to} to={to} className="st-card">
            <Icon name={icon} size={22} />
            <span><b>{title}</b><small>{text}</small></span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
