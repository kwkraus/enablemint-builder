# Research: Session Description

## Decision 1: Reuse the existing rich-text sanitizer

**Decision:** Call `SeriesDetailsSanitizer.Sanitize` from `SessionService` for create and full
update operations. Persist its canonical HTML and reject values whose decoded text exceeds 10,000
characters.

**Rationale:** The sanitizer is already in `src/backend/Common`, is stateless, strips attributes and
unsafe tags, canonicalizes aliases, and defines the product-standard formatting allow-list
(`p`, `br`, `ul`, `li`, `strong`, `em`, `u`). Reuse guarantees series/session consistency and avoids
a new dependency or divergent security behavior.

**Alternatives considered:** A second session-specific sanitizer would duplicate security-sensitive
logic. A client-only sanitizer is not an authority boundary. Renaming the shared class is unnecessary
scope for this feature.

## Decision 2: Persist on the existing Session resource

**Decision:** Add nullable `Session.Description`, map it to nullable SQL Server `nvarchar(max)`, and
add a reversible `AddDescriptionToSession` EF migration. Existing rows receive `NULL`.

**Rationale:** The description belongs to one session and must follow it across detail loads. Existing
session POST, GET, and PUT endpoints already enforce owner filtering and provide the correct
authorization/error conventions. A child table or separate endpoint adds joins and API surface
without a requirement.

**Alternatives considered:** A separate content table, PATCH endpoint, or list payload field were
rejected as unnecessary and/or over-fetching. The title-only PUT remains title-only.

## Decision 3: Extend DTOs without changing list behavior

**Decision:** Add optional nullable `Description` to `CreateSessionRequest`, `UpdateSessionRequest`,
and `SessionResponseDto`. Do not add it to `SessionListItemDto`.

**Rationale:** The detail page needs the value and full PUT must preserve it; list summaries do not
render descriptions and should remain bounded. Trailing optional record parameters preserve JSON
compatibility for existing clients and pre-feature sessions.

## Decision 4: Reuse the series editor and safe renderer

**Decision:** Add a focused `SessionDescription` component that reuses
`SeriesDetailsEditor` and `renderSeriesDetailsHtml`/`hasSeriesDetails`, passing session-specific
labels and placeholder text through the smallest required prop additions.

**Rationale:** This copies the proven empty/read-only/edit/save/cancel/error behavior without a new
editor package. The server remains authoritative; the renderer avoids `dangerouslySetInnerHTML`.

**Alternatives considered:** A full generic rich-text refactor or third-party editor/collapse package
would increase scope and violate the no-new-runtime-dependency constraint.

## Decision 5: Bounded disclosure for long descriptions

**Decision:** The session description read-only content is collapsed by default when it exceeds the
chosen visual bound (target six-to-eight lines), with a native semantic button labeled “Show more…”
and “Show less…”. The button uses `aria-expanded`, `aria-controls`, keyboard activation, and a
contextual accessible name; the content region has a stable id and session-description label.
Overflow detection uses layout measurement with a resize-safe effect and only renders the control
when content actually overflows.

**Rationale:** This directly implements the accepted clarification and FR-010/FR-011 while keeping
other session capabilities reachable. CSS line clamping plus local React state needs no dependency.

**Risks:** Exact line height and browser overflow timing require Playwright coverage and a resize/
requestAnimationFrame measurement strategy. If measurement proves unreliable, retain a conservative
always-available disclosure control for non-empty content rather than allowing viewport-blocking
content.

## Decision 6: Verification strategy

**Decision:** Extend session service/API tests for sanitization, persistence, clearing, length
rejection, ownership, and backward-compatible nulls. Add Playwright scenarios for empty state,
formatted save/reload, clear/cancel, isolation, save failure, bounded overflow, and keyboard
Show more/Show less behavior. Run targeted backend tests, frontend lint/build, and targeted E2E.

**Rationale:** These checks map directly to all user stories, FR-001–FR-011, and constitution quality
gates without broad unrelated regression work.

