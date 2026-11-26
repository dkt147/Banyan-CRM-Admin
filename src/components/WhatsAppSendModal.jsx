import React, { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { useAuth } from "../auth/AuthContext";

// Send a WhatsApp message from a contact page (27 Nov round, so the team can test WhatsApp
// end to end). WhatsApp rules (Meta): a business can only START a conversation with an
// approved template. Free text is allowed for 24 hours after the customer's last message.
//   GET  /integrations/whatsapp/status   → { configured, templates: [{ name, language, status, body, paramCount }] }
//   POST /integrations/whatsapp/messages → { to, contactId, text }
//                                      or { to, contactId, template: { name, language, params: [] } }
// The server links the message to the contact's WhatsApp conversation, so it shows in the
// contact's WhatsApp tab and the Inbox. Error WHATSAPP_WINDOW_CLOSED = use a template.

const digits = (v) => String(v || "").replace(/\D/g, "");

export default function WhatsAppSendModal({ contact, onClose, onSent }) {
  const { request } = useAuth();
  const [status, setStatus] = useState({ loading: true, data: null, missing: false, error: "" });
  const [mode, setMode] = useState("text");
  const [to, setTo] = useState(contact.whatsapp || contact.phone || "");
  const [text, setText] = useState("");
  const [tpl, setTpl] = useState("");
  const [params, setParams] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    let alive = true;
    request("/integrations/whatsapp/status")
      .then((r) => {
        if (!alive) return;
        setStatus({ loading: false, data: r.data || {}, missing: false, error: "" });
        if ((r.data?.templates || []).some((t) => String(t.status).toUpperCase() === "APPROVED")) setMode("template");
      })
      .catch((e) => alive && setStatus({ loading: false, data: null, missing: e.status === 404, error: e.status === 404 ? "" : e.message }));
    return () => { alive = false; };
  }, [request]);

  const templates = useMemo(() => (status.data?.templates || []).filter((t) => String(t.status).toUpperCase() === "APPROVED"), [status.data]);
  const chosen = templates.find((t) => `${t.name}|${t.language}` === tpl) || null;
  useEffect(() => {
    if (!chosen) { setParams([]); return; }
    const first = contact.firstName || "";
    setParams(Array.from({ length: chosen.paramCount || 0 }, (_, i) => (i === 0 ? first : "")));
  }, [tpl]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = chosen ? String(chosen.body || "").replace(/\{\{(\d+)\}\}/g, (m, n) => params[Number(n) - 1] || m) : "";
  const notConfigured = status.data && status.data.configured === false;

  async function send() {
    setError("");
    const number = digits(to);
    if (number.length < 8 || number.length > 15) { setError("Enter the number in international format, e.g. +852 9123 4567."); return; }
    if (mode === "text" && !text.trim()) { setError("Write a message."); return; }
    if (mode === "template" && !chosen) { setError("Choose a template."); return; }
    if (mode === "template" && params.some((p) => !String(p).trim())) { setError("Fill in every blank in the template."); return; }
    setSending(true);
    try {
      const body = mode === "text"
        ? { to: number, contactId: contact._id, text: text.trim() }
        : { to: number, contactId: contact._id, template: { name: chosen.name, language: chosen.language, params: params.map((p) => String(p).trim()) } };
      await request("/integrations/whatsapp/messages", { method: "POST", body });
      setDone(`Sent to +${number}. It appears in this contact's WhatsApp tab and in the Inbox.`);
      onSent?.();
    } catch (e) {
      const code = e.payload?.code || e.payload?.error?.code;
      if (code === "WHATSAPP_WINDOW_CLOSED") {
        setError("This person hasn't messaged Banyan in the last 24 hours, so WhatsApp only allows a template. Choose one below.");
        if (templates.length) setMode("template");
      } else if (e.status === 503 || code === "INTEGRATION_NOT_CONFIGURED") setError("WhatsApp Business isn't connected on the server yet (Settings → Integrations).");
      else setError(e.message || "The message could not be sent.");
    } finally { setSending(false); }
  }

  return (
    <Modal title={`WhatsApp ${[contact.firstName, contact.lastName].filter(Boolean).join(" ")}`} onClose={onClose}
      actions={done
        ? <button type="button" className="btn primary" onClick={onClose}>Close</button>
        : <>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" onClick={send} disabled={sending || notConfigured}>{sending ? "Sending…" : "Send"}</button>
        </>}>
      {done ? <div className="notice"><b>WhatsApp</b><span>{done}</span></div> : (
        <div className="form-grid wa-send">
          {notConfigured && <div className="notice error"><b>Not connected</b><span>WhatsApp Business isn't set up on the server yet, so nothing can be sent. See Settings → Integrations.</span></div>}
          {status.error && <p className="lk-warn-text">{status.error}</p>}
          <label>To (WhatsApp number)
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+852 9123 4567" inputMode="tel" />
          </label>
          {templates.length > 0 && (
            <div className="rt-filters" role="group" aria-label="Message type">
              <button type="button" className={mode === "template" ? "active" : ""} aria-pressed={mode === "template"} onClick={() => setMode("template")}>Template</button>
              <button type="button" className={mode === "text" ? "active" : ""} aria-pressed={mode === "text"} onClick={() => setMode("text")}>Free text</button>
            </div>
          )}
          {mode === "template" ? (
            <>
              <label>Template
                <select value={tpl} onChange={(e) => setTpl(e.target.value)}>
                  <option value="">Choose…</option>
                  {templates.map((t) => <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</option>)}
                </select>
              </label>
              {params.map((p, i) => (
                <label key={i}>{`Blank {{${i + 1}}}`}
                  <input value={p} onChange={(e) => setParams((list) => list.map((x, j) => (j === i ? e.target.value : x)))} />
                </label>
              ))}
              {chosen && <blockquote className="wa-preview">{preview}</blockquote>}
            </>
          ) : (
            <>
              <label>Message
                <textarea rows={5} maxLength={4096} value={text} onChange={(e) => setText(e.target.value)} />
              </label>
              <p className="lk-muted">Free text only reaches people who messaged Banyan in the last 24 hours. Otherwise use a template{status.missing ? " (template sending needs the latest server update)" : ""}.</p>
            </>
          )}
          {error && <div className="notice error"><b>WhatsApp</b><span>{error}</span></div>}
        </div>
      )}
    </Modal>
  );
}
