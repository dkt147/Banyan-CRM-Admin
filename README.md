# Banyan CRM — React Frontend

A React + Vite frontend implementation of the latest Banyan Workspace CRM prototype. The prototype remains the source of truth for UI structure, copy, workflows and the added Event Loyalty Rewards screen.

## Stack
- React 19
- Vite 7
- React Router 7
- Phosphor Icons
- Source Serif 4

## Screens
Dashboard, Tasks, Inbox, Pipelines, Deal, Contacts, Templates, Calendar, Agreements, Invoices, Members, Loyalty, Automations, Integrations.

## Current scope
The frontend is connected to the Node/Express/MongoDB backend. Prototype/mock data remains only as static navigation metadata and reference content; business records are loaded from the API.

## Run
```bash
npm install
npm run dev
```

## Backend integration boundary
Replace the mock data/actions with REST API calls without changing the visual information architecture. Integrated API domains: auth, workspace, members, contacts, companies, deals/pipelines/stages, activities, tasks, inbox/conversations/messages, templates, calendar/events/bookings, agreements, invoices/payments, memberships/plans/check-ins, loyalty/accounts/ledger/tiers/redemptions, automations/executions, integrations, notifications, documents and audit logs. Gmail is connected through the Integrations/Inbox screens (sync, compose, send replies). Google Calendar can import provider events and sync local event changes. External webhook endpoints remain backend-only infrastructure.


## Authentication

The frontend now starts at `/login`.

- Login uses `POST /auth/login`.
- The API base URL is configured with `VITE_API_BASE_URL`.
- Access tokens are stored locally for the current browser session.
- The refresh token remains in the backend's HttpOnly cookie.
- Protected CRM routes redirect unauthenticated users to `/login`.
- Successful login redirects to `/dashboard`.
- Expired access tokens are refreshed through `/auth/refresh`.
- Sign out calls `/auth/logout` and clears the local session.

For local development:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

## Typography

The existing **Source Serif 4** remains the heading/display font.

The overall CRM UI now uses **Colin** as the primary interface font with system fallbacks. If Colin is not installed or supplied as a licensed webfont, the browser will use the configured fallback font. A licensed Colin webfont can be added later through `@font-face`.

## Live API integration

The CRM is now connected to the Banyan Express/MongoDB backend. See `API_INTEGRATION.md` for the screen-to-endpoint map and authentication flow.

Set `VITE_API_BASE_URL` to the backend `/api/v1` URL before running the frontend. No additional frontend dependency is required for the API integration.


## Gmail & Google Calendar

For the full local OAuth setup, open `docs/google-gmail-calendar-local-setup.md` in the backend project. Backend credentials belong in the backend `.env`; only the API base URL belongs in the frontend `.env`.


## Ask Anything

The top-bar Ask Anything field opens Banyan Assist. Submitting a question sends it to the authenticated backend endpoint `POST /api/v1/assistant/chat`; the Groq API key is only configured on the backend. The answer includes labels for the live workspace data sources used. Frontend setup remains the same: set `VITE_API_BASE_URL` to the backend API base URL ending in `/api/v1`.
