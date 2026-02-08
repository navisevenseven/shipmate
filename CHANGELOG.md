# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
