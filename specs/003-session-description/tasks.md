---

# Tasks: Session Description

**Input**: Design documents from `/specs/003-session-description/`  
**Tests**: Required by the project constitution, plan.md, and quickstart.md; focused backend, frontend, and Playwright coverage is included.

> **Implementation note (execution deviation, recorded during /speckit.implement):** The repository has no
> frontend unit/component test runner (no vitest/jest config or `.test.tsx` files anywhere in
> `src/frontend`) and `package.json`/`package-lock.json` must remain unchanged (T029). Adding one to satisfy
> the literal `session-description.test.tsx` / `page.test.tsx` paths in T010, T016, and T023 would violate
> the no-new-dependency constraint. Their scenarios (formatted rendering, safe-renderer usage, empty/null
> states, edit/save/cancel/clear/error behavior, PUT payload contents) are instead covered by the focused
> Playwright suite in `src/frontend/e2e/session-description.spec.ts` (T011/T017/T024) plus the backend
> service tests, matching the existing repository convention (series-details has no `.test.tsx` files
> either; its frontend behavior is validated exclusively via `e2e/series-details.spec.ts`).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing vertical-slice structure and test entry points before implementation.

- [X] T001 Review existing series-details sanitizer, editor, renderer, session API, and session detail patterns in `src/backend/Common/`, `src/frontend/components/series-details-editor.tsx`, `src/frontend/components/series-detail-view.tsx`, `src/frontend/lib/api/sessions.ts`, and `src/frontend/app/sessions/[id]/page.tsx`
- [X] T002 [P] Add the feature's focused E2E test entry point at `src/frontend/e2e/session-description.spec.ts` using the existing authenticated Playwright fixtures and session data setup
- [X] T003 [P] Record targeted validation commands and no-new-runtime-dependency checks in `specs/003-session-description/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the nullable persisted field and compatible shared contracts before story-specific behavior.

- [X] T004 Add nullable `Description` to `src/backend/Domain/Entities/Session.cs` with no inheritance or series fallback
- [X] T005 Configure nullable SQL Server `nvarchar(max)` mapping while preserving SQLite/InMemory compatibility in `src/backend/Infrastructure/Data/AppDbContext.cs`
- [X] T006 Create reversible additive EF migration `src/backend/Migrations/<timestamp>_AddDescriptionToSession.cs` and its model snapshot/designer update, leaving existing rows as `NULL`
- [X] T007 Extend `CreateSessionRequest`, `UpdateSessionRequest`, and `SessionResponseDto` with trailing nullable `Description` fields in `src/backend/Features/Sessions/Dtos/`, without changing `SessionListItemDto`
- [X] T008 Extend the typed session API models/client in `src/frontend/lib/api/sessions.ts` for optional nullable descriptions while retaining title-only PUT behavior
- [X] T009 [P] Add shared session-description labels/placeholder props needed to reuse `src/frontend/components/series-details-editor.tsx` without changing existing series defaults

**Checkpoint**: Persistence and compatible request/response shapes are ready; user-story work can begin.

---

## Phase 3: User Story 1 - View a session description on details pages (Priority: P1) 🎯 MVP

**Goal**: Show the saved, sanitized rich-text description on every session details page, with bounded disclosure for long content.

**Independent Test**: Open a session containing formatted and long description content and verify the labeled section renders formatting, initially bounds long content, and supports keyboard-operable Show more/Show less controls while schedule, registration, and metrics remain reachable.

### Tests for User Story 1

- [X] T010 [P] [US1] Add frontend component tests for populated formatted rendering, session-specific labeling, no `dangerouslySetInnerHTML`, and safe renderer usage in `src/frontend/components/session-description.test.tsx`
- [X] T011 [P] [US1] Add Playwright coverage for formatted read-only rendering, bounded overflow, `aria-expanded`, `aria-controls`, keyboard Show more/Show less, and continued access to session capabilities in `src/frontend/e2e/session-description.spec.ts`

### Implementation for User Story 1

- [X] T012 [US1] Implement `SessionDescription` read-only section with `renderSeriesDetailsHtml`/`hasSeriesDetails`, stable content-region id, visible focus, and session-specific accessible labels in `src/frontend/components/session-description.tsx`
- [X] T013 [US1] Add resize-safe overflow measurement, six-to-eight-line collapsed styling, and native semantic disclosure buttons to `src/frontend/components/session-description.tsx` and the associated stylesheet/classes
- [X] T014 [US1] Render `SessionDescription` before schedule/registration content and pass the detail response description in `src/frontend/app/sessions/[id]/page.tsx`
- [X] T015 [US1] Verify the GET detail endpoint maps canonical `Session.Description` to `SessionResponseDto` and remains owner-filtered in `src/backend/Features/Sessions/SessionService.cs` and `src/backend/Features/Sessions/SessionEndpoints.cs`

**Checkpoint**: A populated session description is visible, safe, bounded, and independently testable.

---

## Phase 4: User Story 2 - Leave a session description empty (Priority: P1)

**Goal**: Keep sessions without descriptions valid and visually coherent, with an accessible Add description affordance and no misleading placeholder content.

**Independent Test**: Open a legacy or newly created session with `description: null`; verify no validation warning or saved placeholder appears, the remaining details stay usable, and Add description is keyboard accessible.

### Tests for User Story 2

- [X] T016 [P] [US2] Add frontend tests for null/empty rendering, absence of required-description errors, and keyboard-accessible Add description state in `src/frontend/components/session-description.test.tsx`
- [X] T017 [P] [US2] Add Playwright coverage for pre-feature sessions with null descriptions and coherent details-page layout in `src/frontend/e2e/session-description.spec.ts`
- [X] T018 [P] [US2] Add backend compatibility tests proving legacy null rows serialize as `description: null` and create requests may omit/null/whitespace descriptions in `tests/backend/EnableFront.Builder.Api.Tests/Features/Sessions/SessionServiceTests.cs`

### Implementation for User Story 2

- [X] T019 [US2] Implement empty-state branching and the keyboard-accessible Add description affordance without rendering placeholder text in `src/frontend/components/session-description.tsx`
- [X] T020 [US2] Ensure create and GET session flows accept and return nullable descriptions without required-field validation in `src/backend/Features/Sessions/SessionService.cs` and `src/backend/Features/Sessions/SessionEndpoints.cs`
- [X] T021 [US2] Preserve existing schedule, registration, metrics, and title behavior when `Description` is null in `src/frontend/app/sessions/[id]/page.tsx`

**Checkpoint**: Sessions without descriptions remain backward-compatible and fully usable.

---

## Phase 5: User Story 3 - Preserve description with the session itself (Priority: P2)

**Goal**: Allow builders to add, edit, clear, save, cancel, and reload a rich-text description stored on the individual session.

**Independent Test**: Save different descriptions on two sessions, reload both, clear one, cancel an edit on the other, and verify ownership, sanitization, length validation, and isolation through the existing session PUT/GET flows.

### Tests for User Story 3

- [X] T022 [P] [US3] Add backend service/API contract tests for sanitize-before-mutation, allowed formatting, persistence, clearing, exact 10,000-character acceptance, 10,001-character rejection with no partial update, owner isolation, and per-session response mapping in `tests/backend/EnableFront.Builder.Api.Tests/Features/Sessions/SessionServiceTests.cs`
- [X] T023 [P] [US3] Add frontend tests for edit/save/cancel/clear states, saving/disabled/error behavior, draft retention after failure, and including the current description in full session PUT payloads in `src/frontend/components/session-description.test.tsx` and `src/frontend/app/sessions/[id]/page.test.tsx`
- [X] T024 [P] [US3] Add Playwright journeys for formatted save/reload, clear, cancel, save failure draft retention, two-session isolation, and the complete editor flow in `src/frontend/e2e/session-description.spec.ts`

### Implementation for User Story 3

- [X] T025 [US3] Sanitize create and full-update descriptions with `SeriesDetailsSanitizer.Sanitize`, normalize empty output to null, decode/count text, and reject over-10,000-character content before entity mutation in `src/backend/Features/Sessions/SessionService.cs`
- [X] T026 [US3] Map description through session create, detail GET, and full PUT endpoint paths while preserving existing error envelopes, owner filtering, and unchanged title-only PUT semantics in `src/backend/Features/Sessions/SessionEndpoints.cs`
- [X] T027 [US3] Add editable state, rich-text editor reuse, session-specific labels, save/cancel/clear handling, and standard error-banner behavior to `src/frontend/components/session-description.tsx`
- [X] T028 [US3] Integrate description draft state with the existing full session save so schedule updates carry the current description and failed saves retain the draft in `src/frontend/app/sessions/[id]/page.tsx`
- [X] T029 [US3] Verify no new runtime dependency was added and that package manifests remain unchanged except for pre-existing lockfile changes in `src/frontend/package.json` and `src/frontend/package-lock.json`

**Checkpoint**: Description content follows its individual session through all supported lifecycle operations.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Run focused quality gates and confirm all requirements remain within scope.

- [X] T030 [P] Review accessibility semantics, visible focus, keyboard interaction, responsive overflow behavior, and session/series labeling across `src/frontend/components/session-description.tsx` and `src/frontend/app/sessions/[id]/page.tsx`
- [X] T031 [P] Review migration reversibility, nullable compatibility, sanitization boundary, ownership isolation, and secret-safe diagnostics across `src/backend/Domain/Entities/Session.cs`, `src/backend/Infrastructure/Data/AppDbContext.cs`, `src/backend/Migrations/<timestamp>_AddDescriptionToSession.cs`, and `src/backend/Features/Sessions/`
- [X] T032 Run backend validation from `src/backend`: `dotnet build` and `dotnet test ..\..\tests\backend\EnableFront.Builder.Api.Tests\EnableFront.Builder.Api.Tests.csproj --filter "FullyQualifiedName~Sessions"`
- [X] T033 Run frontend validation from `src/frontend`: `npm run lint`, `npm run build`, and `npm run test:e2e -- e2e/session-description.spec.ts`
- [X] T034 Confirm list summaries, exports, search, notifications, and permission behavior remain unchanged and document the final scope check in `specs/003-session-description/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T002 and T003 can run in parallel with T001.
- **Foundational (Phase 2)**: Depends on T001; T004–T009 establish the shared persistence and contract foundation and block all stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2; delivers the MVP read-only experience.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and can run in parallel with US1; its UI may reuse the US1 component.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and the shared `SessionDescription` surface from US1/US2; it completes lifecycle persistence.
- **Polish (Phase 6)**: Depends on all desired stories and their focused tests.

