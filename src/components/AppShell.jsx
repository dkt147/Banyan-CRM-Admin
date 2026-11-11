import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { navItems } from "../data/mock";
import { useAuth } from "../auth/AuthContext";
import { longDate } from "../utils/dates";
import AssistantPanel from "./AssistantPanel";
import GlobalSearch from "./GlobalSearch";
import { roleLabel, usePermissions } from "../utils/permissions";

// Main navigation in the order of the brief (6.7). `match` lists the route prefixes that
// highlight the item (e.g. both /calendar and /bookings for Bookings and Calendar).
const PRIMARY_NAV = [
  { key: "dashboard", label: "Dashboard", icon: "ChartPieSlice", match: ["dashboard"] },
  { key: "contact", label: "Contacts", icon: "AddressBook", match: ["contact", "contacts"] },
  { key: "companies", label: "Companies", icon: "Buildings", match: ["companies"] },
  { key: "deal", label: "Deals", icon: "Handshake", match: ["deal", "deals"] },
  { key: "tasks", label: "Tasks", icon: "CheckSquareOffset", match: ["tasks"] },
  { key: "calendar", label: "Bookings and Calendar", icon: "CalendarDots", match: ["calendar", "bookings", "room-bookings"] },
  { key: "automation", label: "Automations", icon: "FlowArrow", match: ["automation"] },
  { key: "forms", label: "Forms", icon: "ClipboardText", match: ["forms"] },
  { key: "reports", label: "Reports", icon: "ChartBar", match: ["reports"] },
  { key: "settings", label: "Settings", icon: "Gear", match: ["settings", "workspace", "integrations", "audit-logs"] },
];
// Screens that were in the sidebar before the refresh stay one click away.
const MORE_NAV = [
  { key: "inbox", label: "Inbox", icon: "Tray", match: ["inbox"] },
  { key: "pipelines", label: "Pipelines", icon: "Kanban", match: ["pipelines"] },
  { key: "templates", label: "Templates", icon: "EnvelopeOpen", match: ["templates"] },
  { key: "agreements", label: "Agreements", icon: "Signature", match: ["agreements"] },
  { key: "invoices", label: "Invoices", icon: "Receipt", match: ["invoices"] },
  { key: "members", label: "Members", icon: "UsersThree", match: ["members"] },
];
const SIDEBAR_COLLAPSED_KEY = "banyan_sidebar_collapsed";

