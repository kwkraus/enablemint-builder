# Public Series Landing Page Quickstart

## Prerequisites

- .NET 10 SDK and Node.js/npm installed.
- Repository dependencies restored.
- Configured backend database/test settings; no authenticated session is needed for the anonymous
  E2E scenarios, but an authenticated local session is needed for the admin-toggle scenarios.

## Backend validation

From `src/backend`:

```powershell
dotnet build
dotnet test ..\..\tests\backend\EnableFront.Builder.Api.Tests\EnableFront.Builder.Api.Tests.csproj
```

Verify tests cover:

1. `GET /api/v1/public/series/{id}` returns `200` with title/details/sessions when `IsPublic == true`.
2. The same endpoint returns `404` (identical `series_not_found` shape) when `IsPublic == false`.
3. The same endpoint returns `404` (identical shape) when `id` does not match any series.
4. The response never contains `ownerUserId`, `seriesId`, `isPublic`, or metrics fields.
5. Sessions with no `RegistrationUrl` are present in `sessions[]` with `registrationUrl: null`.
6. `PUT /api/v1/series/{id}` persists `isPublic` and returns it in `SeriesResponseDto`; a non-owner
   caller cannot change it (existing ownership check).
7. New series default `IsPublic` to `false`; apply the generated EF migration through the normal
   deployment pipeline, not automatic startup migrations (existing project convention).

## Frontend validation

From `src/frontend`:

```powershell
npm run lint
npm run build
npm run test:e2e -- e2e/public-series-landing.spec.ts
```

Verify these user flows:

1. **Anonymous view (P1)**: With no auth cookie set, navigating to `/public/series/{id}` for a public
   series renders the title, formatted details, and a session table without any sign-in redirect.
2. **Empty details**: A public series with no `Details` renders the page without an empty/broken
   description section.
3. **Empty sessions**: A public series with zero sessions shows the neutral "no sessions scheduled
   yet" message instead of an empty table.
4. **Not found parity**: Both a nonexistent `id` and a real-but-private (`IsPublic == false`) `id`
   render the same generic not-found page.
5. **Register control (P2)**: A session row with a `registrationUrl` shows a Register control that
   opens the destination in a new tab; a row without one shows no control.
6. **Ended session**: A session whose `EndsAt` is in the past appears in the table without an active
   Register control, even if it has a `registrationUrl`.
7. **Responsive layout (P3)**: At mobile (~375px), tablet (~768px), and desktop (~1280px+) viewport
   widths, the session table reflows without horizontal overflow or clipped content.
8. **Admin toggle**: An owner can see and flip the `IsPublic` toggle on the existing admin series page;
   a non-owner cannot see or use it; toggling takes effect on the very next anonymous request.

> **Known local/E2E consideration**: `app/public/series/[id]/page.tsx` is a Server Component fetching
> from the backend on the Node side (same pattern as `app/series/[id]/page.tsx`, see
> `specs/001-series-details/quickstart.md`). Scenarios requiring specific pre-seeded series/session
> data on first load need a real or stubbed backend reachable at `BACKEND_API_BASE_URL` (default
> `http://localhost:5187`); this is a pre-existing project constraint, not introduced by this feature.
