# Implementation Plan: Session Description

**Branch**: `003-session-description` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-session-description/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Add an optional rich-text description to each `Session`, persist it with the session, expose it
through the existing session create/update/detail contract, and render/edit it on the session detail
page using the established series-details behavior. Reuse the server sanitizer and editor primitives;
render long content collapsed by default with accessible “Show more…” / “Show less…” disclosure controls.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: C#/.NET 10; TypeScript/Next.js 16, React 19

**Primary Dependencies**: ASP.NET Core Minimal API, EF Core 10, Azure SQL, Primer React 38,
next-auth, Playwright; no new runtime dependency

**Storage**: Nullable SQL Server `nvarchar(max)` column on `Sessions`, mapped by EF Core

**Testing**: xUnit + FluentAssertions + SQLite/InMemory backend tests; Playwright E2E; frontend lint/build

**Target Platform**: Authenticated browser application with ASP.NET Core on Azure App Service

**Project Type**: Full-stack web application with ASP.NET Core Minimal API and Next.js App Router

**Performance Goals**: Include description in the existing session detail request; no extra read
round trip; local editor/toggle remains responsive for 10,000 decoded characters

**Constraints**: Optional nullable field; same allow-list and 10,000 decoded-character limit as series
details; server-authoritative sanitization; owner authorization unchanged; no new dependency; bounded
collapsed rendering by default; preserve existing error and save patterns

**Scale/Scope**: One nullable session field, existing session POST/PUT/GET DTOs, one session-detail
component, one EF migration, targeted backend and Playwright coverage; list/export/search remain out
of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status: PASS**

- **Code Quality & Maintainability:** Extend the existing Sessions vertical slice and reuse the shared
  sanitizer/editor/rendering patterns; no speculative abstraction or new endpoint.
- **Testing Standards & Regression Prevention:** Add persistence, sanitization, API, empty/clear,
  formatting, overflow, toggle, and save-failure tests tied to user-visible behavior.
- **UX Consistency & Accessibility:** Match series details affordances and inline-save behavior; use
  semantic sections, keyboard-operable disclosure controls, `aria-expanded`/`aria-controls`, visible
  focus, and explicit empty/loading/error states.
- **Performance & Reliability:** Reuse the detail request and full update; sanitize before mutation;
  bound long content so schedule, registration, and metrics remain reachable.
- **Security & Data Protection:** Reuse server allow-list sanitization, preserve owner filtering, and
  avoid unsafe HTML rendering or sensitive logging.
- **Operational Visibility:** Reuse existing error envelopes and frontend error banners; document
  build/lint/test validation.
- **Technology constraints:** Approved .NET/Next.js/EF/Playwright stack only; no runtime dependency
  or undocumented exception.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── backend/
│   ├── Common/                         # shared rich-text sanitizer
│   ├── Domain/Entities/Session.cs      # Session.Description
│   ├── Features/Sessions/              # DTOs, service, endpoints
│   ├── Infrastructure/Data/            # EF mapping
│   └── Migrations/                     # AddDescriptionToSession
└── frontend/
    ├── app/sessions/[id]/page.tsx       # session details integration
    ├── components/                      # session description UI
    ├── lib/api/                         # typed session contract/client
    └── e2e/                             # Playwright user journeys
tests/
└── backend/EnableFront.Builder.Api.Tests/
    └── Features/Sessions/              # service/API contract tests
```

**Structure Decision**: Use the existing two-part vertical slice. Backend changes remain in the
Sessions feature and shared Common sanitizer, with a nullable EF migration. Frontend changes stay on
the existing client session detail route and introduce a focused `SessionDescription` section that
reuses `SeriesDetailsEditor` and safe HTML rendering. No list DTO, export, search, or new permission
surface is added.

## Phase 0: Research

Research is captured in [research.md](./research.md). All technical-context decisions are resolved:
the existing sanitizer, EF/DTO patterns, owner authorization, native editor, and disclosure approach
were selected without introducing dependencies or a new endpoint.

## Phase 1: Design and contracts

- [data-model.md](./data-model.md) defines `Session.Description`, storage mapping, content rules,
  and null/content transitions.
- [contracts/session-description-api.md](./contracts/session-description-api.md) defines POST,
  GET, PUT, compatibility, and validation error behavior.
- [contracts/session-description-ui.md](./contracts/session-description-ui.md) defines empty,
  editing, safe rendering, bounded disclosure, accessibility, and failure states.
- [quickstart.md](./quickstart.md) defines focused backend, frontend, and E2E validation.

## Implementation sequencing

1. Add `Session.Description`, conditional EF mapping, and a reversible migration.
2. Extend create/update/response DTOs and typed frontend session API models.
3. Sanitize and validate descriptions in `SessionService` before mutation; map the field in responses
   and preserve it on full updates.
4. Add backend service and API contract tests for persistence, clearing, limits, ownership, and
   legacy null rows.
5. Extend the series editor with session-neutral labels/placeholder support only as needed, then add
   `SessionDescription` with safe rendering and bounded disclosure (`aria-expanded`/`aria-controls`).
6. Integrate description state and save behavior into `app/sessions/[id]/page.tsx`, ensuring schedule
   saves carry the current description.
7. Add Playwright coverage for all user stories, long-description keyboard expansion/collapse, and
   cross-session isolation.
8. Run the commands in quickstart.md and review migration, accessibility, and no-new-dependency
   gates.

## Post-design Constitution Check

**Status: PASS.** The Phase 1 artifacts preserve the approved stack and vertical-slice boundaries,
reuse the existing security and error conventions, specify user-visible tests, and explicitly bound
long descriptions without compromising keyboard access to the rest of the session details page.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | No constitution violations identified |
