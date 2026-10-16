import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { navItems } from "../data/mock";
import { useAuth } from "../auth/AuthContext";

const SIDEBAR_GROUPS = [
  {
    key: "crm",
    label: "CRM",
    itemKeys: [
      "contacts",
      "pipelines",
      "pipeline",
      "deals",
      "deal",
      "leads",
      "tasks",
    ],
  },
  {
    key: "payments",
    label: "Payments",
    itemKeys: [
      "invoices",
      "payments",
      "memberships",
      "membership-plans",
      "loyalty",
      "subscriptions",
      "transactions",
      "billing",
    ],
  },
  {
    key: "communication",
    label: "Communication",
    itemKeys: [
      "inbox",
      "emails",
      "email",
      "messages",
      "whatsapp",
    ],
  },
  {
    key: "calendar",
    label: "Calendar & Scheduling",
    itemKeys: [
      "calendar",
      "bookings",
      "appointments",
      "events",
    ],
  },
  {
    key: "documents",
    label: "Documents",
    itemKeys: [
      "agreements",
      "documents",
      "templates",
    ],
  },
  {
    key: "catalog",
    label: "Products & Services",
    itemKeys: [
      "products",
      "services",
      "plans",
      "catalog",
    ],
  },
  {
    key: "reports",
    label: "Reports & Analytics",
    itemKeys: [
      "reports",
      "analytics",
    ],
  },
  {
    key: "settings",
    label: "Settings & Integrations",
    itemKeys: [
      "integrations",
      "settings",
      "users",
      "roles",
      "team",
    ],
  },
];

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildSidebarNavigation(items) {
  const dashboardItem = items.find(
    ([key]) => normalizeKey(key) === "dashboard"
  );

  const claimedKeys = new Set();

  if (dashboardItem) {
    claimedKeys.add(normalizeKey(dashboardItem[0]));
  }

  const groups = SIDEBAR_GROUPS.map((group) => {
    const allowedKeys = new Set(
      group.itemKeys.map(normalizeKey)
    );

    const children = items.filter(([key]) => {
      const normalized = normalizeKey(key);

      if (
        claimedKeys.has(normalized) ||
        !allowedKeys.has(normalized)
      ) {
        return false;
      }

      claimedKeys.add(normalized);
      return true;
    });

    return {
      ...group,
      children,
    };
  }).filter((group) => group.children.length > 0);

  const remainingItems = items.filter(
    ([key]) => !claimedKeys.has(normalizeKey(key))
  );

  if (remainingItems.length > 0) {
    groups.push({
      key: "other",
      label: "Other",
      children: remainingItems,
    });
  }

  return {
    dashboardItem,
    groups,
  };
}

const sidebarNavigation = buildSidebarNavigation(navItems);

export default function AppShell({ children }) {
  const nav = useNavigate();
  const loc = useLocation();

  const { user, logout, request } = useAuth();

  const [board, setBoard] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  const active = loc.pathname.split("/")[1] || "dashboard";

  const go = (key) => nav("/" + key);

  const activeGroup = sidebarNavigation.groups.find((group) =>
    group.children.some(([key]) => key === active)
  );

  React.useEffect(() => {
    if (!activeGroup) return;

    setExpandedGroups((previous) => ({
      ...previous,
      [activeGroup.key]: true,
    }));
  }, [active, activeGroup]);

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

  const displayName = user?.name || "Banyan User";

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "BU";

  function toggleGroup(groupKey) {
    setExpandedGroups((previous) => ({
      ...previous,
      [groupKey]: !previous[groupKey],
    }));
  }

  function renderNavigationItem(item, isChild = false) {
    const [key, label, icon] = item;

    return (
      <button
        key={key}
        type="button"
        className={[
          isChild ? "nav-child" : "nav-standalone",
          active === key ? "active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => go(key)}
        title={label}
      >
        <Icon name={icon} />
        <span>{label}</span>
      </button>
    );
  }

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

        <nav className="sidebar-navigation">
          {sidebarNavigation.dashboardItem &&
            renderNavigationItem(
              sidebarNavigation.dashboardItem
            )}

          {sidebarNavigation.groups.map((group) => {
            const expanded = Boolean(
              expandedGroups[group.key]
            );

            const hasActiveChild = group.children.some(
              ([key]) => key === active
            );

            const parentIcon =
              group.children[0]?.[2];

            return (
              <div
                className="nav-group"
                key={group.key}
              >
                <button
                  type="button"
                  className={[
                    "nav-parent",
                    expanded ? "expanded" : "",
                    hasActiveChild ? "has-active-child" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={expanded}
                  aria-controls={`nav-submenu-${group.key}`}
                >
                  <span className="nav-parent-label">
                    {parentIcon && (
                      <Icon name={parentIcon} />
                    )}

                    <span>{group.label}</span>
                  </span>

                  <span
                    className={[
                      "nav-chevron",
                      expanded ? "expanded" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>

                {expanded && (
                  <div
                    className="nav-submenu"
                    id={`nav-submenu-${group.key}`}
                  >
                    {group.children.map((item) =>
                      renderNavigationItem(item, true)
                    )}
                  </div>
                )}
              </div>
            );
          })}
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

          <div className="user-mini">
            <span className="avatar">{initials}</span>

            <div>
              <b>{displayName}</b>
              <small>
                {user?.jobTitle || user?.role || "CRM user"}
              </small>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-logout"
            onClick={logout}
          >
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
              {navItems.find(
                (item) => item[0] === active
              )?.[3] || "All screens"}
            </div>
          </div>

          <div className="top-actions">
            <div className="notification-wrap">
              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  setShowNotifications((value) => !value)
                }
                aria-label="Toggle notifications"
                aria-expanded={showNotifications}
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
                      type="button"
                      className="btn ghost"
                      onClick={async () => {
                        await request(
                          "/notifications/read-all",
                          { method: "PATCH" }
                        ).catch(() => {});

                        setNotifications((current) =>
                          current.map((notification) => ({
                            ...notification,
                            readAt: new Date().toISOString(),
                          }))
                        );
                      }}
                    >
                      Mark all read
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="empty-state">
                      No notifications.
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        className={[
                          "notification-item",
                          notification.readAt ? "" : "unread",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={notification._id}
                      >
                        <b>{notification.title}</b>
                        <span>
                          {notification.body || ""}
                        </span>
                      </div>
                    ))
                  )}
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
                  <button
                    type="button"
                    className="profile-menu-action"
                    onClick={() => {
                      setShowProfile(false);
                      nav("/workspace");
                    }}
                  >
                    Workspace settings
                  </button>
                  <button
                    type="button"
                    className="profile-menu-action"
                    onClick={() => {
                      setShowProfile(false);
                      logout();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {children}
      </main>

      {board && (
        <ScreenBoard
          onClose={() => setBoard(false)}
          go={go}
        />
      )}
    </div>
  );
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