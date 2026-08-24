# Data Model: Public Series Landing Page

## Series (updated)

Existing aggregate in `src/backend/Domain/Entities/Series.cs`.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `SeriesId` | `Guid` | yes | Existing UUID primary key; doubles as the public landing page route key (`/public/series/{SeriesId}`) |
| `OwnerUserId` | `string` | yes | Existing authorization boundary; unchanged, never returned by the public endpoint |
| `Title` | `string` | yes | Existing non-empty title rule; returned by the public endpoint verbatim |
| `Details` | `string?` | no | Existing sanitized constrained HTML; returned by the public endpoint verbatim when non-null, omitted when `null` |
| `IsPublic` | `bool` | yes | **NEW.** Defaults to `false` for every new and existing series. Gates whether the public landing page (and its data) is reachable. Editable only by a user with existing series edit permission, via the same save pattern as `Title`/`Details`. |
| `CreatedAt` | `DateTime` | yes | Unchanged |
| `UpdatedAt` | `DateTime` | yes | Updated on successful `IsPublic` toggle, same as other field saves |

### Storage mapping

Add non-nullable `bit` column `IsPublic` to `Series` with default `0`/`false`. Existing rows backfill
to `false` (no destructive migration; every pre-existing series remains private until an owner opts
in). No index required — the column is not used for filtering/sorting, only as a per-row boolean gate
checked on the single-row anonymous read.

### Rules

1. `IsPublic` defaults to `false` on `CreateAsync`; owners set it explicitly via `UpdateAsync`.
2. Toggling `IsPublic` follows the same authorization boundary as other series fields — only the
   `OwnerUserId` for that series (via existing `RequireAuthorization()` + ownership check in
   `SeriesService`) may change it.
3. Toggling takes effect immediately — no caching layer or propagation delay is introduced.
4. The value has no effect on any other stored field or existing behavior; it purely gates the new
   anonymous read path.

## Session (read-only projection, no schema change)

Existing aggregate in `src/backend/Domain/Entities/Session.cs`. No new fields are added to `Session`
by this feature — the public endpoint projects existing fields into a new response shape.

| Field (existing) | Exposed in public projection? | Notes |
|---|---:|---|
| `SessionId` | yes | Used as the table row key on the frontend; never used to construct a public route |
| `SeriesId` | no (implicit via the parent series being requested) | Not repeated per-row in the response |
| `OwnerUserId` | **no** | Owner-only; never exposed by the public endpoint |
| `Title` | yes | Rendered as the session's row title |
| `StartsAt` / `EndsAt` | yes | Rendered as the session's date/time; used to determine "already ended" for Register-control suppression (FR-013) |
| `RegistrationUrl` | yes, when non-null | Renders the Register control; omitted entirely when `null` (existing behavior, FR-006) |
| `Description` | out of scope for this feature | Spec does not require per-session description on the landing page table; not projected |

### Public projection DTOs (new)

- `PublicSeriesResponseDto(string Title, string? Details, IReadOnlyList<PublicSessionDto> Sessions)`
- `PublicSessionDto(Guid SessionId, string Title, DateTime StartsAt, DateTime EndsAt, string? RegistrationUrl)`

Neither DTO includes `SeriesId`, `OwnerUserId`, `IsPublic`, metrics, or any timestamp beyond session
schedule — satisfying FR-007/SC-005 (no owner-only data in the public response).

### Relationships and transitions

`Series` (1) → `Session` (many), unchanged existing relationship. The only new transition is
`Series.IsPublic`: `false → true` (owner publishes) and `true → false` (owner unpublishes), both via
the existing series update save path. No new entity is introduced.
