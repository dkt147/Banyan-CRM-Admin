const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse(response) {
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || `Request failed (${response.status}).`;
    throw new ApiError(message, response.status, payload);
  }
  return payload;
}

function buildUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

export async function apiRequest(path, { method = "GET", token, query, body, signal, retry } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && retry) {
    return retry();
  }
  return parseResponse(response);
}

export { API_BASE_URL };

export const endpoints = {
  health: () => "/health",
  login: () => "/auth/login",
  register: () => "/auth/register",
  refresh: () => "/auth/refresh",
  logout: () => "/auth/logout",
  me: () => "/auth/me",
  profile: () => "/auth/profile",
  workspace: () => "/workspace",
  members: () => "/members",
  companies: () => "/companies",
  contacts: () => "/contacts",
  pipelines: () => "/pipelines",
  pipelineStages: (id) => `/pipelines/${id}/stages`,
  pipelineStage: (id) => `/pipelines/stages/${id}`,
  deals: () => "/deals",
  deal: (id) => `/deals/${id}`,
  dealMove: (id) => `/deals/${id}/move`,
  activities: () => "/activities",
  tasks: () => "/tasks",
  task: (id) => `/tasks/${id}`,
  taskComplete: (id) => `/tasks/${id}/complete`,
  taskSnooze: (id) => `/tasks/${id}/snooze`,
  inbox: () => "/inbox",
  conversation: (id) => `/inbox/${id}`,
  conversationMessages: (id) => `/inbox/${id}/messages`,
  conversationRead: (id) => `/inbox/${id}/read`,
  conversationLink: (id) => `/inbox/${id}/link`,
  conversations: () => "/conversations",
  messages: () => "/messages",
  templates: () => "/templates",
  calendar: () => "/calendar",
  calendarEvents: () => "/calendar-events",
  bookings: () => "/bookings",
  agreements: () => "/agreements",
  invoices: () => "/invoices",
  invoicePay: (id) => `/invoices/${id}/pay`,
  invoiceOverdue: () => "/invoices/mark-overdue",
  payments: () => "/payments",
  membershipPlans: () => "/membership-plans",
  memberships: () => "/memberships",
  checkIns: () => "/check-ins",
  loyaltyAccounts: () => "/loyalty/accounts",
  loyaltyAdjust: () => "/loyalty/adjust",
  loyaltyRedeem: () => "/loyalty/redemptions",
  loyaltyDecision: (id) => `/loyalty/redemptions/${id}/decision`,
  loyaltyTiers: () => "/loyalty-tiers",
  loyaltyLedger: () => "/loyalty-ledger",
  loyaltyRedemptions: () => "/loyalty-redemptions",
  automations: () => "/automations",
  automation: (id) => `/automations/${id}`,
  automationExecute: (id) => `/automations/${id}/execute`,
  automationExecutions: (id) => `/automations/${id}/executions`,
  integrations: () => "/integrations",
  notifications: () => "/notifications",
  notificationRead: (id) => `/notifications/${id}/read`,
  notificationReadAll: () => "/notifications/read-all",
  documents: () => "/documents",
  auditLogs: () => "/audit-logs",
  dashboardOverview: () => "/dashboard/overview",
  dashboardPipeline: () => "/dashboard/pipeline",
  dashboardRevenue: () => "/dashboard/revenue",
  webhook: (provider) => `/webhooks/${provider}`,
};
