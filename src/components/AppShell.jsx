import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { navItems } from "../data/mock";
import { useAuth } from "../auth/AuthContext";

export default function AppShell({ children }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, logout, request } = useAuth();
  const [board, setBoard] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const active = loc.pathname.split("/")[1] || "dashboard";
  const go = (key) => nav("/" + key);

  React.useEffect(() => {
    request("/notifications", { query: { limit: 10 } })
      .then((r) => setNotifications(r.data || []))
      .catch(() => {});
  }, [request]);

  const displayName = user?.name || "Banyan User";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "BU";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/banyan-logo.svg" alt="Banyan" />
          <div>
            <strong>BANYAN</strong>
            <span>WORKSPACE CRM</span>
          </div>
        </div>

        <nav>
          {navItems.map(([key, label, icon]) => (
            <button
              key={key}
              className={active === key ? "active" : ""}
              onClick={() => go(key)}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className={board ? "active" : ""}
            onClick={() => setBoard(true)}
          >
            <Icon name="SquaresFour" />
            <span>All screens</span>
          </button>

          <div className="user-mini">
            <span className="avatar">{initials}</span>
            <div>
              <b>{displayName}</b>
              <small>{user?.jobTitle || user?.role || "CRM user"}</small>
            </div>
          </div>

          <button className="sidebar-logout" onClick={logout}>
            <Icon name="SignOut" size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="crumb">
              BANYAN CRM /{" "}
              {navItems.find((item) => item[0] === active)?.[3] ||
                "All screens"}
            </div>
          </div>

          <div className="top-actions">
            <button className="search">
              <Icon name="MagnifyingGlass" /> Search
            </button>
            <div className="notification-wrap">
              <button
                className="icon-btn"
                onClick={() => setShowNotifications((v) => !v)}
              >
                <Icon name="Bell" />
                {notifications.some((n) => !n.readAt) && (
                  <i className="notification-dot" />
                )}
              </button>
              {showNotifications && (
                <div className="notification-popover">
                  <div className="notification-head">
                    <b>Notifications</b>
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        await request("/notifications/read-all", {
                          method: "PATCH",
                        }).catch(() => {});
                        setNotifications((ns) =>
                          ns.map((n) => ({
                            ...n,
                            readAt: new Date().toISOString(),
                          })),
                        );
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="empty-state">No notifications.</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        className={`notification-item ${n.readAt ? "" : "unread"}`}
                        key={n._id}
                      >
                        <b>{n.title}</b>
                        <span>{n.body || ""}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <span className="avatar">{initials}</span>
          </div>
        </header>

        {children}
      </main>

      {board && <ScreenBoard onClose={() => setBoard(false)} go={go} />}
    </div>
  );
}

function ScreenBoard({ onClose, go }) {
  return (
    <div className="board-overlay">
      <div className="board-head">
        <div>
          <span className="eyebrow">Banyan CRM prototype review</span>
          <h2>All screens</h2>
        </div>
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="board-grid">
        {navItems.map(([key, label, icon, crumb]) => (
          <button
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
