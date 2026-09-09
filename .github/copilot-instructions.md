# Project Guidelines

## Workflow
- Plan-mode interactive: discuss requirements before implementing.
- If requirements are unclear, ask — do not invent behavior.
- Keep scope focused; use custom agents/skills for domain guidance.

## Architecture

| Area | Stack |
|---|---|
| `src/frontend/` | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Primer React v38, next-auth (Entra ID) |
| `src/backend/` | ASP.NET Core minimal API, .NET 10, EF Core, Azure SQL, Microsoft.Identity.Web, Microsoft.Graph SDK |
| Auth | Frontend: Entra ID via next-auth. Backend: validates JWT on all user/business endpoints. |
| Graph | Delegated-only (OBO flow) for directory user lookup (people picker); no application permissions; no webhooks/background services. |

Treat frontend and backend as separate components. Project docs go in `docs/` (kebab-case). Implementation under `src/`, tests under `tests/`.

## Optional pstack Mode

GitHub Copilot cloud-agent users may opt into pstack orchestration for one bounded task by selecting the `pstack` custom agent before submitting or assigning the task. Do not select pstack automatically and do not infer pstack mode from ordinary prompts.

The pstack agent selects and sequences a compatible playbook. This file, applicable path-specific instructions, and the repository's domain agents and skills remain authoritative. Spec-driven and `speckit` workflows remain separate from pstack.

## Agent Routing

| Task | Agent |
|---|---|
| TDD, test-first, regression tests | `frontend-backend-tdd-engineer` |
| Spec authoring (functional/technical) | `spec-driven-development` |
| Spec-managed items (`New`/`Active`, `review:ready`, `techspec:stale`) — Description/AC edits | `spec-driven-development` |
| General board CRUD, sprint/task/bug | `devops-workitem-manager` |
| Backend API | `aspnet-minimal-api-specialist` |
| Frontend UI/UX | `nextjs-frontend-ux-engineer` |
| Logging/observability | `observability-and-incident-response` |
| Cross-stack integration | `frontend-backend-integration-specialist` |
| CI/CD | `github-actions-release-engineer` |

Do not use plugin TDD agents (`testing-automation:tdd-*`) unless user asks by name.

## Build & Test

| Stack | Commands (from dir) |
|---|---|
| Backend (`src/backend`) | `dotnet build`, `dotnet test` |
| Frontend (`src/frontend`) | `npm run lint`, `npm run build` |
| Frontend E2E (`src/frontend`) | `npx playwright test` |

Verify scripts exist in the relevant manifest before running.

## Security Scanning

`.github/workflows/opengrep.yml` runs OpenGrep (SAST) on PRs to `master` (this repo's
default branch — there is no `main` branch), pushes to `master`, and weekly. It is
advisory-only (`continue-on-error: true`) — reports to the Security tab but never blocks
merge. Plain Actions workflow, not a `gh-aw` agentic workflow. Details:
`docs/opengrep-scanning.md`.

## Conventions
- Discovery-first: check `readme.md` and local manifests before editing.
- Small, reversible edits; don't reformat unrelated code.
- No new frameworks/tooling/structure unless requested.
- Follow existing style in touched files.

## Ecosystem Congruency Check
After code changes, verify these files still match reality:
1. Technology references (versions in `package.json`/`.csproj`)
2. Directory paths and structure
3. Build/test commands
4. Agent → skill references
5. Domain rules in skills (schema, computation, Graph flows)
6. Agent Routing pointers

Applies to: `.github/copilot-instructions.md`, `.github/instructions/`, `.github/agents/`, `.github/skills/`. Run after dependency/structure/script/domain-rule changes.

After changing Copilot agents, skills, instructions, hooks, or pstack documentation, run `node tools/validate-copilot-customizations.mjs`.
