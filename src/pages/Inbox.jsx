import React, { useCallback, useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";
import { listenForGoogleOAuth, openGoogleOAuth } from "../utils/googleOAuth";

function itemArray(response) {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

export default function Inbox() {
  const { request } = useAuth();
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const load = useCallback(async ({ preserveSelection = true } = {}) => {
    try {
      setError("");
      const [inboxResponse, templateResponse, integrationsResponse] = await Promise.all([
        request("/inbox", { query: { limit: 100 } }),
        request("/templates", { query: { limit: 100 } }),
        request("/integrations", { query: { limit: 100 } }),
      ]);
      const nextThreads = itemArray(inboxResponse);
      setThreads(nextThreads);
      setTemplates(itemArray(templateResponse));
      const integrations = itemArray(integrationsResponse);
      setGmailConnected(integrations.some((row) => row.provider === "gmail" && row.status === "connected"));
      if (preserveSelection && selected?._id) {
        const stillExists = nextThreads.some((thread) => thread._id === selected._id);
        if (stillExists) await open(selected._id);
        else if (nextThreads[0]) await open(nextThreads[0]._id);
        else { setSelected(null); setMessages([]); }
      } else if (!selected && nextThreads[0]) {
        await open(nextThreads[0]._id);
      }
    } catch (e) {
      setError(e.message || "Failed to load inbox.");
    }
  }, [request, selected?._id]);

  async function open(id) {
    try {
      const response = await request(`/inbox/${id}`);
      const conversation = response.data?.conversation;
      setSelected(conversation || null);
      setMessages(response.data?.messages || []);
      if (conversation?.unreadCount) {
        await request(`/inbox/${id}/read`, { method: "PATCH" });
        setThreads((items) => items.map((item) => item._id === id ? { ...item, unreadCount: 0 } : item));
      }
    } catch (e) {
      setError(e.message || "Failed to open conversation.");
    }
  }

  useEffect(() => {
    load({ preserveSelection: false });
  }, []);

  useEffect(() => listenForGoogleOAuth((result) => {
    setConnecting(false);
    if (result.success) {
      setNotice(result.message || "Google connected successfully.");
      setError("");
      load();
    } else {
      setError(result.message || "Google connection was not completed.");
    }
  }), [load]);

  async function connectGoogle() {
    setConnecting(true);
    setError("");
    setNotice("");
    try {
      await openGoogleOAuth(request);
    } catch (e) {
      setConnecting(false);
      setError(e.message || "Could not start Google authorization.");
    }
  }

  async function syncGmail() {
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const response = await request("/integrations/google/gmail/sync", {
        method: "POST",
        body: { q: "newer_than:30d", maxResults: 100 },
      });
      const result = response.data || {};
      setNotice(`Gmail sync complete: ${result.synced || 0} new messages imported; ${result.skipped || 0} duplicates skipped.`);
      await load({ preserveSelection: false });
    } catch (e) {
      setError(e.message || "Gmail sync failed. Connect Google first if needed.");
    } finally {
      setSyncing(false);
    }
  }

  async function send() {
    if (!selected || !body.trim()) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      let response;
      if (selected.channel === "email") {
        if (!gmailConnected) throw new Error("Connect Google first to send email from Banyan.");
        response = await request("/integrations/google/gmail/send", {
          method: "POST",
          body: {
            to: selected.participantAddress,
            subject: selected.subject || "Re: (no subject)",
            text: body,
            conversationId: selected._id,
          },
        });
        if (response.data?.message) setMessages((items) => [...items, response.data.message]);
        setNotice("Email sent through Gmail.");
      } else {
        response = await request(`/inbox/${selected._id}/messages`, {
          method: "POST",
          body: { body, templateId: templateId || undefined, attachments: [] },
        });
        setMessages((items) => [...items, response.data]);
      }
      setBody("");
      setTemplateId("");
      await load({ preserveSelection: false });
      if (selected?._id) await open(selected._id);
    } catch (e) {
      setError(e.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function composeSend() {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setError("Recipient, subject, and message are required.");
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await request("/integrations/google/gmail/send", {
        method: "POST",
        body: { to: composeTo.trim(), subject: composeSubject.trim(), text: composeBody },
      });
      const conversationId = response.data?.conversationId || response.data?.conversation?._id;
      setComposeOpen(false);
      setComposeTo(""); setComposeSubject(""); setComposeBody("");
      setNotice("Email sent through Gmail.");
      await load({ preserveSelection: false });
      if (conversationId) await open(conversationId);
    } catch (e) {
      setError(e.message || "Email could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Page
      title="Inbox"
      kicker="Gmail & WhatsApp conversations"
      actions={
        <>
          <Badge tone={gmailConnected ? "" : "warn"}>{gmailConnected ? "Gmail connected" : "Gmail not connected"}</Badge>
          <button className="btn ghost" onClick={connectGoogle} disabled={connecting}>
            {connecting ? "Opening Google…" : gmailConnected ? "Reconnect Google" : "Connect Google"}
          </button>
          <button className="btn ghost" onClick={syncGmail} disabled={syncing || !gmailConnected}>
            {syncing ? "Syncing Gmail…" : "Sync Gmail"}
          </button>
          <button className="btn primary" onClick={() => { setError(""); setComposeOpen(true); }} disabled={!gmailConnected}>
            Compose email
          </button>
        </>
      }
    >
      {error && <div className="notice error"><b>Inbox</b><span>{error}</span></div>}
      {notice && <div className="notice"><b>Google integration</b><span>{notice}</span></div>}
      <div className="contact-grid inbox-grid">
        <section className="panel contact-list">
          {threads.length === 0 ? <Empty text={gmailConnected ? "No conversations yet. Sync Gmail to import recent messages." : "No conversations. Connect Google to import Gmail messages, or continue using existing WhatsApp conversations."} /> : threads.map((thread) => (
            <button key={thread._id} className={`contact-row ${selected?._id === thread._id ? "selected" : ""}`} onClick={() => open(thread._id)}>
              <span className="avatar">{(thread.participantName || thread.channel || "I")[0].toUpperCase()}</span>
              <div>
                <b>{thread.subject || thread.participantName || thread.participantAddress || "Conversation"}</b>
                <span>{thread.channel} · {thread.unreadCount ? `${thread.unreadCount} unread` : thread.status}</span>
              </div>
            </button>
          ))}
        </section>
        <section className="panel contact-detail">
          <div className="profile-head">
            <div>
              <span className="eyebrow">{selected?.channel || "Inbox"}</span>
              <h2>{selected?.subject || selected?.participantName || "Select a conversation"}</h2>
              {selected?.participantAddress && <span className="muted">{selected.participantAddress}</span>}
            </div>
            {selected && <div className="actions">
              <Badge>{selected.status}</Badge>
              <button className="btn ghost" onClick={async () => {
                const contactId = prompt("Contact ID to link", selected.contactId?._id || "");
                if (!contactId) return;
                try {
                  const response = await request(`/inbox/${selected._id}/link`, { method: "PATCH", body: { contactId } });
                  setSelected(response.data);
                } catch (e) { setError(e.message); }
              }}>Link contact</button>
            </div>}
          </div>
          {!selected ? <Empty text="Select a conversation." /> : <>
            <div className="timeline message-thread">
              {messages.map((message) => <p key={message._id || message.metadata?.gmailMessageId}>
                <b>{message.senderName || message.senderAddress || message.direction}</b>
                <span>{message.body}</span>
                <small>{new Date(message.sentAt).toLocaleString()} · {message.status || message.direction}</small>
              </p>)}
            </div>
            <div className="reply-box">
              {selected.channel === "whatsapp" ? <div className="muted">WhatsApp replies continue through the existing inbox endpoint.</div> : null}
              <div className="form-grid">
                <label>Template<select value={templateId} onChange={(e) => {
                  const nextId = e.target.value; setTemplateId(nextId);
                  const template = templates.find((item) => item._id === nextId); if (template) setBody(template.body);
                }}><option value="">No template</option>{templates.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
              </div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={selected.channel === "email" ? "Write an email reply…" : "Write a reply…"} />
              <div className="actions"><button className="btn primary" disabled={sending || (selected.channel === "email" && !gmailConnected)} onClick={send}>{sending ? "Sending…" : selected.channel === "email" ? "Send email" : "Send"}</button></div>
            </div>
          </>}
        </section>
      </div>
      {composeOpen && <Modal title="Compose email" onClose={() => setComposeOpen(false)} actions={<><button className="btn ghost" onClick={() => setComposeOpen(false)}>Cancel</button><button className="btn primary" disabled={sending} onClick={composeSend}>{sending ? "Sending…" : "Send email"}</button></>}>
        <div className="form-grid">
          <label>To<input type="email" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="person@example.com" /></label>
          <label>Subject<input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Email subject" /></label>
          <label className="form-span-2">Message<textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Write your email…" /></label>
        </div>
      </Modal>}
    </Page>
  );
}
