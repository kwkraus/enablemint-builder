# Implementation Plan: Public Series Landing Page

**Branch**: `004-public-series-landing-page` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-public-series-landing-page/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Add an owner-controlled, off-by-default `IsPublic` flag on `Series`, a new anonymous (no
`RequireAuthorization`) backend endpoint that returns a series' title, sanitized details, and its
sessions (title, schedule, registration URL) only when that flag is on — treating "off" identically to
"not found" — and a new public Next.js route `app/public/series/[id]/page.tsx` that renders that data
as a professional, responsive landing page with a session table and per-session Register links opening
in a new tab. The existing admin series page gains a toggle control (permission-gated the same way
title editing already is) to turn the flag on/off.

## Technical Context

**Language/Version**: C# (.NET 10) for backend; TypeScript / React 19 for frontend.

**Primary Dependencies**: ASP.NET Core Minimal API, EF Core (Azure SQL), Microsoft.Identity.Web
(existing auth) — new endpoint intentionally omits `RequireAuthorization`. Next.js 16 App Router,
Tailwind CSS v4, Primer React v38 (existing design system, reused for the public page).

**Storage**: Azure SQL via EF Core. One new nullable-free `bool IsPublic` column on the existing
`Series` table, added via an EF Core migration, defaulting to `false`.

**Testing**: xUnit for backend (endpoint + service tests: authorized owner toggles flag; anonymous GET
respects flag on/off/not-found). Playwright E2E for the new public page (renders anonymously, session
table, Register link behavior, responsive layout) plus existing frontend test patterns for the new
admin toggle control.

**Target Platform**: Existing Azure App Service–hosted backend API and Next.js frontend; public page is
served by the same Next.js app under a new route, not a separate deployment.

**Project Type**: Web application (existing `src/backend` + `src/frontend` split).

**Performance Goals**: Public landing page data loads and renders within 3 seconds on typical broadband
(SC-001) — satisfied by a single anonymous GET returning series + sessions in one round trip, no
client-side waterfall.

**Constraints**: Anonymous endpoint MUST NOT leak owner-only data (owner id, metrics, edit affordances)
and MUST return the same generic not-found shape for "series does not exist" and "series exists but
`IsPublic` is false" (FR-008, FR-016, SC-004, SC-005). No new auth model introduced (FR-002 caveat via
FR-014-017). No rate limiting/caching layer introduced by this feature (per Assumptions).

**Scale/Scope**: One new DB column + migration, one new anonymous backend endpoint (plus a toggle field
on the existing update endpoint), one new public Next.js route + page component + session-table
component, one new toggle control on the existing admin series page. No new services or external
integrations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality & Maintainability**: New public endpoint lives in the existing
  `Features/Series` (and reads `Features/Sessions`-equivalent data) vertical slice; no new
  cross-cutting abstraction is introduced beyond a small DTO/mapping reused from existing
  `SeriesResponseDto`/session DTOs. PASS.
- **II. Testing Standards & Regression Prevention**: Plan requires xUnit coverage for the anonymous
  endpoint's on/off/not-found behavior and the owner-only toggle authorization, plus Playwright
  coverage for the public page's anonymous rendering and responsive behavior. PASS (tests planned
  before implementation per TDD conventions already used in this repo).
- **III. UX Consistency & Accessibility**: Public page reuses existing Tailwind/Primer design tokens
  and components rather than a new visual system (FR-011); empty/loading/not-found states are
  explicitly designed (FR-008, FR-009). PASS.
- **IV. Performance & Reliability**: Single anonymous GET satisfies SC-001; no N+1 query pattern (mirrors
  existing `SeriesService.GetAllAsync` batching pattern for sessions). PASS.
- **V. Security & Data Protection**: This is the one gate requiring explicit justification — the new
  endpoint is intentionally unauthenticated. This is the entire point of the feature (public landing
  page) and is scoped tightly: read-only, no owner identity, no metrics, gated by the explicit
  off-by-default `IsPublic` flag that only a permitted owner can flip. Documented in Complexity
  Tracking below per constitution's "Security exceptions MUST be documented, reviewed, and
  time-bounded" rule (this exception is scope-bound rather than time-bound, since anonymous read is a
  permanent, intended feature of this endpoint). PASS WITH DOCUMENTED EXCEPTION.
- **VI. Operational Visibility**: Anonymous endpoint requests and owner toggle changes MUST be logged
  (structured, no PII) so misuse or unexpected traffic patterns are diagnosable. PASS (planned as part
  of endpoint implementation, consistent with existing endpoint logging conventions).

## Project Structure

### Documentation (this feature)

```text
specs/004-public-series-landing-page/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/backend/
├── Domain/Entities/
│   └── Series.cs                          # + IsPublic bool property
├── Features/Series/
│   ├── SeriesEndpoints.cs                  # + PUT toggle support (existing UpdateSeriesRequest)
│   ├── SeriesService.cs                    # + IsPublic persisted on update
│   ├── Public/
│   │   ├── PublicSeriesEndpoints.cs        # NEW: anonymous GET /api/v1/public/series/{id}
│   │   ├── PublicSeriesService.cs          # NEW: reads Series+Sessions, enforces IsPublic gate
│   │   └── Dtos/
│   │       ├── PublicSeriesResponseDto.cs  # NEW: title, details, sessions[]
│   │       └── PublicSessionDto.cs         # NEW: title, startsAt, endsAt, registrationUrl
│   └── Dtos/
│       ├── UpdateSeriesRequest.cs          # + IsPublic
│       └── SeriesResponseDto.cs            # + IsPublic (admin view of current state)
├── Migrations/
│   └── {timestamp}_AddIsPublicToSeries.cs  # NEW EF Core migration
└── Features/Series/SeriesEndpoints.cs      # existing group keeps RequireAuthorization();
                                             # Public/ endpoints registered on a separate,
                                             # unauthenticated MapGroup

src/frontend/
├── app/
│   ├── series/[id]/page.tsx                # + IsPublic toggle control (admin view)
│   └── public/series/[id]/
│       ├── page.tsx                        # NEW: public landing page (server component)
│       ├── not-found.tsx                   # NEW: generic not-found state
│       └── loading.tsx                     # NEW: loading skeleton
├── components/
│   ├── series-visibility-toggle.tsx        # NEW: admin on/off control
│   └── public-series-landing.tsx           # NEW: renders title/details/session table
└── e2e/
    └── public-series-landing.spec.ts       # NEW: Playwright coverage
```

**Structure Decision**: Existing web application split (`src/backend`, `src/frontend`) is retained. The
public read path is isolated as a `Features/Series/Public` sub-slice on the backend (own DTOs/service,
own unauthenticated `MapGroup`) so the authenticated `Features/Series` group's `RequireAuthorization()`
is never accidentally weakened, and as a new `app/public/series/[id]` route tree on the frontend so the
existing authenticated `app/series/[id]` admin page and its layout/providers are untouched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New unauthenticated backend endpoint (violates default "V. Security & Data Protection" expectation that user/business endpoints enforce identity validation) | The feature's entire purpose (spec `FR-002`) is a page anonymous visitors can view without signing in; there is no way to deliver the specified user value with an authenticated-only endpoint. | Rejected: gating the existing authenticated `GET /api/v1/series/{id}` behind a share token would require inventing a new token/identity mechanism not requested in the spec and explicitly out of scope per the spec's Assumptions ("no new short-lived token... is introduced"). Risk is bounded by (a) the endpoint being read-only, (b) an explicit off-by-default `IsPublic` flag the owner must deliberately enable, and (c) the endpoint returning zero owner-only fields (no owner id, no metrics). |

