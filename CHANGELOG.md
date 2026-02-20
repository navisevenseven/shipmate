# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-02-20

### Added

- **Sentry integration** (`plugin/clients/sentry.ts`, `plugin/tools/sentry-issues.ts`)
  - REST API client for Sentry Issues API v0
  - `sentry_issues` tool: fetch unresolved issues, details with stacktrace, filter by level/time
  - ScopeGuard enforcement for Sentry org/project
  - Cached (2-min TTL) and rate-limited

- **Grafana integration** (`plugin/clients/grafana.ts`, `plugin/tools/grafana-alerts.ts`)
  - REST API client for Grafana Alerting API (Unified Alerting)
  - `grafana_alerts` tool: active alerts, alert rules, dashboard annotations
  - Three modes: alerts (default), rules, annotations
  - Cached (2-min TTL) and rate-limited

- **Incident Response skill** (`skills/incident-response/SKILL.md`)
  - Automated severity classification (P1-P4) from Sentry + Grafana data
  - Runbook suggestions based on error patterns
  - Duplicate incident detection via Jira search
  - Post-mortem template generation for P1/P2 incidents

- **Release Management skill** (`skills/release-management/SKILL.md`)
  - Changelog generation from merged PRs/MRs in Keep a Changelog format
  - Semantic version bump detection from PR labels/titles
  - Pre-release checklist: open PRs, CI status, Jira blockers, Sentry errors
  - Release commands for GitHub and GitLab

- **Proactive PM skill** (`skills/proactive-pm/SKILL.md`)
  - 4-phase behavioral model: deep onboarding, rhythm establishment, proactive actions, escalation
  - Daily health checks, gap detection, team adaptation, improvement proposals
  - Persistence model for team preferences and observations

### Changed

- `bootstrap/SOUL.md` — added proactive mindset section and post-onboarding transition
- `bootstrap/AGENTS.md` — proactive-pm routing and Proactive Behavior rules
- `skills/shipmate/SKILL.md` — proactive-pm sub-skill and onboarding step 6
- `plugin/lib/types.ts` — added `SentryIssue`, `SentryEvent`, `GrafanaAlert`, `GrafanaAnnotation` interfaces and `ALERTS` TTL
- `plugin/lib/scope-guard.ts` — added `checkSentry()`, `hasSentryScope`, Sentry org/project scoping
- `plugin/index.ts` — Sentry and Grafana tool registration blocks (fail-closed pattern)
- `setup/auto-config.js` — Sentry/Grafana env vars added to sandbox whitelist
- `bootstrap/AGENTS.md` — routing tables updated with incident-response and release-management
- `skills/shipmate/SKILL.md` — sub-skill table and onboarding updated
- `plugin/openclaw.plugin.json` — version bumped to 0.4.0

## [0.5.0] - 2026-02-20

### Added

- **Auto-config layer** (`setup/auto-config.js`)
  - Generates `openclaw.json` from env vars at every container start
  - Security policy hardcoded (tools.deny, elevated, sandbox whitelist)
  - Validates manual configs against security invariants
  - Multi-channel support: Telegram (1 token), Slack (2 tokens), Discord (token + guilds)
  - Multi-LLM: Anthropic Claude / OpenAI GPT
  - `SHIPMATE_REPOS` with wildcard rejection

- **Unit tests** for auto-config (`setup/auto-config.test.js`)
  - 40 tests covering repos, channels, models, security invariants, manual config validation
  - Zero dependencies — uses `node:test` runner

- **Interactive wizard** (`setup/wizard.sh`)
  - Guided setup: repo → platform token → chat channel → LLM → optional Jira
  - Token validation via API calls
  - Modes: interactive, `--non-interactive --env-file`, `--reset`, `--migrate`
  - Backward compat: `SHIPMATE_REPO` (singular) still works

- **AI-Agent guided onboarding**
  - `docs/agent-setup-guide.md` — self-contained runbook for AI IDE agents
  - `docs/agent-config-snippet.md` — minimal block for user's `.cursorrules` / `CLAUDE.md`

- **Deploy to Railway button** in README
- **OpenClaw config reference** (`docs/openclaw-config-reference.md`)
- **Quick start guide** (`docs/quick-start.md`) — all 4 onboarding paths + upgrade guide

### Changed

