# Feature Specification: Public Series Landing Page

**Feature Branch**: `kwkraus-series-landing-page-spec`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "I want to create a public landing page for a series that describes the series itself and a table that lists all of the sessions and a registration link that allows anonymous users to register through the link. The page needs to be anonymous and I want the route to be the ID of the series that is currently a GUID which will make it obfuscated. I want the landing page to be professional looking, well laid out, and modern, including mobile friendly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Series owner turns the public landing page on or off (Priority: P1)

A series owner, managing their series through the existing admin interface, sees a clearly labeled
control (e.g., a toggle) for making the series' public landing page available. New series default to
this being off — the public landing page is not reachable until the owner deliberately turns it on.
Once turned on, the owner can share the landing page URL; if they turn it off again, the page stops
being publicly reachable.

**Why this priority**: This is the gating control for the entire feature — every other story (viewing
the page, registering, mobile layout) only matters once an owner has explicitly made a series public.
Defaulting to off protects series owners from accidentally exposing a series before they intend to.

**Independent Test**: Can be fully tested by creating a new series (confirming the public landing page
is unreachable by default), turning the control on and confirming the landing page becomes reachable,
then turning it off and confirming the landing page becomes unreachable again.

**Acceptance Scenarios**:

1. **Given** a newly created series, **When** the owner has not changed anything, **Then** the series'
   public landing page is off by default and is not reachable by anonymous visitors.
2. **Given** a series with the public landing page off, **When** the owner turns it on from the admin
   interface, **Then** the change is saved and the public landing page immediately becomes reachable
   by anonymous visitors.
3. **Given** a series with the public landing page on, **When** the owner turns it off, **Then** the
   change is saved and the public landing page immediately stops being reachable — anonymous requests
   receive the same generic not-found response used for a nonexistent series.
4. **Given** the owner is viewing the series in the admin interface, **When** they look at the public
   landing page control, **Then** its current on/off state is clearly and accurately displayed.
5. **Given** a user without edit permission on the series, **When** they view the series in the admin
   interface, **Then** they cannot see or use the control to change the public landing page's on/off
   state (existing series edit permissions govern this control, consistent with other series settings).

---

### User Story 2 - Anonymous visitor views a series landing page (Priority: P1)

An anonymous visitor (no sign-in) receives a link to a series — for example `/series/{seriesId}` where
`seriesId` is the series' GUID — and opens it in a browser. Without authenticating, they see the
series title, its formatted description/outcomes, and a table listing every session in the series
(name, date/time, and a way to register). This is the entire value of the feature: a shareable,
public page that explains the series and lets someone register for a session without ever logging in
or navigating the authenticated app.

**Why this priority**: Without an anonymous, working page at a stable URL, there is no feature —
everything else is refinement of this one page.

**Independent Test**: Can be fully tested by opening the landing page URL for a known series in a
private/incognito browser window (no session cookie) and confirming the series title, description,
and session table render without any sign-in prompt or redirect.

**Acceptance Scenarios**:

1. **Given** a published series with a valid `seriesId`, **When** an unauthenticated visitor navigates
   to that series' public landing page URL, **Then** the page loads successfully and displays the
   series title and description without requiring sign-in.
2. **Given** the same public landing page, **When** it finishes loading, **Then** a table lists every
   session belonging to the series, each row showing at minimum the session title and its date/time.
3. **Given** a series whose `Details` field is empty, **When** the public landing page loads, **Then**
   the page still renders cleanly with the title and session table, omitting the description section
   entirely rather than showing an empty block.
4. **Given** the public landing page route, **When** it is requested by any client without an
   authentication token or session cookie, **Then** the backend serves the response the same as it
   would for an authenticated request — no login redirect, no 401/403.

---

### User Story 3 - Anonymous visitor registers for a session from the landing page (Priority: P2)

From the session table on the landing page, a visitor finds a session they want to attend and
activates its registration control, which takes them to that session's external registration
destination (the same registration URL already stored on the session) to complete sign-up — without
ever needing an Enablemint Builder account.

**Why this priority**: Viewing the series (P1) delivers informational value on its own, but the
explicit ask is a page that lets anonymous users register, so this closes the loop and is the second
most critical slice.

**Independent Test**: Can be fully tested by opening the landing page, locating a session row that has
a registration link, activating it, and confirming it opens the correct external registration
destination in a new tab while the landing page remains open.

**Acceptance Scenarios**:

1. **Given** a session in the table has a stored registration URL, **When** the visitor activates that
   session's Register control, **Then** the registration destination opens in a new browser tab and
   the landing page remains available in the original tab.
2. **Given** a session in the table has no stored registration URL, **When** the visitor views that
   row, **Then** no broken, disabled, or empty Register control is shown for that session — the row
   simply omits it.
3. **Given** the visitor is not signed in, **When** they activate a session's Register control,
   **Then** no Enablemint Builder authentication step is introduced before reaching the external
   registration destination.

---

### User Story 4 - Landing page looks professional and works on mobile (Priority: P3)

