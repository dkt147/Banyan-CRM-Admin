import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { useAuth } from "../auth/AuthContext";

const SUGGESTIONS = [
  "Which deals have been quiet for more than 5 days?",
  "What tasks are overdue?",
  "Which invoices are overdue or unpaid?",
  "Show the open pipeline value by stage.",
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function messageForError(error) {
  if (error?.payload?.code === "AI_NOT_CONFIGURED" || /not configured yet/i.test(error?.message || "")) {
    return "Banyan Assist is not configured yet. Add GROQ_API_KEY to the backend environment and restart the backend.";
  }
  if (error?.status === 429) {
    return "The assistant has reached a request limit. Please wait a little and try again.";
  }
  if (error?.status === 504) return "The answer took too long. Try asking a shorter question.";
  if (error?.status === 401) return "Your session has expired. Sign in again and retry.";
  return error?.message || "Banyan Assist could not answer right now. Please try again.";
}

export default function AssistantPanel({ open, onClose, initialPrompt = "", autoSubmitToken = 0 }) {
  const { request } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const [assistantStatus, setAssistantStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const busyRef = useRef(false);
  const lastAutoSubmitToken = useRef(0);

  const sendQuestion = useCallback(async (value) => {
    const question = String(value || "").trim();
    if (!question || busyRef.current) return;

    busyRef.current = true;
    setIsThinking(true);
    setError("");
    setDraft("");

    const userMessage = { id: makeId(), role: "user", content: question };
    const previousHistory = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await request("/assistant/chat", {
        method: "POST",
        body: { message: question, history: previousHistory },
      });
      const data = response?.data || {};
      if (!data.answer) throw new Error("The assistant returned an empty answer.");
      setMessages((current) => [...current, {
        id: makeId(),
        role: "assistant",
        content: data.answer,
        sources: Array.isArray(data.sources) ? data.sources.slice(0, 5) : [],
        model: data.model || "Groq",
        context: data.context || null,
      }]);
    } catch (requestError) {
      setError(messageForError(requestError));
    } finally {
      busyRef.current = false;
      setIsThinking(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [messages, request]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
    if (assistantStatus === null && !statusLoading) {
      setStatusLoading(true);
      request("/assistant/status")
        .then((response) => setAssistantStatus(response?.data || { configured: false }))
        .catch(() => setAssistantStatus({ configured: false, unavailable: true }))
        .finally(() => setStatusLoading(false));
    }
  }, [open, assistantStatus, statusLoading, request]);

  useEffect(() => {
    if (!open || !autoSubmitToken || lastAutoSubmitToken.current === autoSubmitToken) return;
    lastAutoSubmitToken.current = autoSubmitToken;
    const question = String(initialPrompt || "").trim();
    if (question) void sendQuestion(question);
  }, [open, autoSubmitToken, initialPrompt, sendQuestion]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isThinking, error]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !isThinking) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, isThinking]);

  const submit = (event) => {
    event.preventDefault();
    void sendQuestion(draft);
  };

  if (!open) return null;

  return (
    <div
      className="assistant-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && !isThinking && onClose()}
    >
      <section className="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="banyan-assistant-title">
        <header className="assistant-panel-head">
          <div className="assistant-brand-mark"><Icon name="Sparkle" size={20} /></div>
          <div className="assistant-panel-title">
            <h2 id="banyan-assistant-title">Ask Banyan</h2>
            <p>{statusLoading ? "Checking AI connection…" : assistantStatus?.unavailable ? "Connection unavailable · Check backend" : assistantStatus?.configured ? `Groq · ${assistantStatus.model || "Live workspace data"}` : "Setup required · Configure Groq API key"}</p>
          </div>
          <button type="button" className="assistant-close" onClick={() => !isThinking && onClose()} aria-label="Close assistant" disabled={isThinking}>
            <Icon name="X" size={18} />
          </button>
        </header>

        <div className="assistant-trust-note">
          <Icon name="Database" size={15} />
Selected workspace records are sent to Groq to prepare answers. Read-only: the assistant cannot change CRM records.
        </div>

        <div className="assistant-chat-scroll" ref={scrollRef} aria-live="polite">
          {messages.length === 0 ? (
            <div className="assistant-welcome">
              <span className="assistant-welcome-icon"><Icon name="Sparkle" size={24} /></span>
              <h3>What would you like to know?</h3>
              <p>Ask about deals, pipeline value, tasks, invoices, renewals, bookings or connected services.</p>
              <div className="assistant-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => void sendQuestion(suggestion)} disabled={isThinking}>
                    <span>{suggestion}</span><Icon name="ArrowUpRight" size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="assistant-message-list">
              {messages.map((message) => (
                <article key={message.id} className={`assistant-message assistant-message-${message.role}`}>
                  <div className="assistant-message-avatar">
                    <Icon name={message.role === "assistant" ? "Sparkle" : "UserCircle"} size={17} />
                  </div>
                  <div className="assistant-message-content">
                    <div className="assistant-message-role">{message.role === "assistant" ? "Banyan Assist" : "You"}</div>
                    <div className="assistant-message-text">{message.content}</div>
                    {message.sources?.length > 0 && (
                      <div className="assistant-source-list">
                        <span>Based on</span>
                        {message.sources.map((source) => <span key={source} className="assistant-source-chip">{source}</span>)}
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {isThinking && (
                <div className="assistant-thinking" role="status">
                  <span className="assistant-thinking-dots"><i /><i /><i /></span>
                  <span>Checking workspace data and preparing an answer…</span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="assistant-error" role="alert">
            <Icon name="WarningCircle" size={17} />
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>Dismiss</button>
          </div>
        )}

        <form className="assistant-composer" onSubmit={submit}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
            placeholder="Ask about Banyan's deals, tasks, invoices…"
            aria-label="Ask Banyan Assist a question"
            maxLength={2000}
            rows={2}
            disabled={isThinking}
          />
          <div className="assistant-composer-footer">
            <span>Workspace data · Read only</span>
            <button type="submit" className="assistant-send-button" disabled={isThinking || !draft.trim()} aria-label="Send question">
              <Icon name="PaperPlaneTilt" size={17} />
              <span>{isThinking ? "Thinking" : "Ask"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
