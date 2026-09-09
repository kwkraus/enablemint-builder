import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const failures = [];

const read = (relativePath) =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

const requireFile = (relativePath) => {
  if (!fs.existsSync(path.join(repositoryRoot, relativePath))) {
    failures.push(`Missing file: ${relativePath}`);
  }
};

const frontmatter = (relativePath) => {
  const match = read(relativePath).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    failures.push(`Missing frontmatter: ${relativePath}`);
    return "";
  }

  return match[1];
};

const property = (source, name) => {
  const match = source.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match?.[1].trim().replace(/^['"]|['"]$/g, "");
};

const agentDirectory = path.join(repositoryRoot, ".github", "agents");
const agentFiles = fs
  .readdirSync(agentDirectory)
  .filter((fileName) => fileName.endsWith(".md"));
const agentNames = new Set();

for (const fileName of agentFiles) {
  const relativePath = path.join(".github", "agents", fileName);
  const metadata = frontmatter(relativePath);
  const fallbackName = fileName.replace(/(?:\.agent)?\.md$/, "");
  agentNames.add(property(metadata, "name") ?? fallbackName);

  if (!property(metadata, "description")) {
    failures.push(`Missing agent description: ${relativePath}`);
  }
}

const requiredAgents = [
  "aspnet-minimal-api-specialist",
  "frontend-backend-integration-specialist",
  "frontend-backend-tdd-engineer",
  "github-actions-release-engineer",
  "nextjs-frontend-ux-engineer",
  "observability-and-incident-response",
  "pstack",
];

for (const agentName of requiredAgents) {
  if (!agentNames.has(agentName)) {
    failures.push(`Unresolved agent: ${agentName}`);
  }
}

const pstackProfile = frontmatter(".github/agents/pstack.agent.md");
const expectedProfileProperties = {
  name: "pstack",
  target: "github-copilot",
  "user-invocable": "true",
  "disable-model-invocation": "true",
};

for (const [name, expectedValue] of Object.entries(expectedProfileProperties)) {
  const actualValue = property(pstackProfile, name);
  if (actualValue !== expectedValue) {
    failures.push(
      `Invalid pstack profile property ${name}: expected ${expectedValue}, found ${actualValue ?? "missing"}`,
    );
  }
}

const bridgeMetadata = frontmatter(".github/skills/pstack-copilot/SKILL.md");
if (property(bridgeMetadata, "name") !== "pstack-copilot") {
  failures.push("The pstack compatibility skill name must be pstack-copilot");
}

if (property(bridgeMetadata, "user-invocable") !== "false") {
  failures.push("The pstack compatibility skill must not be directly user-invocable");
}

const playbooks = [
  "investigation.md",
  "bug-fix.md",
  "perf-issue.md",
  "hillclimb.md",
  "runtime-forensics.md",
  "trace-forensics.md",
  "feature.md",
  "refactoring.md",
  "prototype.md",
  "visual-parity.md",
  "authoring-a-skill.md",
  "eval.md",
  "multi-phase-plan.md",
  "opening-a-pr.md",
  "babysit.md",
  "shipping.md",
  "autonomous-run.md",
  "orchestrate.md",
  "autopilot-full.md",
  "autopilot-stack.md",
  "session-pickup.md",
  "pause-safely.md",
  "worktree-cleanup.md",
];

for (const playbook of playbooks) {
  requireFile(path.join(".github", "skills", "poteto-mode", "playbooks", playbook));
}

const staleAgentAliases = [
  "`aspnet-api-expert`",
  "`cicd-devops`",
  "`fullstack-integration`",
  "`observability-sre`",
  "`ui-ux-nextjs`",
];
const routingFiles = [
  ".github/copilot-instructions.md",
  ".github/instructions/aspnet-webapi.instructions.md",
  ".github/instructions/nextjs.instructions.md",
  ".github/agents/pstack.agent.md",
  ".github/skills/pstack-copilot/SKILL.md",
];

for (const relativePath of routingFiles) {
  const content = read(relativePath);
  for (const alias of staleAgentAliases) {
    if (content.includes(alias)) {
      failures.push(`Stale agent alias ${alias} in ${relativePath}`);
    }
  }
}

const hooks = JSON.parse(read(".github/hooks/hooks.json"));
if (hooks.version !== 1 || typeof hooks.hooks !== "object") {
  failures.push("Invalid .github/hooks/hooks.json schema");
} else {
  for (const [eventName, definitions] of Object.entries(hooks.hooks)) {
    for (const definition of definitions) {
      if (!definition.bash || !definition.powershell) {
        failures.push(`Hook ${eventName} must define bash and powershell commands`);
      }
      if ((definition.timeoutSec ?? 30) > 15) {
        failures.push(`Hook ${eventName} timeout exceeds 15 seconds`);
      }
    }
  }
}

const markdownFiles = [
  "docs/pstack-audit.md",
  "docs/pstack-copilot-integration.md",
  "docs/pstack-porting-status.md",
];

for (const relativePath of markdownFiles) {
  const directory = path.dirname(path.join(repositoryRoot, relativePath));
  const links = read(relativePath).matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
  for (const link of links) {
    const target = link[1].split("#", 1)[0];
    if (!target || /^[a-z]+:/i.test(target)) {
      continue;
    }

    if (!fs.existsSync(path.resolve(directory, decodeURIComponent(target)))) {
      failures.push(`Broken local link in ${relativePath}: ${target}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Copilot customization validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${agentFiles.length} agents, ${playbooks.length} playbooks, hooks, routing, and pstack documentation.`,
  );
}