export default function AppShell({ children }) {
  const nav = useNavigate();
  const loc = useLocation();

  const { user, logout, request } = useAuth();
  const { can, readOnly } = usePermissions();
  // Read-only has no access to workflows or templates (brief section 7).
  const navVisible = ({ key }) => (key === "automation" ? can("workflows.view") : key === "templates" ? can("templates.use") : true);

  const [board, setBoard] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [overdueFollowUps, setOverdueFollowUps] = useState(null);
  const [calendarWeek, setCalendarWeek] = useState(() => isoWeekNumber(new Date()));
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [askQuery, setAskQuery] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantLaunchToken, setAssistantLaunchToken] = useState(0);
  // Sidebar collapses to an icon rail (style guide 6.2); the choice is remembered per browser.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  // Dark tooltip to the right of rail items. Rendered fixed because the nav scrolls and
  // would clip a CSS-only tooltip. Shown only when labels are hidden (rail width).
  const [railTip, setRailTip] = useState(null);
  function showRailTip(event) {
    const target = event.target.closest?.("[data-tooltip]");
    const aside = event.currentTarget;
    // No tooltip over an open menu (e.g. the account menu) or when labels are visible.
    if (!target || aside.offsetWidth > 120 || target.getAttribute("aria-expanded") === "true") { setRailTip(null); return; }
    const rect = target.getBoundingClientRect();
    setRailTip({ label: target.dataset.tooltip, top: rect.top + rect.height / 2, left: rect.right + 12 });
  }
  function toggleCollapsed() {
    setCollapsed((value) => {
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "0" : "1"); } catch {}
      return !value;
    });
  }

  const active = loc.pathname.split("/")[1] || "dashboard";
  const dashboardTopbar = active === "dashboard" || active === "calendar";

  const go = (key) => nav("/" + key);

  // Keep the active item visible when the nav list scrolls (e.g. Invoices near the bottom).
  React.useEffect(() => {
    document.querySelector(".sidebar .nav-standalone.active")?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  function submitAskQuery(event) {
    event?.preventDefault?.();
    const question = askQuery.trim();
    setAssistantOpen(true);
    if (question) {
      setAssistantPrompt(question);
      setAssistantLaunchToken((value) => value + 1);
      setAskQuery("");
    }
  }

  // Dashboard-style actions are shared by Dashboard and Availability; both reach the dashboard's global handlers.
  function openFromTopbar(eventName) {
    if (active === "dashboard") { window.dispatchEvent(new CustomEvent(eventName)); return; }
    nav("/dashboard");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(eventName)), 120);
  }

  React.useEffect(() => {
    const syncWeek = (event) => setCalendarWeek(event.detail?.week ?? isoWeekNumber(new Date()));
    window.addEventListener("banyan:calendar-window", syncWeek);
    return () => window.removeEventListener("banyan:calendar-window", syncWeek);
  }, []);


  React.useEffect(() => {
    request("/notifications", { query: { limit: 10 } })
      .then((r) => {
        const data = r?.data;
        setNotifications(
          Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : []
        );
      })
      .catch(() => {});
  }, [request]);

  React.useEffect(() => {
    request("/tasks/summary")
      .then((response) => setOverdueFollowUps(Number(response?.data?.overdue ?? 0)))
      .catch(() => setOverdueFollowUps(null));
  }, [request]);

  React.useEffect(() => {
    const syncTaskSummary = (event) => setOverdueFollowUps(Number(event.detail?.overdue ?? 0));
    window.addEventListener("banyan:task-summary-updated", syncTaskSummary);
    return () => window.removeEventListener("banyan:task-summary-updated", syncTaskSummary);
  }, []);

  const displayName = user?.name || "Banyan User";

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "BU";

  function renderNavigationItem({ key, label, icon, match }) {
    const isActive = match.includes(active);
    return (
      <button
        key={key}
        type="button"
        className={["nav-standalone", isActive ? "active" : ""].filter(Boolean).join(" ")}
        onClick={() => go(key)}
        data-tooltip={label}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon name={icon} size={20} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className={["app-shell", collapsed ? "is-collapsed" : ""].filter(Boolean).join(" ")}>
      <aside
        className="sidebar"
        onMouseOver={showRailTip}
        onFocus={showRailTip}
        onMouseLeave={() => setRailTip(null)}
        onBlur={() => setRailTip(null)}
      >
        {railTip && (
          <div className="rail-tooltip" role="tooltip" style={{ top: railTip.top, left: railTip.left }}>
            {railTip.label}
          </div>
        )}
        <div className="brand-row">
          <div className="brand" aria-label="Banyan Workspace CRM">
            <img src="/banyan-logo.svg" alt="Banyan" />
          </div>
          <button
            type="button"
            className="sidebar-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            data-tooltip={collapsed ? "Expand sidebar" : undefined}
          >
            <Icon name="SidebarSimple" size={20} />
          </button>
        </div>

        <nav className="sidebar-navigation" aria-label="Main navigation">
          {PRIMARY_NAV.filter(navVisible).map(renderNavigationItem)}
          <span className="nav-section-label">More</span>
          {MORE_NAV.filter(navVisible).map(renderNavigationItem)}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={board ? "active" : ""}
            onClick={() => setBoard(true)}
            data-tooltip="All screens"
            aria-label="All screens"
          >
            <Icon name="SquaresFour" size={20} />
            <span>All screens</span>
          </button>

          <div className="sidebar-avatar-wrap">
            <button
              type="button"
              className="sidebar-avatar-button"
              onClick={() => { setRailTip(null); setShowSidebarMenu((value) => !value); }}
              aria-label="Account menu"
              aria-expanded={showSidebarMenu}
              data-tooltip={displayName}
            >
              <span className="avatar">{initials}</span>
              <span className="sidebar-avatar-name">{displayName}</span>
            </button>
            {showSidebarMenu && (
              <div className="sidebar-menu" role="menu">
                <div className="sidebar-menu-head">
                  <b>{displayName}</b>
                  <small>{user?.email || user?.jobTitle || "CRM user"} · {roleLabel(user?.role)}</small>
                </div>
                <button type="button" role="menuitem" onClick={() => { setShowSidebarMenu(false); nav("/workspace"); }}>Workspace settings</button>
                <button type="button" role="menuitem" onClick={() => { setShowSidebarMenu(false); logout(); }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className={`topbar ${dashboardTopbar ? "topbar-dashboard" : ""} ${active === "calendar" ? "topbar-calendar" : ""}`}>
          <div className="topbar-title">
            <strong>Banyan CRM</strong>
            {readOnly && <span className="role-badge" title="You can view records but not change them">Read-only</span>}
            <span>{active === "calendar"
              ? `Availability · week ${calendarWeek}`
              : active === "dashboard"
                ? `Overview · ${longDate(new Date(), "Asia/Hong_Kong")}`
                : `Follow-ups · ${overdueFollowUps === null ? "—" : overdueFollowUps} overdue`}</span>
          </div>

          {dashboardTopbar ? (
            <div className="top-actions dashboard-global-actions">
              <GlobalSearch />
              <AskAnythingBar value={askQuery} onChange={setAskQuery} onSubmit={submitAskQuery} />
              <button type="button" className="btn ghost" onClick={() => nav("/activities")}>Log activity</button>
              <button
                type="button"
                className="btn primary"
                onClick={() => openFromTopbar("banyan:dashboard-new-deal")}
              >New deal</button>
            </div>
          ) : (
            <div className="top-actions">
              <GlobalSearch />
              <AskAnythingBar value={askQuery} onChange={setAskQuery} onSubmit={submitAskQuery} />
              <div className="notification-wrap">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowNotifications((value) => !value)}
                  aria-label="Toggle notifications"
                  aria-expanded={showNotifications}
                >
                  <Icon name="Bell" />
                  {notifications.some((n) => !n.readAt) && <i className="notification-dot" />}
                </button>

                {showNotifications && (
                  <div className="notification-popover">
                    <div className="notification-head">
                      <b>Notifications</b>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={async () => {
                          await request("/notifications/read-all", { method: "PATCH" }).catch(() => {});
                          setNotifications((current) => current.map((notification) => ({
                            ...notification,
                            readAt: new Date().toISOString(),
                          })));
                        }}
                      >Mark all read</button>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="empty-state">No notifications.</div>
                    ) : notifications.map((notification) => (
                      <div
                        className={["notification-item", notification.readAt ? "" : "unread"].filter(Boolean).join(" ")}
                        key={notification._id}
                      >
                        <b>{notification.title}</b>
                        <span>{notification.body || ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="profile-wrap">
                <button
                  type="button"
                  className="profile-button"
                  onClick={() => setShowProfile((value) => !value)}
                  aria-label="Open profile menu"
                  aria-expanded={showProfile}
                  title="Profile"
                >
                  <span className="avatar">{initials}</span>
                  <span className="profile-button-label">Profile</span>
                </button>
                {showProfile && (
                  <div className="profile-popover">
                    <div className="profile-popover-heading">
                      <b>{displayName}</b>
                      <span>{user?.email || "Signed-in user"}</span>
                      <small>{user?.jobTitle || user?.role || "CRM user"}</small>
                    </div>
                    <button type="button" className="profile-menu-action" onClick={() => { setShowProfile(false); nav("/workspace"); }}>Workspace settings</button>
                    <button type="button" className="profile-menu-action" onClick={() => { setShowProfile(false); logout(); }}>Sign out</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {children}
      </main>

      <AssistantPanel
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        initialPrompt={assistantPrompt}
        autoSubmitToken={assistantLaunchToken}
      />

      {board && (
        <ScreenBoard
          onClose={() => setBoard(false)}
          go={go}
        />
      )}
    </div>
  );
}

function AskAnythingBar({ value, onChange, onSubmit }) {
  return (
    <form className="assistant-topbar-form" role="search" onSubmit={onSubmit}>
      <Icon name="Sparkle" size={15} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask anything — e.g. deals quiet over 5 days"
        aria-label="Ask Banyan Assist"
        maxLength={2000}
      />
      <button type="submit" aria-label="Ask Banyan Assist" title="Ask Banyan Assist">
        <Icon name="ArrowUpRight" size={16} />
      </button>
    </form>
  );
}

function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function ScreenBoard({ onClose, go }) {
  return (
    <div className="board-overlay">
      <div className="board-head">
        <div>
          <span className="eyebrow">
            Banyan CRM prototype review
          </span>

          <h2>All screens</h2>
        </div>

        <button
          type="button"
          className="btn ghost"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="board-grid">
        {navItems.map(([key, label, icon, crumb]) => (
          <button
            type="button"
            key={key}
            className="board-card"
            onClick={() => {
              onClose();
              go(key);
            }}
          >
            <div className="mini-icon">
              <Icon name={icon} />
            </div>

            <div>
              <b>{label}</b>
              <span>{crumb}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}