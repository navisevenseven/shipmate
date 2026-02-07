# ShipMate v0.1.0 — Initial Public Release

## Highlights

- First open-source release of ShipMate — AI engineering PM for OpenClaw
- 6 specialized skills for code review, sprint analytics, project planning, DevOps, and system design
- Full integration with GitLab (self-hosted), GitHub, Jira Cloud, and Kubernetes
- Three-layer security model for safe team chat deployment

## Skills

| Skill | What it does |
|-------|-------------|
| `code-review` | Deep PR/MR analysis across 6 dimensions (architecture, security, performance, testing, maintainability, correctness) |
| `sprint-analytics` | Sprint progress, velocity tracking, burndown, blocker detection from Jira + GitLab/GitHub |
| `project-planning` | Feature decomposition into epics/stories/tasks with Jira/GitLab/GitHub task creation |
| `devops` | Kubernetes pod status, log retrieval, deployment management |
| `system-design` | Architecture review, design docs, trade-off analysis |
| `shipmate` | Master skill — routing, onboarding, context management |

## Setup

```bash
git clone https://github.com/AiYsen/shipmate.git
cd shipmate
./setup/install.sh --workspace /path/to/your/project
./setup/verify.sh
```

## Integrations

- **GitLab** (self-hosted) — MRs, pipelines, issues via `glab`
- **GitHub** — PRs, issues, actions via `gh`
- **Jira Cloud** — sprints, boards, epics via REST API
- **Kubernetes** — pods, logs, deployments via `kubectl`
- **Sentry** — error tracking (connection support)
- **Grafana** — monitoring dashboards (connection support)

## Security

- One Instance = One Project isolation
- GPG-signed releases with SHA-256 checksums
- Fine-grained token scoping
- See [SECURITY.md](SECURITY.md) for full details

## Known Limitations

- Phase 1 uses CLI tools only (no TypeScript plugin yet)
- No built-in caching (relies on CLI tool behavior)
- No rate limiting (application must manage)
- No Docker sandbox image (uses OpenClaw host)

## What's Next (Phase 2)

- TypeScript plugin with GraphQL, caching, rate limiting
- Docker sandbox image
- ClawHub listing

## Downloads

- Source code (zip)
- Source code (tar.gz)
- CHECKSUMS.txt (GPG-signed)

## Verify

```bash
sha256sum -c CHECKSUMS.txt
gpg --verify CHECKSUMS.txt.asc CHECKSUMS.txt
```