A visitor opens the landing page link on a phone (shared via email, chat, or social media) as easily
as on a desktop browser. The layout adapts to the smaller screen: the series description remains
readable, and the session table becomes a stacked/scrollable layout instead of a cramped, unreadable
grid, while still looking like a polished, modern product page rather than an internal admin screen.

**Why this priority**: This is a quality bar on top of Stories 1 and 2 rather than new capability —
the page already works functionally without it, but a public-facing, shareable page is judged
primarily on first impression and mobile usability.

**Independent Test**: Can be fully tested by loading the landing page at common mobile, tablet, and
desktop viewport widths and confirming the description and session table (and its Register controls)
remain legible, usable, and free of horizontal overflow or clipped content at each size.

**Acceptance Scenarios**:

1. **Given** the landing page is opened on a narrow mobile viewport, **When** the session table would
   otherwise overflow horizontally, **Then** it reflows into a mobile-friendly layout (e.g., stacked
   cards or a scrollable table) with no clipped text or unreachable controls.
2. **Given** the landing page is opened on desktop, tablet, and mobile viewports in turn, **When**
   compared side by side, **Then** typography, spacing, and color usage are visually consistent with a
   professional, modern public web page rather than the authenticated admin UI's dense layout.
3. **Given** the landing page has no series description, **When** viewed at any supported viewport
   width, **Then** the layout does not leave an awkward gap or broken section where the description
   would have been.

---

### Edge Cases

- What happens when the `seriesId` in the URL does not correspond to any existing series? The page
  shows a generic "not found" state (no series details leaked, no stack trace) rather than an error
  page that reveals internal information.
- What happens when the `seriesId` in the URL corresponds to a real series whose public landing page
  is turned off? The page shows the exact same generic "not found" state as a nonexistent series —
  visitors cannot distinguish "no such series" from "series exists but isn't public."
- What happens when an owner turns the public landing page off while a visitor already has it open in
  a browser tab? The already-open page is not force-closed by this feature; the next time it (or its
  data) is requested, it is treated as not found.
- What happens when a series exists but has zero sessions? The page still renders the series title and
  description, and the session table area shows a neutral "no sessions scheduled yet" message instead
  of an empty table or error.
- What happens when a session has already ended? It still appears in the table (visitors sharing the
  link may want to see past program history), but its Register control is omitted or clearly
  non-actionable rather than inviting registration for a session that has already occurred.
- What happens when a session has no registration URL at all? Its row shows no Register control (same
  behavior as authenticated views today), so visitors aren't misled into thinking registration is
  possible for that session.
- How does the system handle very long series titles/descriptions or many sessions? The layout wraps
  text and the table scrolls or paginates rather than breaking the page layout.
- What happens if someone tries to reach admin-only actions (edit series, edit session) from this
  page? No such controls are present or reachable — the page is strictly read-only and registration
  link-only for anonymous visitors.
- What happens when the same landing page URL is requested repeatedly (e.g., shared widely on social
  media)? It continues to serve the same public, read-only content with no rate limiting or
  authentication introduced by this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a public landing page for a series at a route keyed by the
  series' existing GUID identifier (`seriesId`), with no additional slug or vanity identifier
  introduced by this feature.
- **FR-002**: The public landing page and the data it needs (series title, description, and its
  sessions with their registration URLs) MUST be reachable without authentication — no sign-in
  redirect, session cookie, or bearer token is required to view it — but only when the series' public
  landing page has been turned on (see FR-014).
- **FR-014**: Each series MUST support an on/off setting controlling whether its public landing page is
  publicly reachable, defaulting to off for every series (including existing series at the time this
  feature ships and every newly created series thereafter).
- **FR-015**: A user with edit permission on the series MUST be able to view and change this on/off
  setting from the existing admin interface; users without edit permission on the series MUST NOT be
  able to view or change it, consistent with existing series edit permissions (e.g., series title
  editing).
- **FR-016**: When a series' public landing page setting is off, requests to that series' public
  landing page route (and its underlying data) MUST receive the same generic "not found" response used
  for a `seriesId` that does not exist (FR-008), so visitors cannot distinguish "off" from
  "nonexistent."
- **FR-017**: Turning the public landing page on or off MUST take effect immediately for subsequent
  requests — no delay, caching window, or additional confirmation step beyond the normal series save
  behavior.
- **FR-003**: The public landing page MUST display the series title and, when present, its formatted
  `Details` description with the same rich-text formatting (bullets, bold, italic, underline) already
  supported for series details; when `Details` is empty, the description section MUST be omitted
  entirely.
- **FR-004**: The public landing page MUST display a table (or equivalent structured list) of every
  session belonging to the series, showing at minimum each session's title and start date/time.
- **FR-005**: For each session that has a stored registration URL, the table MUST present a Register
  control that opens the registration destination in a new browser tab, leaving the landing page open
  in its original tab.
