---

description: "Task list for Public Series Landing Page"

---

# Tasks: Public Series Landing Page

**Input**: Design documents from `/specs/004-public-series-landing-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-series-api.md, quickstart.md

**Tests**: Included — the plan and quickstart explicitly require xUnit backend coverage and Playwright E2E coverage before/alongside implementation.

**Organization**: Tasks are grouped by user story (US1–US4) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

## Path Conventions

Web application split per plan.md: `src/backend/` (ASP.NET Core minimal API), `src/frontend/` (Next.js App Router), `tests/backend/`, `src/frontend/e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the project builds cleanly before any feature work begins.

- [X] T001 Verify backend builds with `dotnet build` from `src/backend` and frontend builds with `npm run build` from `src/frontend` (no code changes; establishes a clean baseline)
- [X] T002 [P] Confirm `dotnet test tests/backend/EnableFront.Builder.Api.Tests/EnableFront.Builder.Api.Tests.csproj` passes on current `main` before changes (baseline for regression comparison)
- [X] T003 [P] Confirm `npm run lint` passes in `src/frontend` before changes (baseline for regression comparison)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core `IsPublic` data model, migration, and shared DTO plumbing that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add `public bool IsPublic { get; set; } = false;` property to `Series` entity in `src/backend/Domain/Entities/Series.cs`
- [X] T005 Add EF Core migration `AddIsPublicToSeries` (non-nullable `bit` column, default `0`/`false`) via `dotnet ef migrations add AddIsPublicToSeries` from `src/backend`, producing `src/backend/Migrations/{timestamp}_AddIsPublicToSeries.cs`, `.Designer.cs`, and updating `src/backend/Migrations/AppDbContextModelSnapshot.cs`
- [X] T006 Add `IsPublic` field to `UpdateSeriesRequest` in `src/backend/Features/Series/Dtos/UpdateSeriesRequest.cs`, defaulting to the series' current stored value when omitted by an older client (no silent reset to `false` on unrelated saves)
- [X] T007 Add `IsPublic` field to `SeriesResponseDto` in `src/backend/Features/Series/Dtos/SeriesResponseDto.cs` so the admin UI can read current on/off state
- [X] T008 Persist `IsPublic` on `UpdateAsync` in `src/backend/Features/Series/SeriesService.cs`, preserving the existing `OwnerUserId` ownership check as the sole authorization boundary for the change

**Checkpoint**: `IsPublic` column, migration, and admin-side DTOs/service exist — user story implementation can now begin.

---

## Phase 3: User Story 1 - Series owner turns the public landing page on or off (Priority: P1) 🎯 MVP (gate)

**Goal**: A series owner sees an `IsPublic` toggle in the admin interface (permission-gated like `Title` editing), can turn it on/off, and the change takes effect immediately for the (not-yet-built) public endpoint's gating logic.

**Independent Test**: Create a new series (confirm `IsPublic` defaults to `false` in `SeriesResponseDto`), toggle it on via `PUT /api/v1/series/{id}` and confirm the response reflects `true`, then toggle it off and confirm it reflects `false` again; confirm a caller without edit permission cannot change it.

### Tests for User Story 1 ⚠️

