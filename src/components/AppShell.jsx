import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { navItems } from "../data/mock";
import { useAuth } from "../auth/AuthContext";
import { longDate } from "../utils/dates";
import AssistantPanel from "./AssistantPanel";

const SIDEBAR_NAV_KEYS = [
  "dashboard", "tasks", "inbox", "pipelines", "deal", "contact",
  "templates", "calendar", "agreements", "invoices", "members", "automation",
];

const SIDEBAR_LABELS = { deal: "Deal", contact: "Contacts" };

export default function AppShell({ children }) {
  const nav = useNavigate();
  const loc = useLocation();

  const { user, logout, request } = useAuth();

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

  const active = loc.pathname.split("/")[1] || "dashboard";
  const dashboardTopbar = active === "dashboard" || active === "calendar";

  const go = (key) => nav("/" + key);

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

  function renderNavigationItem(item) {
    const [key, rawLabel, icon] = item;
    const label = SIDEBAR_LABELS[key] || rawLabel;
    return (
      <button
        key={key}
        type="button"
        className={["nav-standalone", active === key ? "active" : ""].filter(Boolean).join(" ")}
        onClick={() => go(key)}
        title={label}
        aria-current={active === key ? "page" : undefined}
      >
        <Icon name={icon} size={18} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="Banyan Workspace CRM">
          <img src="/banyan-logo.svg" alt="Banyan" />
        </div>

        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navItems.filter(([key]) => SIDEBAR_NAV_KEYS.includes(key)).map((item) => renderNavigationItem(item))}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={board ? "active" : ""}
            onClick={() => setBoard(true)}
          >
            <Icon name="SquaresFour" />
            <span>All screens</span>
          </button>

          <div className="sidebar-avatar-wrap">
            <button
              type="button"
              className="sidebar-avatar-button"
              onClick={() => setShowSidebarMenu((value) => !value)}
              aria-label="Account menu"
              aria-expanded={showSidebarMenu}
              title={displayName}
            >
              <span className="avatar">{initials}</span>
            </button>
            {showSidebarMenu && (
              <div className="sidebar-menu" role="menu">
                <div className="sidebar-menu-head">
                  <b>{displayName}</b>
                  <small>{user?.email || user?.jobTitle || user?.role || "CRM user"}</small>
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
            <span>{active === "calendar"
              ? `Availability · week ${calendarWeek}`
              : active === "dashboard"
                ? `Overview · ${longDate(new Date(), "Asia/Hong_Kong")}`
                : `Follow-ups · ${overdueFollowUps === null ? "—" : overdueFollowUps} overdue`}</span>
          </div>

          {dashboardTopbar ? (
            <div className="top-actions dashboard-global-actions">
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