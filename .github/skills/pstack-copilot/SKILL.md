---
name: pstack-copilot
description: 'Run pstack playbooks inside GitHub Copilot cloud agent while preserving this repository''s authoritative agents, skills, instructions, and verification commands. Use only from the manually selected pstack custom agent.'
user-invocable: false
---

# pstack for GitHub Copilot cloud agent

Use pstack as an orchestration layer. It selects a playbook and sequences work. It does not replace repository domain guidance.

## Precedence

Apply guidance in this order:

1. GitHub Copilot cloud-agent platform and security constraints.
2. `.github/copilot-instructions.md`.
3. Applicable `.github/instructions/*.instructions.md` files.
4. The repository agent and skills that own the affected domain.
5. This compatibility skill.
6. Portable guidance from the upstream pstack skills and playbooks.

When guidance conflicts, follow the higher item. In particular, ask for clarification when requirements are unclear. The pstack `never-block-on-the-human` principle does not override the repository's interactive planning rule.

Keep spec-driven development and `speckit` outside pstack routing. Do not invoke their agents from this skill.

## Cloud constraints

- Complete one bounded task on one branch and produce at most one pull request.
- Fit the work within the cloud agent's session limit. Split larger programs into independently assignable tasks.
- Use the cloud `agent` tool for delegation. Do not use Cursor `Task`, `subagent_type`, background-agent flags, model-role files, transcripts, Routines, or `/loop`.
- Do not require Bun, Origin, Graphite, Cursor plugins, or Cursor user configuration.
- Use repository commands and built-in GitHub or Playwright MCP tools when available.
- Treat model and reasoning-level selection as an entry-point concern. Do not assign model families to delegated roles.

## Task classification

Read the matching playbook under `../poteto-mode/playbooks/` for portable process guidance, then apply the adaptations below.

| Task | Playbook | Cloud disposition |
| --- | --- | --- |
| Read-only explanation or decision | `investigation.md` | Supported |
| Reproducible defect | `bug-fix.md` | Supported |
| Measured performance defect | `perf-issue.md` | Supported when a baseline can run in-session |
| Iterative metric improvement | `hillclimb.md` | Supported only when bounded to the current session |
| Live runtime diagnosis | `runtime-forensics.md` | Supported only with an accessible runtime and telemetry |
| Supplied trace diagnosis | `trace-forensics.md` | Supported |
| New or changed behavior | `feature.md` | Supported |
| Behavior-preserving structural change | `refactoring.md` | Supported |
| Throwaway empirical sketch | `prototype.md` | Supported |
| UI equivalence | `visual-parity.md` | Supported through Playwright |
| Skill creation or revision | `authoring-a-skill.md` | Supported |
| Prompt or skill evaluation | `eval.md` | Supported when a repeatable evaluation exists |
| Multi-phase planning | `multi-phase-plan.md` | Planning only; emit bounded cloud tasks |
| Pull-request opening | `opening-a-pr.md` | Use the cloud agent's native single-PR lifecycle |

Before editing, state one local hypothesis, its controlling code path, and one focused check that can falsify it. After the first substantive edit, run that check before widening scope.

## Domain delegation

Delegate implementation or focused review to the repository agent that owns the changed surface. Use the agent's frontmatter `name` as the invocation identifier.

| Surface | Agent |
| --- | --- |
| Backend API | `aspnet-minimal-api-specialist` |
| Frontend UI and UX | `nextjs-frontend-ux-engineer` |
| Frontend-backend integration | `frontend-backend-integration-specialist` |
| Test-first changes | `frontend-backend-tdd-engineer` |
| Logging, telemetry, and incidents | `observability-and-incident-response` |
| GitHub Actions and delivery | `github-actions-release-engineer` |

The pstack agent owns classification, sequencing, reconciliation, and the final result. Delegated agents own domain implementation. Give each delegate a bounded objective, relevant file pointers, required skills, and a focused validation target. Parallel delegates must be read-only or own disjoint files.

## Skill delegation

- Use `tdd-red-green-refactor`, `api-test-strategy`, and `frontend-test-strategy` instead of maintaining a separate pstack testing policy.
- Use `api-contract-design`, `status-code-decision-matrix`, `data-schema-migration`, `domain-metrics-computation`, and `structured-logging-policy` for their backend concerns.
- Use `nextjs-ui-composition-patterns` and `frontend-accessibility-and-ux-acceptance` for frontend concerns.
- Use `integration-contract-alignment` and `integration-environment-configuration` for cross-stack concerns.
- Use the pipeline skills for CI/CD work.

Portable pstack principles may sharpen decisions, but they cannot weaken these domain rules.

## Quarantined workflows

Do not invoke these playbooks in Copilot cloud agent:

- `babysit.md`
- `shipping.md`
- `autonomous-run.md`
- `orchestrate.md`
- `autopilot-full.md`
- `autopilot-stack.md`
- `session-pickup.md`
- `pause-safely.md`
- `worktree-cleanup.md`

If a request matches one, explain the incompatible cloud constraint and propose bounded tasks that use supported playbooks. Do not silently approximate persistent loops, stacked pull requests, cross-session transcripts, or multi-worktree coordination.

## Verification

Use the narrowest executable check that can falsify the current hypothesis. Confirm scripts exist before invoking them.

| Surface | Checks |
| --- | --- |
| Backend | Focused `dotnet test`, then `dotnet build` when needed |
| Frontend | Focused test when available, then `npm run lint` or `npm run build` |
| End to end | Focused `npx playwright test` or built-in Playwright MCP |
| Customizations | Validate frontmatter, referenced agent names, playbook paths, and absence of reachable Cursor-only execution instructions |

Report the selected playbook, delegated domain owner, changed behavior, checks run, and any residual cloud limitation.