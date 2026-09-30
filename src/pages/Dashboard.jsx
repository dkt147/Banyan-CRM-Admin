import React, { useEffect, useState } from "react";
import Metric from "../components/Metric";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";

export default function Dashboard() {
  const { user, request } = useAuth();
  const [overview, setOverview] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [error, setError] = useState("");
  const firstName = user?.name?.split(/\s+/)[0] || "there";

  useEffect(() => {
    let alive = true;
    Promise.all([
      request("/dashboard/overview"),
      request("/dashboard/pipeline"),
      request("/dashboard/revenue"),
      request("/tasks", { query: { limit: 6, status: "pending" } }),
      request("/inbox", { query: { limit: 5 } }),
    ])
      .then(([o, p, r, t, i]) => {
        if (!alive) return;
        setOverview(o.data);
        setPipeline(p.data || []);
        setRevenue(r.data || []);
        setTasks(t.data?.tasks || t.data?.items || []);
        setInbox(i.data || []);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [request]);

  const currency = (n = 0) => `HK$${Number(n).toLocaleString("en-HK")}`;
  const monthRevenue = revenue.length
    ? revenue[revenue.length - 1]?.revenue || 0
    : 0;

  return (
    <Page title={`Good morning, ${firstName}`} kicker="Live workspace overview">
      {error && (
        <div className="notice error">
          <b>Dashboard API error</b>
          <span>{error}</span>
        </div>
      )}
      <div className="metrics four">
        <Metric
          label="Open pipeline"
          value={currency(overview?.openPipeline?.value)}
          sub={`${overview?.openDeals ?? 0} open deals`}
        />
        <Metric
          label="Needs action"
          value={overview?.tasksNeedingAction ?? 0}
          sub={`${overview?.unreadMessages ?? 0} unread messages`}
          accent
        />
        <Metric
          label="Awaiting invoices"
          value={currency(overview?.awaitingInvoices?.total)}
          sub={`${overview?.awaitingInvoices?.count ?? 0} invoices`}
        />
        <Metric
          label="Active memberships"
          value={overview?.activeMemberships ?? 0}
          sub={`${overview?.enrolledLoyaltyClients ?? 0} loyalty accounts`}
        />
      </div>

      <div className="two-col">
        <section className="panel">
          <SectionTitle
            title="Pipeline value by stage"
            note="Live from open deals"
          />
          {pipeline.length === 0 ? (
            <Empty text="No open pipeline data yet." />
          ) : (
            <div className="pipeline-bars">
              {pipeline.map((row) => (
                <div className="bar-row" key={row.stageId}>
                  <div className="bar-head">
                    <b>{row.name}</b>
                    <span>
                      {currency(row.value)} · {row.count}
                    </span>
                  </div>
                  <div className="stage-track">
                    <span style={{ flex: Math.max(row.value || 1, 1) }}>
                      {row.count} deals
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <SectionTitle
            title="Today's queue"
            note={`${overview?.tasksNeedingAction ?? 0} open tasks`}
          />
          {tasks.length === 0 ? (
            <Empty text="No pending tasks." />
          ) : (
            tasks.map((t) => (
              <Row
                key={t._id}
                title={t.title}
                sub={`${t.priority || "medium"} priority · ${new Date(t.dueAt).toLocaleString()}`}
                tag={t.status}
              />
            ))
          )}
        </section>
      </div>

      <div className="three-col">
        <section className="panel">
          <SectionTitle
            title="Inbox"
            note={`${overview?.unreadMessages ?? 0} unread`}
          />
          {inbox.length === 0 ? (
            <Empty text="No conversations." />
          ) : (
            inbox.map((c) => (
              <Row
                key={c._id}
                title={
                  c.subject ||
                  c.participantName ||
                  c.participantAddress ||
                  "Conversation"
                }
                sub={`${c.channel} · ${c.status}`}
                tag={c.unreadCount ? `${c.unreadCount} new` : "Read"}
              />
            ))
          )}
        </section>
        <section className="panel">
          <SectionTitle title="Revenue" note="Latest paid month" />
          <div className="mix">
            <div>
              <b>Latest month</b>
              <span>{currency(monthRevenue)}</span>
            </div>
            {revenue
              .slice(-5)
              .reverse()
              .map((x) => (
                <div key={x._id}>
                  <b>{x._id}</b>
                  <span>{currency(x.revenue)}</span>
                </div>
              ))}
          </div>
        </section>
        <section className="panel">
          <SectionTitle title="Workspace health" />
          <div className="mix">
            <div>
              <b>Open deals</b>
              <span>{overview?.openDeals ?? 0}</span>
            </div>
            <div>
              <b>Tasks needing action</b>
              <span>{overview?.tasksNeedingAction ?? 0}</span>
            </div>
            <div>
              <b>Awaiting invoices</b>
              <span>{overview?.awaitingInvoices?.count ?? 0}</span>
            </div>
            <div>
              <b>Enrolled loyalty clients</b>
              <span>{overview?.enrolledLoyaltyClients ?? 0}</span>
            </div>
          </div>
        </section>
      </div>
    </Page>
  );
}

export function Page({ title, kicker, actions, children }) {
  return (
    <div className="page">
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
function Row({ title, sub, tag }) {
  return (
    <div className="row">
      <div>
        <b>{title}</b>
        <span>{sub}</span>
      </div>
      <Badge>{tag}</Badge>
    </div>
  );
}
