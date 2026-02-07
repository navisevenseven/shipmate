# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