- **Onboarding simplified** — from ~30 min / 8 steps to ~5 min / 3 steps (Railway path)
- **Entrypoint** — extracted to `setup/entrypoint.sh`, runs auto-config.js before OpenClaw gateway
- **OpenClaw command** — changed from `openclaw start` to `openclaw gateway --port`
- **OpenClaw version** — pinned to `0.12.0` (was `latest`)
- **Dockerfile** — healthcheck now checks actual OpenClaw `/health` endpoint via curl
- **docker-compose.yml** — `env_file: .env` (was `.env.scoped`), fixed port mapping `3177:18789`
- **railway.json** — healthcheck `/health` with 60s timeout, updated start command
- **.env.example** — restructured: REQUIRED (4 vars) first, OPTIONAL below
- **README.md** — rewritten with 4 onboarding paths, Deploy button, compact format
- **docs/security.md** — added auto-config security guarantees section
- **CONTRIBUTING.md** — updated dev setup instructions

### Removed

- `setup/openclaw.json.template` — replaced by `auto-config.js`
- `setup/generate-scoped-env.sh` — env filtering now in `auto-config.js`
- `.env.scoped` flow — `.env` used directly
- `railway.toml` — only `railway.json` kept

## [0.4.0] - 2026-02-19

### Added

- **ScopeGuard** (`plugin/lib/scope-guard.ts`)
  - Plugin-level enforcement for GitHub repos, GitLab projects, Jira projects/boards
  - Every API call validated against allowlist before execution
  - `ScopeViolationError` returned on access to non-allowed resources
  - Automated JQL project injection — all Jira queries scoped to allowed projects

- **Token scope validation** at startup
  - GitHub: checks visible repos against `SHIPMATE_SCOPE_GITHUB_REPOS`
  - Warns if token has broader access than configured

- **Scoped sandbox environment**
  - `.env.scoped` generator (`setup/generate-scoped-env.sh`)
  - Only project-relevant credentials passed to sandbox container
  - No database clients in sandbox image (by design)

- **Unit tests** for ScopeGuard and integration logic
  - `plugin/tests/scope-guard.test.ts` — 20+ test cases
  - `plugin/tests/integration.test.ts` — fail-closed and JQL injection tests

- **Scope enforcement test scenarios** in `tests/scenarios.md`

### Changed

- `setup/install.sh` — always runs in scoped mode, auto-detects repo from git remote
- `setup/openclaw.json.template` — sandbox and tool policy enabled by default
- `docker-compose.yml` — uses `.env.scoped` instead of `.env`
- `Dockerfile.sandbox` — explicitly excludes database clients
- `plugin/index.ts` — fail-closed: token without scope = tools not registered
- `plugin/clients/github.ts` — ScopeGuard validation on every method
- `plugin/clients/gitlab.ts` — ScopeGuard validation on every method
- `plugin/clients/jira.ts` — JQL project injection + board validation
- `bootstrap/AGENTS.md` — updated isolation rules (hard enforcement)
- `bootstrap/SOUL.md` — updated security mindset section

### Removed

- Personal mode — every instance is always scoped to one project
- Commented-out sandbox and tool policy in config template

### Security

- Fail-closed: token without scope config = tools not registered
- All plugin API calls validated against allowlist before execution
- Sandbox env isolation: only `SHIPMATE_SCOPE_*` and scoped tokens in container
- No database clients (`psql`, `mysql`, `mongosh`) in sandbox

## [0.3.0] - 2026-02-08

### Added

- **Docker Sandbox Image** (`Dockerfile.sandbox`)
  - Based on `node:20-slim` with `git`, `gh`, `glab`, `jq`, `curl`, `kubectl`
  - Non-root user `shipmate` (UID 1000)
  - For OpenClaw sandbox mode — isolates agent bash commands in a container
  - Multi-arch support (amd64, arm64)

- **Production Docker Image** (`Dockerfile`)
  - Multi-stage build: plugin compilation + runtime with all CLI tools
  - OpenClaw gateway integration with ShipMate skills and plugin
  - Entrypoint with environment validation and diagnostic output
  - Graceful fallback when OpenClaw is not available

- **Docker Compose** (`docker-compose.yml`)
  - Full ShipMate service with volume mounts for workspace
  - Sandbox-only profile for host-based OpenClaw setups
  - `.env.example` with documented environment variables