- [X] T009 [P] [US1] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/SeriesServiceTests.cs` verifying `CreateAsync` defaults `IsPublic` to `false`
- [X] T010 [P] [US1] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/SeriesServiceTests.cs` verifying `UpdateAsync` persists an owner-supplied `IsPublic` value (`false → true` and `true → false`)
- [X] T011 [P] [US1] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/SeriesServiceTests.cs` verifying `UpdateAsync` preserves the existing stored `IsPublic` value when the request omits the field (no silent reset)
- [X] T012 [P] [US1] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/SeriesDetailsApiContractTests.cs` verifying a caller without edit permission on the series cannot change `IsPublic` via `PUT /api/v1/series/{id}` (existing ownership-check behavior, unchanged status code)
- [X] T013 [P] [US1] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/SeriesDetailsApiContractTests.cs` verifying `GET`/`PUT` responses for `/api/v1/series/{id}` include `isPublic` in the JSON body

### Implementation for User Story 1

- [X] T014 [US1] Create `series-visibility-toggle.tsx` component in `src/frontend/components/series-visibility-toggle.tsx` rendering the on/off control with its current state, calling the existing series update API on change, and hidden/disabled when the current user lacks edit permission (mirrors existing title-edit permission gating)
- [X] T015 [US1] Wire `series-visibility-toggle.tsx` into the admin series page `src/frontend/app/series/[id]/page.tsx`, alongside existing title/details editing controls
- [X] T016 [US1] Add structured logging (no PII) around `IsPublic` toggle changes in `src/backend/Features/Series/SeriesService.cs`, consistent with existing endpoint logging conventions (Constitution VI)

**Checkpoint**: Owners can see and toggle `IsPublic` from the admin UI; the flag persists correctly and is authorization-gated. This story is the mandatory gate for US2–US4 (their independent tests all require a series with `IsPublic` settable).

---

## Phase 4: User Story 2 - Anonymous visitor views a series landing page (Priority: P1)

**Goal**: An anonymous visitor can open `/public/series/{seriesId}` (frontend) backed by an anonymous `GET /api/v1/public/series/{id}` (backend) and see the series title, formatted details, and full session table — with "off" and "not found" returning identical responses.

**Independent Test**: Open the landing page URL for a known `IsPublic == true` series in a private/incognito window and confirm title, description, and session table render without any sign-in prompt; open it for an `IsPublic == false` series and for a nonexistent id and confirm both show the identical generic not-found state.

### Tests for User Story 2 ⚠️

- [X] T017 [P] [US2] Create `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/Public/PublicSeriesEndpointsTests.cs` with a test asserting `GET /api/v1/public/series/{id}` returns `200` with title/details/sessions when `IsPublic == true`
- [X] T018 [P] [US2] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/Public/PublicSeriesEndpointsTests.cs` asserting the endpoint returns `404` with the identical `series_not_found` shape when `IsPublic == false`
- [X] T019 [P] [US2] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/Public/PublicSeriesEndpointsTests.cs` asserting the endpoint returns `404` with the identical `series_not_found` shape when `id` does not match any series
- [X] T020 [P] [US2] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/Public/PublicSeriesEndpointsTests.cs` asserting the `200` response never contains `ownerUserId`, `seriesId`, `isPublic`, or metrics fields
- [X] T021 [P] [US2] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/Public/PublicSeriesEndpointsTests.cs` asserting the endpoint is reachable with no `Authorization` header or session cookie (no 401/403)
- [X] T022 [P] [US2] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/Public/PublicSeriesEndpointsTests.cs` asserting a series with empty `Details` returns `details: null` and a series with zero sessions returns `sessions: []`
- [X] T023 [P] [US2] Create `src/frontend/e2e/public-series-landing.spec.ts` with a Playwright scenario asserting an anonymous browser context (no auth cookie) loads `/public/series/{id}` for a public series and sees the title, formatted details, and session table (title + start date/time per row) without a sign-in redirect
- [X] T024 [P] [US2] Add scenario to `src/frontend/e2e/public-series-landing.spec.ts` asserting a public series with empty `Details` renders cleanly with no empty/broken description section
- [X] T025 [P] [US2] Add scenario to `src/frontend/e2e/public-series-landing.spec.ts` asserting a public series with zero sessions shows a neutral "no sessions scheduled yet" message instead of an empty table
- [X] T026 [P] [US2] Add scenario to `src/frontend/e2e/public-series-landing.spec.ts` asserting both a nonexistent `id` and a real-but-private (`IsPublic == false`) `id` render the identical generic not-found page

### Implementation for User Story 2

- [X] T027 [US2] Create `PublicSeriesResponseDto` and `PublicSessionDto` records in `src/backend/Features/Series/Public/Dtos/PublicSeriesResponseDto.cs` and `src/backend/Features/Series/Public/Dtos/PublicSessionDto.cs` per contracts/public-series-api.md (no `SeriesId`, `OwnerUserId`, `IsPublic`, or metrics fields)
- [X] T028 [US2] Create `PublicSeriesService` in `src/backend/Features/Series/Public/PublicSeriesService.cs` with a `GetPublicSeriesAsync(Guid id)` method that returns `null` when no series exists for `id` **or** when `series.IsPublic == false`, and otherwise projects the series and its sessions into `PublicSeriesResponseDto` (batched session load, no N+1)
- [X] T029 [US2] Create `PublicSeriesEndpoints` in `src/backend/Features/Series/Public/PublicSeriesEndpoints.cs` registering `MapGroup("/api/v1/public/series")` (no `.RequireAuthorization()`) with `GET /{id}` mapping a `null` service result to the existing `series_not_found` `404` shape and a non-null result to `200 OK` with `PublicSeriesResponseDto`
- [X] T030 [US2] Register the new `PublicSeriesEndpoints` group in the application's endpoint/startup wiring (e.g., `Program.cs`), verifying it is registered separately from the existing authenticated `Features/Series/SeriesEndpoints.cs` group
- [X] T031 [US2] Add structured logging (no PII) for anonymous public-series requests in `src/backend/Features/Series/Public/PublicSeriesService.cs`, consistent with existing endpoint logging conventions (Constitution VI)
- [X] T032 [P] [US2] Create `src/frontend/app/public/series/[id]/page.tsx` as a server component fetching `GET /api/v1/public/series/{id}` and rendering series title, details (via the existing `lib/series-details-html.tsx` sanitized-HTML helper), and session table
- [X] T033 [P] [US2] Create `src/frontend/app/public/series/[id]/not-found.tsx` rendering the generic not-found state for both nonexistent and private series responses
- [X] T034 [P] [US2] Create `src/frontend/app/public/series/[id]/loading.tsx` rendering a loading skeleton for the public landing page
- [X] T035 [US2] Create `public-series-landing.tsx` component in `src/frontend/components/public-series-landing.tsx` rendering the series title, details section (omitted when empty per FR-003), and session table (or "no sessions scheduled yet" empty state per FR-009), wired into `app/public/series/[id]/page.tsx`

