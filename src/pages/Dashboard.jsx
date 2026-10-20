import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { useAuth } from "../auth/AuthContext";
import { longDate } from "../utils/dates";

const TAB_OPTIONS = ["Overview", "Occupancy", "Revenue", "Sources"];
const SOURCE_COLORS = ["#243b2a", "#4a6954", "#a9633e", "#9da99c", "#858080"];
const REVENUE_COLORS = {
  Memberships: "#243b2a",
  "Venue & studio": "#9a5b34",
  "Meeting rooms": "#4a6b52",
  "Day passes": "#8aa190",
  "Other services": "#9b9797",
};
const PIPELINE_RAMPS = {
  green: ["#243b2a", "#4a6b52", "#8aa190", "#b9c8bb", "#dbe4dc"],
  orange: ["#9a5b34", "#b98159", "#d2a988", "#e6cfbd"],
  gray: ["#605d5d", "#9b9797", "#d7d3d3"],
};
const PIPELINE_TONE_BY_KEY = { "venue-hire": "orange", transactional: "gray" };

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) =>
    parseInt(value.slice(offset, offset + 2), 16),
  );
}

function mixHex(from, to, amount) {
  const [a, b] = [hexToRgb(from), hexToRgb(to)];
  return `#${a
    .map((channel, index) =>
      Math.round(channel + (b[index] - channel) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// Exact reference colours when the stage count matches the ramp; smooth interpolation otherwise.
function rampColor(ramp, index, total) {
  if (total <= 1) return ramp[0];
  if (total === ramp.length) return ramp[index];
  const position = (index / (total - 1)) * (ramp.length - 1);
  const low = Math.floor(position);
  const high = Math.min(ramp.length - 1, low + 1);
  return mixHex(ramp[low], ramp[high], position - low);
}

// Segment width follows the money in each stage (falls back to deal count when values are all zero).
function segmentWeights(stages) {
  const totalValue = stages.reduce(
    (sum, stage) => sum + Number(stage.value || 0),
    0,
  );
  if (totalValue <= 0) return stages.map((stage) => Number(stage.count || 0));
  return stages.map((stage) =>
    Number(stage.value || 0) > 0 ? Number(stage.value) : totalValue * 0.04,
  );
}

function unwrapList(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
}

function formatCurrency(value, compact = false, currency = "HKD") {
  const amount = Number(value || 0);
  if (compact && Math.abs(amount) >= 1000) {
    const compactNumber =
      amount >= 1_000_000
        ? `${(amount / 1_000_000).toLocaleString("en-HK", { maximumFractionDigits: 2 })}m`
        : `${Math.round(amount / 1000).toLocaleString("en-HK")}k`;
    return `${currency === "HKD" ? "HK$" : `${currency} `}${compactNumber}`;
  }
  return `${currency === "HKD" ? "HK$" : `${currency} `}${amount.toLocaleString("en-HK", { maximumFractionDigits: 0 })}`;
}

function formatTime(value, timezone) {
  if (!value) return "Anytime";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Anytime";
  return new Intl.DateTimeFormat("en-HK", {
    timeZone: timezone || "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatShortDate(value, timezone) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-HK", {
    timeZone: timezone || "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
  }).format(date);
}

function hasClockTime(value, timezone) {
  const label = formatTime(value, timezone);
  return label !== "Anytime" && label !== "00:00" && label !== "24:00";
}

function queueSubtitle(task, timezone, currency) {
  const parts = [];
  if (task.overdueDays > 0) {
    parts.push(
      task.dealProductType
        ? productTypeLabel(task.dealProductType)
        : task.companyName || task.dealTitle || task.contactName,
    );
    if (task.dealValue > 0) parts.push(currency(task.dealValue));
    parts.push(
      `overdue ${task.overdueDays} day${task.overdueDays === 1 ? "" : "s"}`,
    );
  } else {
    if (hasClockTime(task.dueAt, timezone)) {
      const time = formatTime(task.dueAt, timezone);
      parts.push(task.source === "automation" ? `Due ${time}` : time);
    }
    parts.push(
      task.description ||
        task.dealTitle ||
        task.contactName ||
        task.companyName,
    );
  }
  return (
    parts.filter(Boolean).join(" · ") || `${task.priority || "medium"} priority`
  );
}

function weekNumber(value) {
  const date = new Date(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
  );
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function shortStage(name = "") {
  return name
    .replace("Template Sent", "Template")
    .replace("Trial Day Booked", "Trial")
    .replace("Trial Completed", "Trial done")
    .replace("Viewing Scheduled", "Viewing")
    .replace("Viewing Completed", "Viewed")
    .replace("Quote Sent", "Quote")
    .replace("Agreement Signed", "Agreement")
    .replace("Deposit Collected", "Deposit")
    .replace("Deposit Invoice Sent", "Deposit invoice")
    .replace("Deposit Received", "Deposit")
    .replace("Booking Received", "Received")
    .replace("Transactional / Self-Serve", "Transactional")
    .replace("Move-In", "Move-in");
}

function productTypeLabel(value = "") {
  const labels = {
    membership: "Membership",
    private_office: "Private office",
    venue_hire: "Venue hire",
    meeting_room: "Meeting room",
    day_pass: "Day pass",
  };
  return (
    labels[value] ||
    value.replace(/[_-]+/g, " ").replace(/^\w/, (char) => char.toUpperCase())
  );
}

function displayPipelineName(name = "") {
  if (/^membership pipeline$/i.test(name)) return "Membership";
  if (/^private office pipeline$/i.test(name)) return "Private office";
  if (/^venue hire pipeline$/i.test(name)) return "Venue hire & studio";
  if (/transactional/i.test(name)) return "Transactional";
  return name;
}

function Panel({ title, note, children, className = "", onClick }) {
  return (
    <section
      className={`panel dashboard-panel ${className}`.trim()}
      onClick={onClick}
    >
      {(title || note) && (
        <div className="dashboard-panel-head">
          <h2>{title}</h2>
          {note && <span>{note}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

function DashboardEmpty({ children = "Nothing to show yet." }) {
  return <div className="dashboard-empty">{children}</div>;
}

export function Page({ title, kicker, actions, children, className = "" }) {
  return (
    <div className={`page ${className}`.trim()}>
      <div className="page-head">
        <div>
          <span className="eyebrow">{kicker}</span>
          <h1>{title}</h1>
        </div>
        <div className="actions">{actions}</div>
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ title, note }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {note && <span>{note}</span>}
    </div>
  );
}

export function Empty({ text }) {
  return <div className="empty-state">{text}</div>;
}

export default function Dashboard() {
  const { user, request } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");
  const [insightOpen, setInsightOpen] = useState(false);
  const [dismissedInsight, setDismissedInsight] = useState(() => {
    try {
      return sessionStorage.getItem("banyan:dismissed-insight") || "";
    } catch {
      return "";
    }
  });
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftCopied, setDraftCopied] = useState(false);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [newDealLoading, setNewDealLoading] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [dealError, setDealError] = useState("");
  const [dealForm, setDealForm] = useState({
    title: "",
    contactId: "",
    pipelineId: "",
    stageId: "",
    value: "",
    productType: "membership",
    source: "website",
    expectedCloseDate: "",
  });
  const firstName =
    dashboard?.greetingName || user?.name?.split(/\s+/)[0] || "there";

  const loadDashboard = useCallback(
    async (quiet = false) => {
      quiet ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const response = await request("/dashboard/complete");
        setDashboard(response?.data || null);
      } catch (e) {
        setError(e.message || "Could not load the dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => loadDashboard(true), 60000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const insightKey = String(dashboard?.insight?.dealId || "");
  const showInsight =
    Boolean(dashboard?.insight) &&
    !(insightKey && dismissedInsight === insightKey);
  const dismissInsight = () => {
    setDismissedInsight(insightKey);
    try {
      sessionStorage.setItem("banyan:dismissed-insight", insightKey);
    } catch {}
  };
  const openDraft = () => {
    setDraftError("");
    setDraftCopied(false);
    setDraftText(dashboard?.insight?.draftNote || "");
    setDraftOpen(true);
  };
  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setDraftCopied(true);
    } catch {
      setDraftError("Could not copy. Select the text and copy it manually.");
    }
  };
  const logDraft = async () => {
    if (!draftText.trim()) {
      setDraftError("Write a note first.");
      return;
    }
    try {
      setDraftSaving(true);
      setDraftError("");
      await request("/activities", {
        method: "POST",
        body: {
          type: "note",
          subject: `Follow-up: ${dashboard?.insight?.dealTitle || "deal"}`,
          body: draftText.trim(),
          dealId: dashboard?.insight?.dealId || null,
          contactId: dashboard?.insight?.contactId || null,
        },
      });
      setDraftOpen(false);
      await loadDashboard(true);
    } catch (e) {
      setDraftError(e.message || "Note could not be saved.");
    } finally {
      setDraftSaving(false);
    }
  };

  useEffect(() => {
    const openNewDeal = () => {
      setDealError("");
      setNewDealOpen(true);
    };
    const openInsight = () => setInsightOpen(true);
    window.addEventListener("banyan:dashboard-new-deal", openNewDeal);
    window.addEventListener("banyan:dashboard-open-insight", openInsight);
    return () => {
      window.removeEventListener("banyan:dashboard-new-deal", openNewDeal);
      window.removeEventListener("banyan:dashboard-open-insight", openInsight);
    };
  }, []);

  useEffect(() => {
    if (!newDealOpen) return;
    let alive = true;
    setNewDealLoading(true);
    setDealError("");
    Promise.all([
      request("/contacts", {
        query: { page: 1, limit: 100, isArchived: false },
      }),
      request("/pipelines", { query: { limit: 100 } }),
    ])
      .then(async ([contactResponse, pipelineResponse]) => {
        if (!alive) return;
        const contactRows = unwrapList(contactResponse);
        const pipelineRows = unwrapList(pipelineResponse);
        setContacts(contactRows);
        setPipelines(pipelineRows);
        const selectedPipeline =
          pipelineRows.find((item) => item.key === "membership") ||
          pipelineRows[0];
        if (selectedPipeline) {
          setDealForm((current) => ({
            ...current,
            pipelineId: selectedPipeline._id,
            contactId: current.contactId || contactRows[0]?._id || "",
          }));
          const stageResponse = await request(
            `/pipelines/${selectedPipeline._id}/stages`,
          );
          if (alive) {
            const stageRows = unwrapList(stageResponse);
            setStages(stageRows);
            setDealForm((current) => ({
              ...current,
              stageId: stageRows[0]?._id || "",
            }));
          }
        }
      })
      .catch(
        (e) =>
          alive && setDealError(e.message || "Could not load deal options."),
      )
      .finally(() => alive && setNewDealLoading(false));
    return () => {
      alive = false;
    };
  }, [newDealOpen, request]);

  const onPipelineChange = async (pipelineId) => {
    setDealForm((current) => ({ ...current, pipelineId, stageId: "" }));
    try {
      const response = await request(`/pipelines/${pipelineId}/stages`);
      const rows = unwrapList(response);
      setStages(rows);
      setDealForm((current) => ({ ...current, stageId: rows[0]?._id || "" }));
    } catch (e) {
      setStages([]);
      setDealError(e.message || "Could not load stages.");
    }
  };

  const createDeal = async (event) => {
    event.preventDefault();
    setDealError("");
    if (
      !dealForm.title.trim() ||
      !dealForm.contactId ||
      !dealForm.pipelineId ||
      !dealForm.stageId
    ) {
      setDealError("Enter a title and select a contact, pipeline and stage.");
      return;
    }
    const numericValue = dealForm.value === "" ? 0 : Number(dealForm.value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setDealError("Deal value must be a valid non-negative number.");
      return;
    }
    try {
      setSavingDeal(true);
      const body = {
        title: dealForm.title.trim(),
        contactId: dealForm.contactId,
        pipelineId: dealForm.pipelineId,
        stageId: dealForm.stageId,
        value: numericValue,
        productType: dealForm.productType,
        source: dealForm.source,
      };
      if (dealForm.expectedCloseDate)
        body.expectedCloseDate = new Date(
          `${dealForm.expectedCloseDate}T12:00:00`,
        ).toISOString();
      await request("/deals", { method: "POST", body });
      setNewDealOpen(false);
      setDealForm((current) => ({
        ...current,
        title: "",
        value: "",
        expectedCloseDate: "",
      }));
      await loadDashboard(true);
    } catch (e) {
      setDealError(e.message || "Deal could not be created.");
    } finally {
      setSavingDeal(false);
    }
  };

  const asOf = dashboard?.asOf ? new Date(dashboard.asOf) : new Date();
  const timezone = dashboard?.timezone || "Asia/Hong_Kong";
  const dateLabel = longDate(asOf, timezone);
  const dateKicker = `${dateLabel.toUpperCase()} · WEEK ${weekNumber(asOf)}`;
  const currency = useCallback(
    (n, compact = false) =>
      formatCurrency(n, compact, dashboard?.currency || "HKD"),
    [dashboard?.currency],
  );
  const pipelineTotal = dashboard?.overview?.openPipeline?.value || 0;
  const renewalData = dashboard?.overview?.renewals || {
    count: 0,
    recurringValue: 0,
  };
  const actionData = dashboard?.overview?.needsAction || {
    total: 0,
    overdueTasks: 0,
    unpaidInvoices: 0,
    quietDeals: 0,
  };
  const inboxItems = dashboard?.inbox || [];
  const sourceItems = dashboard?.leadSources || [];
  const revenueTotal = Math.max(
    1,
    Number(dashboard?.revenueMixTotal || 0) ||
      (dashboard?.revenueMix || []).reduce(
        (sum, item) => sum + Number(item.revenue || 0),
        0,
      ),
  );
  const maxRevenue = revenueTotal;
  const pipelineChange = dashboard?.overview?.openPipeline?.changePercent;

  const modalClose = () => {
    if (savingDeal) return;
    setNewDealOpen(false);
    setDealError("");
  };

  const focusPipeline = useMemo(
    () =>
      (dashboard?.pipelines || []).map((pipeline) => ({
        ...pipeline,
        displayName: displayPipelineName(pipeline.name),
        tone:
          PIPELINE_TONE_BY_KEY[pipeline.key] ||
          (/venue/i.test(pipeline.name)
            ? "orange"
            : /transactional/i.test(pipeline.name)
              ? "gray"
              : "green"),
        stages: [...(pipeline.stages || [])].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ),
      })),
    [dashboard],
  );

  return (
    <div className="page dashboard-page">
      <div className="dashboard-heading">
        <div className="dashboard-greeting">
          <span className="eyebrow">{dateKicker}</span>
          <h1>Good morning, {firstName}</h1>
        </div>
        <nav className="dashboard-tabs" aria-label="Dashboard sections">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="notice error dashboard-notice">
          <b>Dashboard data unavailable</b>
          <span>{error}</span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => loadDashboard(true)}
          >
            Retry
          </button>
        </div>
      )}

      <div className="dashboard-metrics">
        <button
          type="button"
          className="dashboard-metric"
          onClick={() => navigate("/pipelines")}
        >
          <span className="dashboard-metric-label">Open pipeline</span>
          <strong>{currency(pipelineTotal)}</strong>
          <small>
            {pipelineChange == null ? null : (
              <>
                <span
                  className={`dashboard-trend ${pipelineChange < 0 ? "down" : "up"}`}
                >
                  {pipelineChange < 0 ? "▼" : "▲"}
                </span>{" "}
                {Math.abs(pipelineChange)}% vs last month ·{" "}
              </>
            )}
            {dashboard?.overview?.openPipeline?.count ?? 0} deals
          </small>
        </button>
        <button
          type="button"
          className="dashboard-metric"
          onClick={() => setActiveTab("Occupancy")}
        >
          <span className="dashboard-metric-label">Occupancy</span>
          <strong>
            {dashboard?.overview?.occupancy?.percent == null
              ? "—"
              : `${dashboard.overview.occupancy.percent}%`}
          </strong>
          <div className="occupancy-bar">
            <span
              style={{
                width: `${dashboard?.overview?.occupancy?.percent ?? 0}%`,
              }}
            />
          </div>
          {dashboard?.overview?.occupancy?.configured ? (
            <small>
              {dashboard.overview.occupancy.desks.occupied}/
              {dashboard.overview.occupancy.desks.capacity} desks ·{" "}
              {dashboard.overview.occupancy.offices.occupied}/
              {dashboard.overview.occupancy.offices.capacity} offices
            </small>
          ) : (
            <small>Configure desk and office capacity</small>
          )}
        </button>
        <button
          type="button"
          className="dashboard-metric"
          onClick={() => setActiveTab("Occupancy")}
        >
          <span className="dashboard-metric-label">Renewals · 60 days</span>
          <strong>{renewalData.count}</strong>
          <small>
            {currency(renewalData.recurringValue)} recurring at stake
          </small>
        </button>
        <button
          type="button"
          className="dashboard-metric warning"
          onClick={() => setInsightOpen(true)}
        >
          <span className="dashboard-metric-label">Needs action</span>
          <strong>{actionData.total}</strong>
          <small>
            {actionData.overdueTasks} overdue · {actionData.unpaidInvoices}{" "}
            unpaid invoices
          </small>
        </button>
      </div>

      {activeTab === "Overview" && (
        <>
          <div className="dashboard-section-heading">
            <h2>Pipeline value by stage</h2>
            <span>Four motions running in parallel</span>
          </div>
          <div className="dashboard-pipeline-grid">
            {focusPipeline.map((pipeline) => {
              return (
                <section
                  className={`panel pipeline-summary-card pipeline-tone-${pipeline.tone}`}
                  key={pipeline.pipelineId}
                >
                  <div className="pipeline-summary-head">
                    <h3>
                      {pipeline.displayName}
                      {pipeline.key === "transactional" && <em> automated</em>}
                    </h3>
                    <span>
                      {currency(pipeline.value)} · {pipeline.count}
                    </span>
                  </div>
                  {pipeline.stages.length ? (
                    <>
                      <div
                        className="pipeline-segments"
                        aria-label={`${pipeline.displayName} stage values`}
                      >
                        {(() => {
                          const visible = pipeline.stages.filter(
                            (stage) => stage.count > 0,
                          );
                          const weights = segmentWeights(visible);
                          const ramp =
                            PIPELINE_RAMPS[pipeline.tone] ||
                            PIPELINE_RAMPS.green;
                          return visible.map((stage, index) => (
                            <button
                              type="button"
                              key={stage.stageId}
                              title={`${stage.name}: ${stage.count} deals · ${currency(stage.value)}`}
                              aria-label={`${stage.name}: ${stage.count} deals`}
                              style={{
                                flexGrow: Math.max(weights[index], 0.0001),
                                backgroundColor: rampColor(
                                  ramp,
                                  index,
                                  visible.length,
                                ),
                              }}
                              onClick={() =>
                                navigate(
                                  `/pipelines?pipelineId=${pipeline.pipelineId}&stageId=${stage.stageId}`,
                                )
                              }
                            />
                          ));
                        })()}
                      </div>
                      <div className="pipeline-stage-labels">
                        {pipeline.stages
                          .filter((stage) => stage.count > 0)
                          .map((stage) => (
                            <span key={stage.stageId}>
                              <b>{shortStage(stage.name)}</b> {stage.count}
                            </span>
                          ))}
                        {!pipeline.stages.some((stage) => stage.count > 0) && (
                          <span>No open deals</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <DashboardEmpty>
                      No stages configured for this pipeline.
                    </DashboardEmpty>
                  )}
                </section>
              );
            })}
            {focusPipeline.length === 0 && !loading && (
              <Panel title="Pipeline value by stage">
                <DashboardEmpty>
                  No pipelines found. Run the pipeline seed first.
                </DashboardEmpty>
              </Panel>
            )}
          </div>

          <div className="dashboard-lower-grid">
            <Panel
              title="Today's queue"
              note={
                <span className="dashboard-note-link">{`All ${actionData.total} →`}</span>
              }
              className="dashboard-queue-panel"
              onClick={() => navigate("/tasks")}
            >
              {(dashboard?.todayQueue || []).length === 0 ? (
                <DashboardEmpty>No tasks are due today.</DashboardEmpty>
              ) : (
                <div className="dashboard-queue-list">
                  {dashboard.todayQueue.map((task, index) => (
                    <button
                      type="button"
                      className="dashboard-queue-item"
                      key={task._id}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate("/tasks");
                      }}
                    >
                      <span
                        className={`queue-dot ${task.priority === "high" || task.priority === "urgent" ? "urgent" : index < 2 ? "warm" : ""}`}
                      />
                      <span className="dashboard-queue-copy">
                        <b>{task.title}</b>
                        <small>{queueSubtitle(task, timezone, currency)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Inbox"
              note={
                <span className="dashboard-inbox-filters">
                  <b>{`All ${dashboard?.inboxSummary?.total ?? inboxItems.length}`}</b>
                  <span>{`Email ${dashboard?.inboxSummary?.email ?? inboxItems.filter((item) => item.channel === "email").length}`}</span>
                  <span>{`WhatsApp ${dashboard?.inboxSummary?.whatsapp ?? inboxItems.filter((item) => item.channel === "whatsapp").length}`}</span>
                </span>
              }
              className="dashboard-inbox-panel"
              onClick={() => navigate("/inbox")}
            >
              {inboxItems.length === 0 ? (
                <DashboardEmpty>No open conversations.</DashboardEmpty>
              ) : (
                <div className="dashboard-inbox-list">
                  {inboxItems.map((item) => (
                    <button
                      type="button"
                      className="dashboard-inbox-item"
                      key={item._id}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate("/inbox");
                      }}
                    >
                      <span
                        className={`inbox-channel ${item.channel === "whatsapp" ? "wa" : "email"}`}
                      >
                        {item.channel === "whatsapp" ? "WA" : "EM"}
                      </span>
                      <span className="dashboard-inbox-copy">
                        <b>
                          {item.participantName ||
                            item.subject ||
                            "Conversation"}
                        </b>
                        <small>
                          {item.preview || item.subject || "Open conversation"}
                        </small>
                        {item.aiSummarised && (
                          <em className="dashboard-inbox-ai">
                            AI summarised · {item.messageCount} messages
                          </em>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Panel>

            <div className="dashboard-right-stack">
              {showInsight && (
                <Panel
                  className="dashboard-ai-panel"
                  title={
                    <>
                      <Icon name="Sparkle" size={16} /> Banyan AI
                    </>
                  }
                  note="ASSIST"
                >
                  <p>
                    {(() => {
                      const message =
                        dashboard?.insight?.message ||
                        "Dashboard insights will appear here when workspace activity is available.";
                      const highlight = dashboard?.insight?.highlight;
                      return highlight && message.startsWith(highlight) ? (
                        <>
                          <b>{highlight}</b>
                          {message.slice(highlight.length)}
                        </>
                      ) : (
                        message
                      );
                    })()}
                  </p>
                  {dashboard?.insight?.dealId && (
                    <div className="dashboard-ai-actions">
                      <button
                        className="btn primary"
                        type="button"
                        onClick={openDraft}
                      >
                        Draft note
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={dismissInsight}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </Panel>
              )}
              <Panel
                title={`Revenue mix · ${dashboard?.revenueMixMonth || "last month"}`}
              >
                <div className="dashboard-revenue-list">
                  {(dashboard?.revenueMix || []).filter(
                    (item) => item.revenue > 0,
                  ).length ? (
                    [...dashboard.revenueMix]
                      .filter((item) => item.revenue > 0)
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((item) => (
                        <div
                          className="dashboard-revenue-row"
                          key={item.category}
                        >
                          <div>
                            <span>{item.category}</span>
                            <b>{currency(item.revenue, true)}</b>
                          </div>
                          <div className="dashboard-revenue-track">
                            <span
                              style={{
                                width: `${Math.max(2, (item.revenue / revenueTotal) * 100)}%`,
                                background:
                                  REVENUE_COLORS[item.category] || "#243b2a",
                              }}
                            />
                          </div>
                        </div>
                      ))
                  ) : (
                    <DashboardEmpty>
                      No paid invoices for the previous month.
                    </DashboardEmpty>
                  )}
                </div>
              </Panel>
              <Panel title="Lead source performance">
                {sourceItems.length ? (
                  <div className="dashboard-source-grid">
                    {sourceItems
                      .filter((source) => source.count > 0)
                      .slice(0, 4)
                      .map((item, index) => (
                        <button
                          type="button"
                          key={item.source}
                          onClick={() => setActiveTab("Sources")}
                        >
                          <strong>{item.percentage}%</strong>
                          <span>{item.source}</span>
                        </button>
                      ))}
                  </div>
                ) : (
                  <DashboardEmpty>No lead-source data yet.</DashboardEmpty>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}

      {activeTab === "Occupancy" && (
        <div className="dashboard-detail-grid">
          <Panel title="Desk occupancy" note="Active membership plans">
            <div className="dashboard-detail-number">
              {dashboard?.overview?.occupancy?.desks?.capacity
                ? `${dashboard.overview.occupancy.desks.occupied} / ${dashboard.overview.occupancy.desks.capacity}`
                : "Not configured"}
            </div>
            <div className="occupancy-bar large">
              <span
                style={{
                  width: `${dashboard?.overview?.occupancy?.desks?.percent ?? 0}%`,
                }}
              />
            </div>
            <p className="dashboard-detail-note">
              {dashboard?.overview?.occupancy?.desks?.percent == null
                ? "Set DASHBOARD_DESK_CAPACITY to calculate a desk occupancy percentage."
                : `${dashboard.overview.occupancy.desks.percent}% occupied, calculated from active memberships classified as desks/coworking.`}
            </p>
          </Panel>
          <Panel
            title="Private office occupancy"
            note="Active office memberships"
          >
            <div className="dashboard-detail-number">
              {dashboard?.overview?.occupancy?.offices?.capacity
                ? `${dashboard.overview.occupancy.offices.occupied} / ${dashboard.overview.occupancy.offices.capacity}`
                : "Not configured"}
            </div>
            <div className="occupancy-bar large">
              <span
                style={{
                  width: `${dashboard?.overview?.occupancy?.offices?.percent ?? 0}%`,
                }}
              />
            </div>
            <p className="dashboard-detail-note">
              {dashboard?.overview?.occupancy?.offices?.percent == null
                ? "Set DASHBOARD_OFFICE_CAPACITY to calculate an office occupancy percentage."
                : `${dashboard.overview.occupancy.offices.percent}% occupied, calculated from active memberships classified as private offices.`}
            </p>
          </Panel>
          <Panel
            title="Renewals in the next 60 days"
            note={`${renewalData.count} memberships`}
          >
            <div className="dashboard-detail-number">
              {currency(renewalData.recurringValue)}
            </div>
            <p className="dashboard-detail-note">
              Recurring monthly value associated with upcoming membership
              renewals.
            </p>
            {(dashboard?.renewalList || []).length ? (
              <div className="dashboard-compact-list">
                {dashboard.renewalList.map((item) => (
                  <div key={item._id}>
                    <span>Membership renewal</span>
                    <b>
                      {formatShortDate(item.renewalAt, timezone)} ·{" "}
                      {currency(item.monthlyValue, true)}
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <DashboardEmpty>No renewals in the next 60 days.</DashboardEmpty>
            )}
            <div className="dashboard-detail-subheading">Upcoming bookings</div>
            {(dashboard?.occupancyDetails?.bookingsNext60Days || []).length ? (
              <div className="dashboard-compact-list">
                {dashboard.occupancyDetails.bookingsNext60Days.map((item) => (
                  <div key={item._id}>
                    <span>
                      {item.title}
                      {item.contactName ? ` · ${item.contactName}` : ""}
                    </span>
                    <b>{formatShortDate(item.startAt, timezone)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <DashboardEmpty>No upcoming bookings.</DashboardEmpty>
            )}
          </Panel>
        </div>
      )}

      {activeTab === "Revenue" && (
        <div className="dashboard-detail-grid revenue-detail-grid">
          <Panel
            title={`Revenue mix · ${dashboard?.revenueMixMonth || "last month"}`}
            note="Paid invoice totals by product category"
          >
            <div className="dashboard-detail-number">
              {currency(dashboard?.revenueMixTotal || 0)}
            </div>
            <div className="dashboard-revenue-list dashboard-revenue-list-large">
              {[...(dashboard?.revenueMix || [])]
                .sort((a, b) => b.revenue - a.revenue)
                .map((item, index) => (
                  <div className="dashboard-revenue-row" key={item.category}>
                    <div>
                      <span>{item.category}</span>
                      <b>{currency(item.revenue, true)}</b>
                    </div>
                    <div className="dashboard-revenue-track">
                      <span
                        style={{
                          width: `${Math.max(item.revenue ? 2 : 0, (Number(item.revenue || 0) / maxRevenue) * 100)}%`,
                          background:
                            SOURCE_COLORS[index % SOURCE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </Panel>
          <Panel title="Revenue data coverage" note="Source: paid invoices">
            <p className="dashboard-detail-note">
              Revenue is calculated from invoices paid during the most recently
              completed calendar month in the workspace timezone. If an invoice
              links to a deal, its product type determines the category;
              otherwise the invoice description/metadata is used.
            </p>
            <button
              type="button"
              className="btn primary"
              onClick={() => navigate("/invoices")}
            >
              Open invoices
            </button>
          </Panel>
        </div>
      )}

      {activeTab === "Sources" && (
        <div className="dashboard-source-detail-grid">
          {sourceItems.length ? (
            sourceItems.map((item, index) => (
              <Panel
                title={item.source}
                note="Last 90 days"
                key={item.source}
                className="dashboard-source-detail-card"
              >
                <div className="dashboard-detail-number">
                  {item.percentage}%
                </div>
                <div className="dashboard-revenue-track">
                  <span
                    style={{
                      width: `${item.percentage}%`,
                      background: SOURCE_COLORS[index % SOURCE_COLORS.length],
                    }}
                  />
                </div>
                <div className="dashboard-source-stats">
                  <span>{item.count} deals</span>
                  <span>{item.wonCount} won</span>
                  <b>{item.conversionRate}% conversion</b>
                </div>
              </Panel>
            ))
          ) : (
            <Panel title="Lead source performance">
              <DashboardEmpty>
                No deals with a source recorded in the last 90 days.
              </DashboardEmpty>
            </Panel>
          )}
        </div>
      )}

      {loading && (
        <div className="dashboard-loading" role="status">
          Loading workspace data…
        </div>
      )}

      {insightOpen && (
        <div
          className="dashboard-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setInsightOpen(false)
          }
        >
          <section className="dashboard-modal">
            <div className="dashboard-modal-head">
              <div>
                <span className="eyebrow">BANYAN INSIGHT</span>
                <h2>{dashboard?.insight?.title || "Deal follow-up"}</h2>
              </div>
              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => setInsightOpen(false)}
                aria-label="Close insight"
              >
                ×
              </button>
            </div>
            <p>
              {dashboard?.insight?.message ||
                "There are no current quiet-deal insights."}
            </p>
            {(dashboard?.insight?.quietDeals || []).length ? (
              <div className="dashboard-quiet-deals">
                {dashboard.insight.quietDeals.map((deal) => (
                  <div key={deal._id}>
                    <div>
                      <b>{deal.title}</b>
                      <small>
                        {deal.contactName || "No contact"} · No recent activity
                        since {formatShortDate(deal.lastActivityAt, timezone)}
                      </small>
                    </div>
                    <strong>{currency(deal.value, true)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="dashboard-modal-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={() => setInsightOpen(false)}
              >
                Close
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  setInsightOpen(false);
                  navigate("/deal");
                }}
              >
                View deals
              </button>
            </div>
          </section>
        </div>
      )}

      {draftOpen && (
        <div
          className="dashboard-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            !draftSaving &&
            setDraftOpen(false)
          }
        >
          <section className="dashboard-modal">
            <div className="dashboard-modal-head">
              <div>
                <span className="eyebrow">BANYAN AI · DRAFT</span>
                <h2>Follow-up note</h2>
              </div>
              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => !draftSaving && setDraftOpen(false)}
                aria-label="Close draft"
              >
                ×
              </button>
            </div>
            <textarea
              className="dashboard-draft-text"
              rows={6}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
            />
            {draftError && <div className="notice error">{draftError}</div>}
            <div className="dashboard-modal-actions">
              <button className="btn ghost" type="button" onClick={copyDraft}>
                {draftCopied ? "Copied" : "Copy"}
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={logDraft}
                disabled={draftSaving}
              >
                {draftSaving ? "Saving…" : "Log as note"}
              </button>
            </div>
          </section>
        </div>
      )}

      {newDealOpen && (
        <div
          className="dashboard-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && modalClose()
          }
        >
          <section className="dashboard-modal dashboard-new-deal-modal">
            <div className="dashboard-modal-head">
              <div>
                <span className="eyebrow">PIPELINE MANAGEMENT</span>
                <h2>New deal</h2>
              </div>
              <button
                type="button"
                className="dashboard-modal-close"
                onClick={modalClose}
                aria-label="Close new deal form"
              >
                ×
              </button>
            </div>
            {newDealLoading ? (
              <DashboardEmpty>Loading contacts and pipelines…</DashboardEmpty>
            ) : contacts.length === 0 ? (
              <>
                <div className="notice">
                  Create a contact before creating a deal.
                </div>
                <div className="dashboard-modal-actions">
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={modalClose}
                  >
                    Close
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => {
                      modalClose();
                      navigate("/contact");
                    }}
                  >
                    Open contacts
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={createDeal} className="dashboard-new-deal-form">
                <label>
                  Deal title
                  <input
                    autoFocus
                    value={dealForm.title}
                    onChange={(event) =>
                      setDealForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                    maxLength={200}
                    placeholder="e.g. Private office enquiry"
                  />
                </label>
                <label>
                  Contact
                  <select
                    value={dealForm.contactId}
                    onChange={(event) =>
                      setDealForm((current) => ({
                        ...current,
                        contactId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select contact</option>
                    {contacts.map((contact) => (
                      <option key={contact._id} value={contact._id}>
                        {`${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
                          contact.email}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="dashboard-form-two-cols">
                  <label>
                    Pipeline
                    <select
                      value={dealForm.pipelineId}
                      onChange={(event) => onPipelineChange(event.target.value)}
                      required
                    >
                      <option value="">Select pipeline</option>
                      {pipelines.map((pipeline) => (
                        <option key={pipeline._id} value={pipeline._id}>
                          {pipeline.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Stage
                    <select
                      value={dealForm.stageId}
                      onChange={(event) =>
                        setDealForm((current) => ({
                          ...current,
                          stageId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select stage</option>
                      {stages.map((stage) => (
                        <option key={stage._id} value={stage._id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Value (HKD)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={dealForm.value}
                      onChange={(event) =>
                        setDealForm((current) => ({
                          ...current,
                          value: event.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </label>
                  <label>
                    Product type
                    <select
                      value={dealForm.productType}
                      onChange={(event) =>
                        setDealForm((current) => ({
                          ...current,
                          productType: event.target.value,
                        }))
                      }
                    >
                      <option value="membership">Coworking membership</option>
                      <option value="private_office">Private office</option>
                      <option value="venue_hire">Venue hire</option>
                      <option value="meeting_room">Meeting room</option>
                      <option value="day_pass">Day pass</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Lead source
                    <select
                      value={dealForm.source}
                      onChange={(event) =>
                        setDealForm((current) => ({
                          ...current,
                          source: event.target.value,
                        }))
                      }
                    >
                      <option value="website">Website</option>
                      <option value="referral">Referral</option>
                      <option value="broker">Broker</option>
                      <option value="instagram">Instagram</option>
                      <option value="walk-in">Walk-in</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Expected close date
                    <input
                      type="date"
                      value={dealForm.expectedCloseDate}
                      onChange={(event) =>
                        setDealForm((current) => ({
                          ...current,
                          expectedCloseDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                {dealError && <div className="notice error">{dealError}</div>}
                <div className="dashboard-modal-actions">
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={modalClose}
                    disabled={savingDeal}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={savingDeal || !dealForm.stageId}
                  >
                    {savingDeal ? "Creating…" : "Create deal"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