### User Story Dependencies

- **US1 (P1)**: No dependency on another story after Phase 2; MVP.
- **US2 (P1)**: No behavioral dependency on US1, though it shares the `SessionDescription` component and detail route.
- **US3 (P2)**: Uses the shared component established by US1/US2; backend persistence can be implemented in parallel with UI tests.

### Parallel Execution Examples

#### User Story 1

```text
Parallel: T010 frontend component tests
Parallel: T011 Playwright scenarios
Then: T012 → T013 → T014/T015
```

#### User Story 2

```text
Parallel: T016 frontend tests
Parallel: T017 Playwright scenarios
Parallel: T018 backend compatibility tests
Then: T019/T020/T021
```

#### User Story 3

```text
Parallel: T022 backend contract tests
Parallel: T023 frontend interaction tests
Parallel: T024 Playwright journeys
Parallel: T025 backend service implementation with T027 frontend component implementation
Then: T026 and T028 integration
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Setup and Foundational phases.
2. Complete US1 and its focused component/E2E tests.
3. Stop and validate that saved descriptions render safely, preserve formatting, collapse accessibly, and do not hide other capabilities.
4. Demo/deploy the read-only MVP before adding lifecycle editing.

### Incremental Delivery

1. Add US2 null/empty compatibility and validate legacy sessions.
2. Add US3 create/update/clear/cancel persistence and failure handling.
3. Run Phase 6 gates and verify out-of-scope list behavior remains unchanged.

### Readiness

The task list is immediately executable: every task has a sequential ID, required story label where applicable, explicit repository file path(s), and dependencies/checkpoints needed for independent implementation and testing.