**Checkpoint**: Anonymous visitors can view any `IsPublic == true` series' landing page; private/nonexistent series both show the identical not-found state. US1 + US2 together deliver the feature's core informational value.

---

## Phase 5: User Story 3 - Anonymous visitor registers for a session from the landing page (Priority: P2)

**Goal**: Each session row with a stored `registrationUrl` shows a Register control opening the destination in a new tab; rows without one, or for already-ended sessions, show no active Register control.

**Independent Test**: Open the landing page, locate a session row with a registration link, activate it, and confirm it opens the correct external destination in a new tab while the landing page remains open in the original tab; confirm a row with no `registrationUrl`, and a row for an already-ended session, show no active Register control.

### Tests for User Story 3 ⚠️

- [X] T036 [P] [US3] Add test in `tests/backend/EnableFront.Builder.Api.Tests/Features/Series/Public/PublicSeriesEndpointsTests.cs` asserting sessions with no `RegistrationUrl` are present in `sessions[]` with `registrationUrl: null`
- [X] T037 [P] [US3] Add scenario to `src/frontend/e2e/public-series-landing.spec.ts` asserting a session row with a `registrationUrl` shows a Register control that opens the destination in a new tab while the landing page remains open in the original tab
- [X] T038 [P] [US3] Add scenario to `src/frontend/e2e/public-series-landing.spec.ts` asserting a session row with no `registrationUrl` shows no Register control (not disabled, not empty)
- [X] T039 [P] [US3] Add scenario to `src/frontend/e2e/public-series-landing.spec.ts` asserting a session whose `endsAt` is in the past appears in the table without an active Register control, even if it has a `registrationUrl`

### Implementation for User Story 3

- [X] T040 [US3] Add per-row Register control logic to `src/frontend/components/public-series-landing.tsx`: render a link (`target="_blank"`, `rel="noopener noreferrer"`) opening `registrationUrl` only when non-null and the session's `endsAt` is in the future; omit the control entirely otherwise

**Checkpoint**: The landing page closes the registration loop end-to-end; US1–US3 together satisfy the feature's explicit ask (public page + anonymous registration).

---

## Phase 6: User Story 4 - Landing page looks professional and works on mobile (Priority: P3)

**Goal**: The landing page reflows cleanly at mobile (~375px), tablet (~768px), and desktop (~1280px+) viewport widths, with a professional, modern presentation reusing the existing design system rather than the admin UI's dense layout.

**Independent Test**: Load the landing page at mobile, tablet, and desktop viewport widths and confirm the description and session table (and its Register controls) remain legible, usable, and free of horizontal overflow or clipped content at each size; confirm a series with no description leaves no awkward gap.

### Tests for User Story 4 ⚠️

- [X] T041 [P] [US4] Add scenario to `src/frontend/e2e/public-series-landing.spec.ts` asserting the session table reflows into a mobile-friendly stacked/scrollable layout (no horizontal overflow, no clipped text, no unreachable controls) at a ~375px viewport
- [X] T042 [P] [US4] Add scenario to `src/frontend/e2e/public-series-landing.spec.ts` asserting the layout is free of horizontal overflow or clipped content at ~768px (tablet) and ~1280px+ (desktop) viewports
- [X] T043 [P] [US4] Add scenario to `src/frontend/e2e/public-series-landing.spec.ts` asserting a series with no description leaves no awkward gap or broken section at any supported viewport width

### Implementation for User Story 4

- [X] T044 [US4] Implement responsive session table styling in `src/frontend/components/public-series-landing.tsx` using Tailwind responsive utilities: a table layout on wider viewports, a stacked card list below the `sm:`/`md:` breakpoint
- [X] T045 [US4] Apply professional, modern public-facing styling (typography, spacing, color usage) to `src/frontend/components/public-series-landing.tsx` and `src/frontend/app/public/series/[id]/page.tsx` using existing Tailwind/Primer design tokens, visually distinct in tone from the authenticated admin UI

