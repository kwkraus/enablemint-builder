# pstack Copilot porting status

## Status definitions

| Status | Meaning |
| --- | --- |
| Native | GitHub Copilot cloud agent supplies the capability directly. |
| Adapted | Repository guidance replaces Cursor-specific execution. |
| Delegated | An existing repository agent or skill owns the capability. |
| Quarantined | The capability is intentionally unreachable from the pstack cloud agent. |
| Pending | Porting or validation remains. |

## Entry points and routing

| Capability | Status | Copilot implementation |
| --- | --- | --- |
| Explicit task opt-in | Native | Manually select `.github/agents/pstack.agent.md`. |
| Automatic activation | Quarantined | `disable-model-invocation: true` protects default routing. |
| Playbook dispatch | Adapted | `.github/skills/pstack-copilot/SKILL.md`. |
| Repository domain routing | Delegated | Existing custom agents and skills remain authoritative. |
| Spec-driven and `speckit` routing | Quarantined | Kept separate by design. |
| Role-specific model configuration | Quarantined | Model and reasoning are selected at supported cloud entry points. |

## Runtime capabilities

| Cursor capability | Status | Copilot replacement |
| --- | --- | --- |
| `Task` and `subagent_type` | Native | Custom-agent `agent` tool. |
| Background model-role fan-out | Pending | Bounded custom-agent delegation without fixed model families. |
| Cursor transcript access | Quarantined | Cloud session logs and commits; no transcript-dependent workflow. |
| Cursor Routines and `/loop` | Quarantined | Split work into independent cloud tasks. |
| Cursor control plugins | Pending | Built-in GitHub and Playwright MCP plus repository commands. |
| Cursor `create-skill` | Native | GitHub Copilot agent skills under `.github/skills`. |
| Repository hooks | Native | `.github/hooks/*.json`; lifecycle commands are cross-platform and side-effect free. |
| GitHub and Playwright access | Native | Built-in cloud MCP servers. |
| Bun bootstrap and orchestration | Quarantined | No new Bun prerequisite. |
| Bash-only helpers | Pending | Remove if unreachable or provide compatible cloud execution. |
| `origin/main` assumptions | Pending | Replace reachable references with `master`. |

## Playbooks

| Playbook | Status | Notes |
| --- | --- | --- |
| Investigation | Adapted | Read-only evidence gathering. |
| Bug fix | Adapted | Reproduce, fix root cause, and verify. |
| Performance issue | Adapted | Requires an in-session baseline. |
| Hillclimb | Adapted | Must have a bounded target and iteration count. |
| Runtime forensics | Adapted | Requires accessible runtime evidence. |
| Trace forensics | Adapted | Requires a supplied trace artifact. |
| Feature | Adapted | Delegates implementation by domain. |
| Refactoring | Adapted | Preserves behavior with focused checks. |
| Prototype | Adapted | Uses a bounded disposable experiment. |
| Visual parity | Adapted | Uses Playwright. |
| Authoring a skill | Adapted | Uses repository agent-skill conventions. |
| Eval | Adapted | Requires a repeatable evaluation harness. |
| Multi-phase plan | Adapted | Produces independent cloud tasks, not stacked PRs. |
| Opening a PR | Native | Uses the cloud agent's branch and PR lifecycle. |
| Babysit and Shipping | Quarantined | Depend on persistent PR-stack operation. |
| Autonomous run and Orchestrate | Quarantined | Exceed a bounded cloud session. |
| Autopilot Full and Stack | Quarantined | Require multiple branches or pull requests. |
| Session pickup and Pause safely | Quarantined | Depend on Cursor transcript and state conventions. |
| Worktree cleanup | Quarantined | Cloud agent owns one ephemeral worktree. |

## Atomic skills

| Skill group | Status | Next change |
| --- | --- | --- |
| Principles | Pending | Retain portable judgment; encode repository precedence. |
| `how`, `why`, `teach` | Pending | Replace Cursor task and source assumptions. |
| `architect`, `arena`, `interrogate`, `swarm` | Pending | Replace model pools with bounded custom-agent delegation. |
| `tdd` | Delegated | Use repository TDD and test-strategy skills. |
| `typescript-best-practices` | Delegated | Defer to Next.js instructions and frontend skills. |
| `blast-radius`, `technical-writing` | Pending | Remove Cursor-specific tool references. |
| `recall`, `reflect`, `automate-me` | Quarantined | Depend on Cursor transcripts or user-level mutation. |
| `show-me-your-work` | Pending | Reassess using cloud session logs and repository artifacts. |
| `setup-pstack` | Quarantined | Cursor user model configuration has no cloud effect. |
| `make-bot-ui` | Quarantined | Unrelated Cursor Routine integration. |
| `comment-sicko`, `no-comments` | Quarantined | Conflicts with repository comment policy. |

## Validation evidence

| Check | State |
| --- | --- |
| Local profile and skill diagnostics | Passed |
| Markdown link validation | Passed by `node tools/validate-copilot-customizations.mjs` |
| Agent-reference validation | Passed across 41 agent profiles |
| Hook JSON and PowerShell command validation | Passed |
| GitHub custom-agent discovery on `master` | Requires merged default-branch test |
| Cloud investigation smoke test | Pending |
| Cloud delegated implementation test | Pending |
| Default-agent regression test | Pending |