- **FR-006**: For each session that has no stored registration URL, the table MUST omit the Register
  control entirely for that row rather than showing it disabled or empty.
- **FR-007**: The public landing page MUST NOT expose any owner-only or authenticated-only data or
  actions (e.g., session/series edit controls, internal metrics, owner identity) — it is strictly a
  read-only, registration-link-only surface.
- **FR-008**: When the requested `seriesId` does not correspond to an existing series, the system MUST
  respond with a generic "not found" page state and MUST NOT leak information about whether a series
  ID is valid versus simply inaccessible.
- **FR-009**: When a series has no sessions, the landing page MUST render the series title/description
  normally and show a neutral empty-state message in place of the session table.
- **FR-010**: The public landing page layout MUST be responsive: it MUST remain fully readable and
  usable (no horizontal overflow, no clipped text, no unreachable controls) at common mobile, tablet,
  and desktop viewport widths.
- **FR-011**: The public landing page MUST be visually distinct from the authenticated admin UI in
  tone — professional, modern, marketing-appropriate styling — while reusing the product's existing
  design system (colors, typography, components) rather than introducing an unrelated visual identity.
- **FR-012**: The public landing page route MUST NOT require or accept any series/session mutation —
  it is a read path only; no create, update, or delete operation is reachable from it.
- **FR-013**: Sessions that have already ended MUST still appear in the session table, but MUST NOT
  present an active Register control implying registration is still possible.

### Key Entities *(include if feature involves data)*

- **Series**: The existing series entity (`SeriesId`, `Title`, `Details`), gaining one new attribute —
  an on/off setting (e.g., `IsPublic`, defaulting to off/`false`) controlling whether its public
  landing page is reachable. This feature otherwise exposes existing title/details data through a new
  anonymous read surface.
- **Session**: The existing session entity (`SessionId`, `SeriesId`, `Title`, `StartsAt`, `EndsAt`,
  `RegistrationUrl`, `Description`). This feature adds no new attributes; it exposes existing
  title/schedule/registration data for sessions belonging to the requested series through the same new
  anonymous read surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An anonymous visitor with only the series landing page URL can view the series
  description and full session list within 3 seconds on a typical broadband connection, with zero
  authentication prompts.
- **SC-002**: 100% of sessions with a stored registration URL present a working Register control that
  opens the correct destination in a new tab; 100% of sessions without one show no Register control.
- **SC-003**: The landing page renders without horizontal overflow, clipped content, or unusable
  controls at mobile (≈375px), tablet (≈768px), and desktop (≈1280px+) viewport widths.
- **SC-004**: Requests for a non-existent `seriesId`, and requests for a real `seriesId` whose public
  landing page is off, both return the identical generic not-found state in 100% of cases, with no
  internal error details or stack traces surfaced.
- **SC-006**: 100% of newly created series and 100% of series that existed before this feature default
  to the public landing page being off, verified by attempting to reach each one's landing page before
  any owner action.
- **SC-007**: An owner can turn a series' public landing page on or off from the admin interface in
  under 10 seconds, with the change taking effect for the very next public request.
- **SC-005**: No owner-only data (internal metrics, owner identity, edit affordances) is present in the
  public landing page's rendered output or underlying API response, verified across all series states
  (with/without description, with/without sessions).

## Assumptions

- The obfuscation requirement is satisfied by keying the route on the series' existing GUID
  (`SeriesId`); no new short-lived token, slug, or separate "public ID" is introduced. A GUID is
  effectively unguessable, so no additional access-control mechanism (e.g., password, expiring link)
  is required for this feature.
- "Public" and "anonymous" mean that, once an owner turns a series' public landing page on, its page
  and backing data become reachable by anyone with the URL — no further access control (password,
  expiring link, allow-list) is layered on top for this feature. The on/off setting itself is the
  publish/unpublish control; no separate "publish" mechanism is introduced.
- The on/off setting is a simple boolean stored on the series and edited the same way other series
  settings are edited (inline save with error banner on failure), consistent with existing series field
  editing patterns; no scheduling (e.g., "publish on this date") or approval workflow is introduced.
- The session table displays all sessions for the series regardless of whether they are past, current,
  or upcoming, matching the existing "series details" session list behavior; past sessions are shown
  for context but without an actionable Register control.
- Registration behavior mirrors the existing authenticated Registration Link behavior (FR-010 in
  specs/002-session-registration-url): opens in a new tab, no reachability validation performed by
  this product.
- The series description reuses the existing sanitized rich-text `Details` field and its existing
  supported formatting (bullets, bold, italic, underline); no new formatting capability is introduced.
- No new data fields are required on Series or Session; this feature is purely a new anonymous
  read/display surface over existing data.
- Styling reuses the existing Next.js/Tailwind/Primer-based design system already used elsewhere in
  the product, adapted for a public marketing-style presentation rather than the authenticated admin
  layout.
- Session capacity, waitlisting, and confirmation flows are handled entirely by the external
  registration destination; this feature only links out to that destination and tracks nothing about
  registration outcomes.