**Checkpoint**: All four user stories are independently functional; the feature is complete end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [X] T046 [P] Run `dotnet test tests/backend/EnableFront.Builder.Api.Tests/EnableFront.Builder.Api.Tests.csproj` from `src/backend` and confirm all new and existing tests pass
- [X] T047 [P] Run `npm run lint` and `npm run build` from `src/frontend` and confirm no new lint/build errors
- [ ] T048 [P] Run `npm run test:e2e -- e2e/public-series-landing.spec.ts` from `src/frontend` and confirm all scenarios pass
- [ ] T049 Execute the full quickstart.md validation checklist (backend + frontend) end-to-end and confirm every listed scenario behaves as documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. Acts as a **hard gate** for US2–US4: those stories' independent tests all require a series whose `IsPublic` value can be set to `true`/`false`, which only exists once US1's toggle and persistence are implemented.
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 (needs `IsPublic` settable to exercise on/off/not-found parity). Delivers the core anonymous read experience.
- **User Story 3 (Phase 5)**: Depends on Foundational + US1 + US2 (extends the session table US2 renders). Not independently testable without US2's page existing.
- **User Story 4 (Phase 6)**: Depends on Foundational + US1 + US2 (+ US3 for Register-control responsiveness). Purely a presentation/quality layer over US2/US3's existing markup.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

Unlike a typical spec-kit feature where user stories are fully independent, this feature has a linear dependency chain because each story builds directly on the previous one's UI surface (session table) and gating flag:

- **US1 (P1)**: No dependency on other stories (only Foundational). Independently testable via the admin toggle + API response alone.
- **US2 (P1)**: Requires US1's `IsPublic` flag to exist and be settable to test on/off/not-found parity.
- **US3 (P2)**: Requires US2's session table to exist to add Register controls to it.
- **US4 (P3)**: Requires US2's (and US3's) markup to exist to make it responsive/polished.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Backend DTOs/service before endpoints; endpoints before frontend page wiring.
- Core implementation before logging/polish additions.
- Story complete (and its Checkpoint validated) before moving to the next priority.

### Parallel Opportunities

- T002 and T003 (Setup baselines) can run in parallel.
- T009–T013 (US1 backend tests, same file `SeriesServiceTests.cs`/`SeriesDetailsApiContractTests.cs`) are logically parallel but touch shared files — treat as sequential edits to the same file in practice, or split across two developers working file-by-file.
- T017–T022 (US2 backend tests) and T023–T026 (US2 E2E tests) can run in parallel with each other (different files/languages).
- T032, T033, T034 (US2 frontend route files: `page.tsx`, `not-found.tsx`, `loading.tsx`) can run in parallel — different files.
- T036–T039 (US3 tests) can run in parallel with each other.
- T041–T043 (US4 tests) can run in parallel with each other.
- T046, T047, T048 (Polish validation runs) can run in parallel.

---

## Parallel Example: User Story 2

```bash
# Launch backend contract/unit tests for User Story 2 together:
Task: "GET /api/v1/public/series/{id} returns 200 with title/details/sessions when IsPublic == true"
Task: "GET /api/v1/public/series/{id} returns 404 identical shape when IsPublic == false"
Task: "GET /api/v1/public/series/{id} returns 404 identical shape when id does not exist"

# Launch new frontend route files for User Story 2 together:
Task: "Create app/public/series/[id]/page.tsx"
Task: "Create app/public/series/[id]/not-found.tsx"
Task: "Create app/public/series/[id]/loading.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (the gating toggle — required before anything is publicly reachable).
4. Complete Phase 4: User Story 2 (the anonymous view — the feature's core value).
5. **STOP and VALIDATE**: Confirm an owner can publish a series and an anonymous visitor can view it, with off/not-found parity holding.
6. Deploy/demo if ready — this is the smallest slice that delivers the feature's stated purpose.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → owner can toggle visibility (not yet publicly visible without US2).
3. US1 + US2 → MVP: anonymous visitors can view published series. Deploy/Demo.
4. + US3 → anonymous visitors can register from the page. Deploy/Demo.
5. + US4 → page is responsive and professionally styled. Deploy/Demo (feature complete).

### Team Strategy

Because US2 depends on US1, US3 depends on US2, and US4 depends on US2/US3, this feature is best delivered **sequentially by priority** rather than fully parallelized across developers, even though tasks within each story phase (marked `[P]`) can be split among team members.

---

## Notes

- `[P]` tasks = different files, no dependencies.
- `[Story]` label maps task to specific user story for traceability.
- This feature's user stories have a linear dependency chain (US1 → US2 → US3 → US4) rather than being fully independent; each Checkpoint should still be validated before proceeding to preserve incremental, demoable delivery.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Avoid: vague tasks, same-file conflicts, skipping the US1 gate before starting US2.
