import React from "react";
export default function Modal({ title, children, onClose, actions }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
