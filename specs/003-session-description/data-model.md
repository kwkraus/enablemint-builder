# Data Model: Session Description

## Session

Existing aggregate: `src/backend/Domain/Entities/Session.cs`.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `SessionId` | `Guid` | yes | Existing UUID primary key |
| `SeriesId` | `Guid` | yes | Existing series relationship |
| `OwnerUserId` | `string` | yes | Existing authorization boundary |
| `Title` | `string` | yes | Existing non-empty title rule |
| `StartsAt` / `EndsAt` | `DateTime` | yes | Existing UTC normalization and range validation |
| `RegistrationUrl` | `string?` | no | Existing optional URL |
| `Description` | `string?` | no | Sanitized canonical HTML; `null` means absent |

### Storage mapping

Add nullable `nvarchar(max)` column `Description` to `Sessions`; no index or default is required.
The migration must be additive and reversible. Existing sessions become `NULL` without data cleanup.
SQLite/InMemory test configuration must avoid SQL Server-only `nvarchar(max)` syntax, matching the
existing conditional mapping in `AppDbContext`.

### Content rules and transitions

1. Sanitize before entity mutation or `SaveChangesAsync`.
2. Preserve only the series-standard allow-list and strip attributes/unsafe content.
3. Normalize empty or whitespace-only sanitized content to `null`.
4. Count decoded plain text after sanitization; reject values above 10,000 with no partial update.
5. Values transition `null → sanitized HTML`, `HTML → sanitized HTML`, or `HTML → null`.
6. Descriptions are scoped by `SessionId`; no inheritance from `Series.Details` and no cross-session
   fallback is permitted.