- **Railway Deployment** (`railway.json`, `railway.toml`)
  - One-click deploy template for Railway platform
  - Dockerfile-based build with health checks
  - Container isolation by default (no separate sandbox needed)

- **CI/CD** (`.github/workflows/docker.yml`)
  - Automated Docker image builds on push to main and version tags
  - Push to GitHub Container Registry (GHCR)
  - Multi-arch builds (linux/amd64, linux/arm64)
  - Build cache with GitHub Actions cache

- **Dog-fooding Documentation** (`docs/dogfooding.md`)
  - 2-4 week internal testing checklist
  - Per-skill test scenarios with acceptance criteria
  - Security validation checklist
  - Performance targets and metrics tracking
  - Exit criteria for Phase 4 readiness

### Changed

- `setup/openclaw.json.template` — updated sandbox section with GHCR image reference and deployment mode documentation

## [0.2.0] - 2026-02-08

### Added

- **TypeScript Plugin** (Phase 2)
  - `github_pr_review` — fetch full PR context via GitHub GraphQL in a single call (replaces 3-5 CLI calls)
  - `github_team_stats` — team contribution metrics: PRs authored/reviewed, merge times, lines changed
  - `gitlab_mr_review` — fetch full MR context via GitLab GraphQL with pipeline status and approvals
  - `sprint_metrics` — aggregated sprint data from Jira + GitHub PRs + GitLab MRs
  - `jira_search` — flexible Jira issue search via JQL with structured output

- **Plugin Infrastructure**
  - In-memory cache with per-entry TTL (metadata: 5min, diffs: 15min, stats: 30min)
  - Token bucket rate limiter (30 calls/min, burst 10)
  - Audit logging for write operations
  - Graceful degradation — tools registered only when corresponding env vars are set

- **API Clients**
  - GitHub GraphQL client via `@octokit/graphql`
  - GitLab GraphQL + REST client (native fetch)
  - Jira Cloud REST API v3 client with Basic Auth

### Changed

- Skills (`code-review`, `sprint-analytics`) now prefer plugin tools over CLI when available
- `openclaw.plugin.json` version bumped to 0.2.0

## [0.1.0] - 2026-02-07

### Added

- **Skills Pack** (6 skills)
  - `shipmate` — master skill with routing, onboarding, and context management
  - `code-review` — PR/MR review with 6-dimension analysis (GitHub + GitLab)
  - `sprint-analytics` — sprint progress, velocity, burndown with Jira REST API integration
  - `project-planning` — feature decomposition with Jira/GitLab/GitHub task creation
  - `devops` — Kubernetes pod status, logs, deployments, cluster health
  - `system-design` — architecture review and design doc generation

- **Bootstrap**
  - `SOUL.md` — PM personality with platform-specific behavior (GitLab, Jira, K8s)
  - `AGENTS.md` — capabilities table, skill routing, multi-user rules
  - `data/team-context.md` — comprehensive template for team and infrastructure context

- **Setup & Infrastructure**
  - `setup/install.sh` — non-interactive installation script with environment validation
  - `setup/verify.sh` — health-check script for all integrations
  - `setup/openclaw.json.template` — JSON5 configuration template with documented env vars

- **Integrations**
  - GitLab (self-hosted) via `glab` CLI — MRs, pipelines, issues
  - GitHub via `gh` CLI — PRs, issues, actions
  - Jira Cloud via REST API (`curl + jq`) — sprints, tasks, epics
  - Kubernetes via `kubectl` — pods, logs, deployments
  - Sentry and Grafana connection support (P1/P2)

- **Testing**
  - 25+ eval test scenarios covering all skills
  - Setup/onboarding scenarios
  - Security scenarios (isolation, prompt injection)
  - GitLab MR, Jira sprint, and K8s devops scenarios

- **Publishing**
  - MIT License
  - CONTRIBUTING.md, SECURITY.md
  - GitHub Actions workflows (publish, test)
  - Issue templates (bug, feature, security)
  - PR template with checklist
  - CODEOWNERS

### Security

- Three-layer isolation model (Workspace, Tool Policy, Sandbox)
- Fine-grained token scoping documentation
- GPG-signed releases with CHECKSUMS.txt
- Supply chain security guidance (GitHub primary, ClawHub secondary)
