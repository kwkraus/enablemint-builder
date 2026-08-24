# API Contract: Public Series Landing Page

## `GET /api/v1/public/series/{id}`

Anonymous (no `Authorization` header required, no session cookie honored/required). New unauthenticated
endpoint group, separate from the existing `/api/v1/series` authenticated group.

### Request

| Part | Field | Type | Notes |
|---|---|---|---|
| Path | `id` | `Guid` | The series' existing `SeriesId`, used verbatim as the obfuscated public identifier. |

No query parameters, no request body, no headers required.

### Responses

#### `200 OK` — series exists and `IsPublic == true`

```json
{
  "title": "Modern Web Fundamentals",
  "details": "<p>Learn the essentials of building <strong>modern</strong> web apps.</p><ul><li>Outcome one</li></ul>",
  "sessions": [
    {
      "sessionId": "b7e1c2a0-....",
      "title": "Session 1: Getting Started",
      "startsAt": "2026-09-10T17:00:00Z",
      "endsAt": "2026-09-10T18:00:00Z",
      "registrationUrl": "https://teams.microsoft.com/registration/..."
    },
    {
      "sessionId": "d4f9a311-....",
      "title": "Session 2: Advanced Patterns",
      "startsAt": "2026-09-17T17:00:00Z",
      "endsAt": "2026-09-17T18:00:00Z",
      "registrationUrl": null
    }
  ]
}
```

- `details` is `null`/omitted-equivalent when the series has no `Details`.
- `sessions` is `[]` when the series has zero sessions (frontend renders the empty-state message,
  FR-009).
- `registrationUrl` is `null` for sessions with no stored registration URL (FR-006) — the frontend
  omits the Register control entirely for that row.
- No `ownerUserId`, `seriesId`, `isPublic`, or metrics field is present anywhere in this shape
  (FR-007, SC-005).

#### `404 Not Found` — series does not exist **or** `IsPublic == false`

```json
{
  "errorCode": "series_not_found",
  "message": "Series not found.",
  "correlationId": "0HN..."
}
```

Identical shape and content for both cases (FR-008, FR-016, SC-004) — the response MUST NOT reveal
whether a matching series exists but is private.

### Authorization

None. This endpoint MUST NOT be added to the existing `MapGroup("/api/v1/series").RequireAuthorization()`
group. It lives in its own `MapGroup("/api/v1/public/series")` with no `.RequireAuthorization()` call.

---

## `PUT /api/v1/series/{id}` (existing endpoint, extended)

Existing authenticated endpoint. Request body gains one new optional field.

### Request body (delta only)

```json
{
  "title": "Modern Web Fundamentals",
  "details": "<p>...</p>",
  "isPublic": true
}
```

| Field | Type | Required | Notes |
|---|---|---:|---|
| `isPublic` | `bool` | yes (new) | When omitted by an older client, defaults to the series' current stored value (no silent reset to `false` on unrelated saves) — see `research.md` / `tasks.md` for the exact deserialization rule to implement. |

### Response (delta only)

`SeriesResponseDto` gains `isPublic: bool` so the admin UI can reflect current on/off state (FR-015).

### Authorization

Unchanged — existing `RequireAuthorization()` + ownership check (`OwnerUserId == callerUserId`)
already enforced by `SeriesService.UpdateAsync`. A caller without edit permission on the series
continues to receive the existing `404`/`401` behavior; they cannot view or change `isPublic` for a
series they don't own (FR-015).
