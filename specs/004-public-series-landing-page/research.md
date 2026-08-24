# Phase 0 Research: Public Series Landing Page

All items from the spec's Technical Context were resolvable directly from the existing codebase and
constitution; no open NEEDS CLARIFICATION items remain.

## Decision: Visibility gate is a boolean `IsPublic` column on `Series`

- **Decision**: Add `public bool IsPublic { get; set; } = false;` to `Domain/Entities/Series.cs`,
  default `false`, migrated via EF Core.
- **Rationale**: Spec FR-014 requires an on/off setting defaulting to off; the simplest, most
  maintainable representation consistent with existing `Series` fields (`Title`, `Details`) is a plain
  boolean column, edited the same way `Title`/`Details` already are (via `PUT /api/v1/series/{id}`).
- **Alternatives considered**: A separate `SeriesVisibility` table/entity — rejected as unnecessary
  indirection for a single boolean with no history/audit requirement in the spec (YAGNI, per
  Constitution I).

## Decision: Anonymous read path is a separate, unauthenticated endpoint group

- **Decision**: New `MapGroup("/api/v1/public/series")` (no `.RequireAuthorization()`) in a new
  `Features/Series/Public/PublicSeriesEndpoints.cs`, distinct from the existing authenticated
  `Features/Series/SeriesEndpoints.cs` group.
- **Rationale**: Keeps the authenticated group's `RequireAuthorization()` simple and impossible to
  accidentally weaken; isolates the security-sensitive anonymous surface into its own small, reviewable
  file/service, matching the repo's existing "vertical feature slice" convention (e.g.,
  `Features/Sessions`, `Features/Series`).
- **Alternatives considered**: Adding an `[AllowAnonymous]`-equivalent override on the existing
  `GET /api/v1/series/{id}` route — rejected because ASP.NET Core minimal API group-level
  `RequireAuthorization()` makes per-route anonymous overrides easy to misconfigure and harder to audit
  than a fully separate group with its own DTOs that guarantee no owner-only field can leak.

## Decision: "Off" and "not found" return identical response shape

- **Decision**: `PublicSeriesService.GetPublicSeriesAsync` returns `null` both when no series exists
  for the id and when `series.IsPublic == false`; the endpoint always maps `null` to the same
  `Results.NotFound(new ErrorEnvelope("series_not_found", ...))` shape already used by the existing
  authenticated `GET /api/v1/series/{id}` for a missing series.
- **Rationale**: Directly satisfies FR-008/FR-016/SC-004/SC-005 (no signal distinguishing "doesn't
  exist" from "exists but private").
- **Alternatives considered**: A distinct `403 Forbidden` for "exists but off" — rejected explicitly by
  the spec (FR-016 requires the identical not-found response).

## Decision: Public page is a new Next.js route tree, not a query param on the admin page

- **Decision**: `app/public/series/[id]/page.tsx` (server component, fetches from the new anonymous
  endpoint), with sibling `not-found.tsx` and `loading.tsx`.
- **Rationale**: The existing authenticated `app/series/[id]/page.tsx` is wrapped by the app's
  authenticated layout/providers (next-auth session, admin nav). A new route under `app/public/` keeps
  the anonymous experience free of any accidental auth-gated layout wrapping and matches the existing
  `app/login`/`app/about` pattern of top-level, purpose-specific route segments.
- **Alternatives considered**: Reusing `app/series/[id]/page.tsx` with an anonymous-mode branch —
  rejected because Next.js App Router layouts inherited from `app/series/` may assume an authenticated
  session (e.g., `app-header.tsx`/`user-menu.tsx`), risking accidental exposure of admin chrome or
  session-dependent calls on a page that must work with zero auth context.

## Decision: Reuse existing rich-text rendering and design system

- **Decision**: Render `Details` using the existing `lib/series-details-html.tsx` sanitized-HTML
  rendering helper already used by `components/series-details.tsx`; style the new page with existing
  Tailwind/Primer tokens.
- **Rationale**: FR-003 requires the same formatting support already implemented; FR-011 requires
  reusing the existing design system rather than inventing a new one. Directly satisfies Constitution
  III (shared UI patterns reused, not ad hoc).
- **Alternatives considered**: A new lightweight markdown renderer for the public page — rejected as
  duplicate logic for content that is already sanitized/stored as the same HTML subset.

## Decision: Session table responsiveness via existing Tailwind responsive utilities

- **Decision**: Implement the session list as a table on wider viewports and a stacked card list below
  a Tailwind `sm:`/`md:` breakpoint, using the same responsive utility approach already used elsewhere
  in the frontend (Tailwind CSS v4 is already the approved stack).
- **Rationale**: Satisfies FR-010/SC-003 without introducing a new UI library or custom breakpoint
  system.
- **Alternatives considered**: A third-party responsive table component — rejected; no new runtime
  dependency is justified per constitution's "No new runtime dependency may be introduced without
  explicit product and review justification."
