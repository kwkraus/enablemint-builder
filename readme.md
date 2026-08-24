# Enablemint Builder

Enablemint Builder is a **webinar management platform** for local event planning, participation tracking, and engagement analytics. It helps organizations manage webinar series and individual sessions while preparing normalized event data for ingestion-first reporting workflows.

![About Enablemint Builder](https://github.com/user-attachments/assets/674c414a-8e81-47f5-90e1-6695f224319a)

---

## Key Capabilities

- **Series & session management** — Create webinar series containing multiple sessions; manage titles and schedules. Series support an optional rich-text details field (bold, italic, underline, bulleted lists) to describe the series and communicate expected outcomes to attendees. Sessions support an optional registration URL (http/https, any provider) that links to an external signup page and opens in a new tab.
- **Registration & attendance tracking** — Stores normalized registration and attendance records received from external ingestion sources into the local data model.
- **Metrics & analytics** — Aggregated engagement metrics per session and across a series: total registrations, attendees, unique account domains, and warm-account influence tracking.
- **Entra ID authentication** — Single-tenant login via Entra ID.

---

## Screenshots

### Sign In

![Login](docs/screenshots/login.png)

### Series List

![Series List](docs/screenshots/series-list.png)

### Create a Series

![Create Series](docs/screenshots/series-create.png)

### Series Detail with Metrics

![Series Detail](docs/screenshots/series-detail.png)

### Create a Session

![Create Session](docs/screenshots/session-create.png)

### Session Detail — Draft

![Session Detail (Draft)](docs/screenshots/session-detail-draft.png)

### Session Detail

![Session Detail](docs/screenshots/session-detail-published.png)

### About

![About](docs/screenshots/about.png)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Primer React v38 |
| Backend | ASP.NET Core Minimal API, .NET 10, EF Core |
| Database | Azure SQL |
| Auth | Microsoft Entra ID (next-auth, single-tenant) |
| Graph integration | Microsoft Graph v1 — OBO flow for signed-in user's profile photo (`/me/photo`) |
| Hosting | Azure App Service |

---

## Project Structure

```text
docs/           # Setup guides, screenshots
src/
  backend/      # ASP.NET Core Minimal API
  frontend/     # Next.js App Router app
tests/
  backend/      # xUnit tests for backend
tools/          # PowerShell scripts (e.g., Entra app registration)
```

---

## Architecture Overview

- **Monolith with modular boundaries** — vertical-slice feature organization in the backend, App Router feature directories in the frontend.
- **Ingestion-ready data model** — normalized registration and attendance records are persisted locally and remain the foundation for follow-on ingestion work.
- **Metrics persisted on write** — all metric aggregations are computed and stored on write; no compute-on-read.
- **Delegated-only Graph permissions** — OBO flow used exclusively to fetch the signed-in user's profile photo (`/api/v1/me/photo`); no directory search or background Graph calls.
- **Automated security scanning** — [OpenGrep](https://github.com/opengrep/opengrep) SAST scan runs on PRs to `master`, pushes to `master`, and weekly (advisory-only). See [`docs/opengrep-scanning.md`](docs/opengrep-scanning.md).

---

## Entra App Registration

See [`docs/setup-entra-permissions.md`](docs/setup-entra-permissions.md) for step-by-step instructions, or run the automated script:

```powershell
tools/update-app-registration.ps1
```

Required delegated permissions:

| Permission | Purpose |
|---|---|
| `openid`, `profile`, `email`, `offline_access` | Standard OIDC sign-in |
| `User.Read` | Fetch signed-in user's profile photo via OBO (`/api/v1/me/photo`) |

Exposed API scope: `api://{ClientId}/access_as_user` (frontend → backend token exchange).

This phase removes Teams webinar publish/sync API dependencies so installs do not require Teams webinar app registration consent paths.
