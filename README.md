# Banyan CRM — React Frontend

A React + Vite frontend implementation of the latest Banyan Workspace CRM prototype. The prototype remains the source of truth for UI structure, copy, workflows and the added Event Loyalty Rewards screen.

## Stack
- React 19
- Vite 7
- React Router 7
- Phosphor Icons
- Source Serif 4

## Screens
Dashboard, Tasks, Inbox, Pipelines, Deal, Contacts, Templates, Calendar, Agreements, Invoices, Members, Loyalty, Automations.

## Current scope
This frontend uses realistic prototype/mock data and local UI state. It intentionally does not connect to the future Node/Express/MongoDB backend yet.

## Run
```bash
npm install
npm run dev
```

## Backend integration boundary
Replace the mock data/actions with REST API calls without changing the visual information architecture. Recommended future API domains: auth, contacts, companies, deals/pipelines, tasks, conversations, templates, calendar/bookings, agreements, invoices, members, loyalty, automations, integrations.
