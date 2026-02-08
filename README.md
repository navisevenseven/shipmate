# ShipMate

**Open-source AI engineering PM.** Skills pack + plugin for [OpenClaw](https://github.com/openclaw/openclaw) that turns your AI assistant into a development team copilot.

<!-- SEO: AI project manager, OpenClaw plugin, engineering PM, agile automation, team capacity planning, sprint analytics, code review automation -->

## What is ShipMate?

ShipMate is a specialized skills pack for OpenClaw that focuses on software engineering project management. It integrates with your existing tools — GitLab, GitHub, Jira, Kubernetes — and provides intelligent project management directly in your team chat.

```
Your Team Chat (Telegram / Slack / Discord)
│
▼
┌────────────────────────────────────┐
│        OpenClaw Gateway            │
│      + ShipMate Skills (6)         │
│      + ShipMate Bootstrap          │
└────────────────────────────────────┘
│
├── GitLab (MRs, pipelines, issues)
├── GitHub (PRs, issues, actions)
├── Jira Cloud (sprints, boards, epics)
├── Kubernetes (pods, logs, deployments)
├── Sentry (error tracking)
└── Grafana (monitoring dashboards)
```

## Features

- **Code Review** — deep PR/MR analysis across 6 dimensions (architecture, security, performance, testing, maintainability, correctness). Works with both GitHub PRs and GitLab MRs.
- **Sprint Analytics** — sprint progress, velocity tracking, burndown, blocker detection. Integrates with Jira Cloud, GitHub Milestones, and GitLab Milestones.
- **Project Planning** — feature decomposition into epics/stories/tasks with estimates, dependencies, and risks. Creates tasks in Jira, GitLab, or GitHub.
- **DevOps** — Kubernetes pod status, log retrieval, deployment management, cluster health checks.
- **System Design** — architecture review, design doc generation, trade-off analysis.
- **Graceful Degradation** — works with whatever tools you have. Missing Jira? Sprint data from git. No kubectl? DevOps skill skipped with clear instructions.

## Quick Start

### Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) installed and running
- Git repository for your project

### Install

```bash
# Clone ShipMate
git clone https://github.com/navisevenseven/shipmate.git
cd shipmate

# Run installer (validates environment, copies files, generates config)
./setup/install.sh --workspace /path/to/your/project

# Verify everything works
./setup/verify.sh
```

The installer will:
1. Validate your workspace (must be a git repo)
2. Check CLI tools (`git`, `glab`, `gh`, `jq`, `curl`, `kubectl`)
3. Check authentication status (GitLab, GitHub)
4. Copy skills and bootstrap files to OpenClaw
5. Generate `openclaw.json` config template

### Configure

Fill in your tokens in `~/.openclaw/openclaw.json`:

```json5
{
  skills: {
    entries: {
      shipmate: {
        enabled: true,
        env: {
          GITLAB_TOKEN: "your-gitlab-token",
          GITHUB_TOKEN: "your-github-token",
          JIRA_BASE_URL: "https://yourorg.atlassian.net",
          JIRA_API_TOKEN: "your-jira-token",
          JIRA_USER_EMAIL: "you@company.com",
        },
      },
    },
  },
}
```

### Start

Send a message to ShipMate in your OpenClaw chat. On first run, it will:
- Check your service connections
- Ask about your project setup (sprints, conventions)
- Report available capabilities
- Answer your question with available data

## Skills

| Skill | Description | Tools | Gating |
|-------|-------------|-------|--------|
| `shipmate` | Master skill — routing, onboarding, context management | — | Always loaded |
| `code-review` | PR/MR review with 6-dimension analysis | `gh`, `glab` | Requires `gh` or `glab` |
| `sprint-analytics` | Sprint progress, velocity, burndown, blockers | `curl+jq`, `gh`, `glab`, `git` | Requires `git` + (`gh` or `glab`) |
| `project-planning` | Feature decomposition, task creation in Jira/GitLab/GitHub | `gh`, `glab`, `curl+jq` | Requires `git` + (`gh` or `glab`) |
| `devops` | K8s pod status, logs, deployments, cluster health | `kubectl` | Requires `kubectl` |
| `system-design` | Architecture review, design docs, trade-offs | `git` | Requires `git` |

## Integrations

| Service | Priority | What ShipMate Uses | CLI/API |
|---------|----------|--------------------|---------|
| GitLab (self-hosted) | P0 | MRs, pipelines, issues | `glab` CLI |
| GitHub | P0 | PRs, issues, actions | `gh` CLI |
| Jira Cloud | P0 | Sprints, tasks, epics, boards | REST API (`curl+jq`) |
| Kubernetes | P1 | Pods, logs, rollouts, cluster health | `kubectl` |
| Sentry | P1 | Error tracking, issues | REST API |
| Grafana | P2 | Dashboards, metrics | REST API |

## Use Cases

**"Review MR !42"** → Deep 6-dimension analysis of GitLab merge request with actionable suggestions

**"How's the sprint going?"** → Sprint progress from Jira + commit/MR velocity from GitLab + blocker detection

**"Plan feature: add 2FA"** → Epic + stories decomposition with estimates, dependencies, and optional Jira task creation

**"Show pod status in production"** → Kubernetes pod health, warnings, restart counts, and recommendations

**"Design a caching layer"** → Multiple architecture options with trade-offs, data model, migration strategy

## Security

ShipMate is designed for **team chats** where multiple developers interact with it. Security is enforced at setup time.

**Principle: One Instance = One Project.** Each ShipMate is bound to a single repository.

| Layer | What | How |
|-------|------|-----|
| Workspace | Agent sees only the target project | `agents.defaults.workspace` |
| Tool Policy | Agent cannot read/write arbitrary files | `group:fs` in deny list |
| Sandbox | Bash runs in Docker (recommended) | `sandbox.mode: "all"` |

Use **Fine-grained Personal Access Tokens** scoped to a single repository. Never use classic PATs with broad `repo` scope.

See [Security docs](docs/security.md) for the full threat model.

## Verify Releases

```bash
sha256sum -c CHECKSUMS.txt
gpg --verify CHECKSUMS.txt.asc CHECKSUMS.txt
```

## Plugin (Phase 2)

The ShipMate plugin provides custom tools that replace CLI commands with cached, rate-limited API calls:

| Tool | What it does | API |
|------|-------------|-----|
| `github_pr_review` | Full PR context in 1 call (replaces 3-5 `gh` commands) | GitHub GraphQL |
| `github_team_stats` | Contributor stats, PR throughput, merge times | GitHub GraphQL |
| `gitlab_mr_review` | Full MR context with pipeline status and approvals | GitLab GraphQL |
| `sprint_metrics` | Aggregated sprint data from Jira + GitHub + GitLab | Multi-source |
| `jira_search` | Flexible issue search via JQL | Jira REST v3 |

**Caching:** In-memory with TTL (metadata: 5 min, diffs: 15 min, stats: 30 min).
**Rate limiting:** 30 calls/min with burst up to 10.
**Graceful degradation:** Tools are registered only when env vars are set. Skills fall back to CLI if plugin is unavailable.

### Plugin Installation

```bash
cd plugin
npm install
```

The plugin is loaded automatically when placed in `~/.openclaw/extensions/shipmate/`.

### Env Vars (all optional)

| Variable | Service | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | GitHub | Personal Access Token |
| `GITLAB_TOKEN` | GitLab | Personal Access Token |
| `GITLAB_HOST` | GitLab | Host URL (default: `https://gitlab.com`) |
| `JIRA_BASE_URL` | Jira | Cloud URL, e.g. `https://company.atlassian.net` |
| `JIRA_API_TOKEN` | Jira | API token |
| `JIRA_USER_EMAIL` | Jira | Email for Basic Auth |

## Architecture

ShipMate follows the OpenClaw extension model:

1. **Skills** (SKILL.md files) — teach the LLM how to think about PM tasks
2. **Bootstrap** (SOUL.md / AGENTS.md) — configure the PM personality and rules
3. **Plugin** (TypeScript) — custom tools for optimized, cached API access

No fork of OpenClaw needed. Works with any OpenClaw instance.

## Roadmap

- **Phase 1:** Skills-only MVP with CLI tools (`glab`, `gh`, `curl+jq`, `kubectl`)
- **Phase 2 (current):** TypeScript plugin with GraphQL, caching, rate limiting
- **Phase 3:** Docker sandbox image, Railway template, ClawHub listing

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
