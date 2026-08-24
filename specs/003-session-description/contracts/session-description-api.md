# Session Description API Contract

Base path: `/api/v1`.

## POST `/series/{seriesId}/sessions`

Existing authenticated create request, extended with optional `description`:

```json
{
  "title": "Session title",
  "startsAt": "2026-08-24T18:00:00Z",
  "endsAt": "2026-08-24T19:00:00Z",
  "registrationUrl": null,
  "description": "<p>Learn <strong>practical</strong> techniques.</p>"
}
```

The service sanitizes and persists the value. Omitted, `null`, empty, or whitespace-only values
return `description: null`.

## GET `/sessions/{id}`

The authenticated owner receives the existing response extended with canonical description:

```json
{
  "sessionId": "guid",
  "seriesId": "guid",
  "title": "Session title",
  "startsAt": "2026-08-24T18:00:00Z",
  "endsAt": "2026-08-24T19:00:00Z",
  "registrationUrl": null,
  "description": "<p>Learn <strong>practical</strong> techniques.</p>"
}
```

Existing sessions return `description: null`. Non-owners remain indistinguishable from missing
sessions and receive the existing `404 session_not_found` envelope.

## PUT `/sessions/{id}`

The existing full update payload adds optional nullable `description`:

```json
{
  "title": "Updated title",
  "startsAt": "2026-08-24T18:00:00Z",
  "endsAt": "2026-08-24T19:00:00Z",
  "registrationUrl": null,
  "description": "<ul><li>Updated outcome</li></ul>"
}
```

Success returns `200` and the full response. `PUT /sessions/{id}/title` remains unchanged.

### Validation error

If decoded description text exceeds 10,000 characters, return `400` using the existing
`ErrorEnvelope` with `errorCode: "validation_error"` and an actionable message such as
`"Session description must not exceed 10,000 characters."`. The previous title, schedule,
registration URL, and description remain unchanged.

