---
description: Guidance for the Next.js frontend in src/frontend
applyTo: "src/frontend/**"
---

# Next.js Frontend Instructions

Applies to `src/frontend`. Shared rules (architecture, build/test, congruency check) live in `copilot-instructions.md`.

## Agent Routing
- Testing → `frontend-backend-tdd-engineer`
- UX/composition → `nextjs-frontend-ux-engineer`
- Accessibility → `frontend-accessibility-and-ux-acceptance` skill via `nextjs-frontend-ux-engineer`
- Ask when requirements are unclear.

## Architecture
- App Router (`app/`) with React Server Components by default.
- Thin routes; UI components render; organize by feature (`app/<feature>/`).
- Shared UI → `components/`; shared utilities → `lib/`.

## Project Structure
- `app/` — routes, layouts, pages, loading/error states
- `app/series/`, `app/sessions/` — feature flows
- `components/` — pure, prop-driven reusable UI
- `lib/` — data access, API clients, helpers; `lib/api/` for typed clients matching backend DTOs
- `public/` — static assets
- E2E: `src/frontend/e2e/`

## Dependencies
- Next.js 16, React 19, TypeScript (required for new files).
- Tailwind CSS v4 utility-first.
- Primer React v38 (`@primer/react`) + `@primer/octicons-react`.
- next-auth (Entra ID); Playwright E2E (`playwright.config.ts`).
- ESLint must remain clean.

## Authentication
- Entra ID redirect login; unauthenticated → redirect to login.
- Silent token refresh; on failure → login.
- Logout clears session and redirects.
- Pass user JWT to backend for authenticated requests.

## Data & State
- Prefer server components for data fetching.
- `fetch` caching (`no-store`, `force-cache`, revalidate).
- Local client state; context only when needed; no global stores unless required.
- Metrics are read-only (no compute-on-read); no pagination in V1.

## UI/UX
- Accessible, semantic HTML; loading + error boundaries.
- Desktop-first, readable on tablet; mobile not required in V1.
- Inline error banners with retry; no optimistic updates in V1.
- Keep visual consistency with existing patterns.

## Best Practices
- Small focused components; no `any` — share interfaces with backend DTOs.
- Async server actions where appropriate; composition over prop drilling.

## Build
- `npm run build` passes; `npm run lint` clean.
