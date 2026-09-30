import React, { useEffect, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";

export default function Inbox() {
  const { request } = useAuth();
  const [threads, setThreads] = useState([]),
    [selected, setSelected] = useState(null),
    [messages, setMessages] = useState([]),
    [templates, setTemplates] = useState([]),
    [templateId, setTemplateId] = useState(""),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [sending, setSending] = useState(false);
  async function load() {
    try {
      const [r, t] = await Promise.all([
        request("/inbox", { query: { limit: 100 } }),
        request("/templates", { query: { limit: 100 } }),
      ]);
      setThreads(r.data || []);
      setTemplates(t.data?.items || []);
      if (!selected && r.data?.[0]) open(r.data[0]._id);
    } catch (e) {
      setError(e.message);
    }
  }
  async function open(id) {
    try {
      const r = await request(`/inbox/${id}`);
      setSelected(r.data.conversation);
      setMessages(r.data.messages || []);
      if (r.data.conversation.unreadCount)
        await request(`/inbox/${id}/read`, { method: "PATCH" });
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function send() {
    if (!selected || !body.trim()) return;
    setSending(true);
    try {
      const r = await request(`/inbox/${selected._id}/messages`, {
        method: "POST",
        body: { body, templateId: templateId || undefined, attachments: [] },
      });
      setMessages((m) => [...m, r.data]);
      setBody("");
      setTemplateId("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }
  return (
    <Page title="Inbox" kicker="Email & WhatsApp conversations">
      <div className="contact-grid inbox-grid">
        {error && (
          <div className="notice error">
            <b>Inbox</b>
            <span>{error}</span>
          </div>
        )}
        <section className="panel contact-list">
          {threads.length === 0 ? (
            <Empty text="No conversations." />
          ) : (
            threads.map((t) => (
              <button
                key={t._id}
                className={`contact-row ${selected?._id === t._id ? "selected" : ""}`}
                onClick={() => open(t._id)}
              >
                <span className="avatar">
                  {(t.participantName || t.channel || "I")[0].toUpperCase()}
                </span>
                <div>
                  <b>
                    {t.subject ||
                      t.participantName ||
                      t.participantAddress ||
                      "Conversation"}
                  </b>
                  <span>
                    {t.channel} ·{" "}
                    {t.unreadCount ? `${t.unreadCount} unread` : t.status}
                  </span>
                </div>
              </button>
            ))
          )}
        </section>
        <section className="panel contact-detail">
          <div className="profile-head">
            <div>
              <span className="eyebrow">{selected?.channel || "Inbox"}</span>
              <h2>
                {selected?.subject ||
                  selected?.participantName ||
                  "Select a conversation"}
              </h2>
            </div>
            {selected && (
              <div className="actions">
                <Badge>{selected.status}</Badge>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    const contactId = prompt(
                      "Contact ID to link",
                      selected.contactId?._id || "",
                    );
                    if (!contactId) return;
                    try {
                      const r = await request(`/inbox/${selected._id}/link`, {
                        method: "PATCH",
                        body: { contactId },
                      });
                      setSelected(r.data);
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Link contact
                </button>
              </div>
            )}
          </div>
          {!selected ? (
            <Empty text="Select a conversation." />
          ) : (
            <>
              <div className="timeline message-thread">
                {messages.map((m) => (
                  <p key={m._id}>
                    <b>{m.senderName || m.senderAddress || m.direction}</b>
                    <span>{m.body}</span>
                    <small>{new Date(m.sentAt).toLocaleString()}</small>
                  </p>
                ))}
              </div>
              <div className="reply-box">
                <div className="form-grid">
                  <label>
                    Template
                    <select
                      value={templateId}
                      onChange={(e) => {
                        setTemplateId(e.target.value);
                        const t = templates.find(
                          (x) => x._id === e.target.value,
                        );
                        if (t) setBody(t.body);
                      }}
                    >
                      <option value="">No template</option>
                      {templates.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a reply…"
                />
                <div className="actions">
                  <button
                    className="btn primary"
                    disabled={sending}
                    onClick={send}
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </Page>
  );
}
