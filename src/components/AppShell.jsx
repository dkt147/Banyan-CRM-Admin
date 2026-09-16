import React from "react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "./Icon";
import { navItems } from "../data/mock";

export default function AppShell({ children }) {
  const nav = useNavigate(),
    loc = useLocation();
  const [board, setBoard] = useState(false);
  const active = loc.pathname.split("/")[1] || "dashboard";
  const go = (k) => nav("/" + k);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/banyan-logo.svg" />
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
            <span className="avatar">JL</span>
            <div>
              <b>JoJo Lam</b>
              <small>Community Manager</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <div className="crumb">
              BANYAN CRM /{" "}
              {navItems.find((x) => x[0] === active)?.[3] || "All screens"}
            </div>
          </div>
          <div className="top-actions">
            <button className="search">
              <Icon name="MagnifyingGlass" /> Search
            </button>
            <button className="icon-btn">
              <Icon name="Bell" />
            </button>
            <span className="avatar">JL</span>
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
        {navItems.map(([key, label, , crumb]) => (
          <button
            key={key}
            className="board-card"
            onClick={() => {
              onClose();
              go(key);
            }}
          >
            <div className="mini-icon">
              <Icon name={navItems.find((x) => x[0] === key)?.[2]} />
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
