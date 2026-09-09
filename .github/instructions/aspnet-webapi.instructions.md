---
description: Guidance for the ASP.NET Core Web API backend in src/backend
applyTo: "src/backend/**"
---

# ASP.NET Core Web API Instructions

Applies to `src/backend`. Shared rules (architecture, build/test, congruency check) live in `copilot-instructions.md`.

## Agent Routing
- Testing → `frontend-backend-tdd-engineer`
- Logging/observability → `observability-and-incident-response`
- Graph (delegated OBO user lookup) → `aspnet-minimal-api-specialist`
- Schema/migrations → `data-schema-migration` skill via `aspnet-minimal-api-specialist`
- API contracts → `api-contract-design` skill via `aspnet-minimal-api-specialist`
- Ask when requirements are unclear.

## Architecture
- Minimal API style unless controllers are required.
- Thin endpoints; delegate to domain/application services.
- Organize by feature (vertical slices); share via interfaces.

## Project Structure
- `Program.cs` — startup, DI
- `Features/<Name>/` — endpoints, DTOs, handlers, validators
- `Domain/` — entities, value objects, rules (identity, normalization, warm/influence)
- `Infrastructure/` — data access, external integrations; `Infrastructure/Graph/` for `OboTokenService` (used by `/me/photo`)
- `Metrics/` — recompute orchestrator
- `Common/` — shared primitives, errors, result types
- Tests: `tests/backend/` mirroring feature folders

## Dependencies
- Target: `net10.0`. Built-in DI, config, logging.
- EF Core with explicit migrations only (no auto-migration).
- Microsoft.Identity.Web (JWT + OBO); Microsoft.Graph SDK.
- Prefer `Microsoft.Extensions.*` abstractions.

## API Design
- Base path `/api/v1`; resource-oriented routes; proper verbs/status codes.
- Validate inputs, return problem details.
- DTOs for request/response — never expose domain entities.
- Async + cancellation tokens for I/O.
- No pagination in V1.

## Data
- UUID PKs generated client-side; datetime2 UTC.
- Schema details, constraints, indexes → `data-schema-migration` skill.

## Graph
- Delegated-only (OBO) via `OboTokenService`, used solely for `/me/photo`. No directory user lookup, webinar, or data-sync integration.

## Security & Config
- Secrets in user-secrets or env vars; do not commit `appsettings.*.json` overrides.
- Options binding with `ValidateOnStart`.
- Required config: Entra client/tenant/secret, DB connection, internal domain list.

## Error Handling
- Centralize via middleware or endpoint filters.
- No secrets/PII in logs. Logging policy → `observability-and-incident-response`.

## Best Practices
- Small single-purpose methods; immutable records for DTOs where possible.
- No static state; DI for time/randomness/environment.
- OpenAPI metadata on endpoints.
- Sync processing idempotent; metrics recompute atomic with normalized data writes.

## Build
- `dotnet build` warning-free; `dotnet test` for new functionality; `dotnet format` defaults.
