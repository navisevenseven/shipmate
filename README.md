# ShipMate

**Open-source AI engineering PM.** Skills pack + plugin for [OpenClaw](https://github.com/openclaw/openclaw) that turns your AI assistant into a development team copilot.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/navisevenseven/shipmate&envs=ANTHROPIC_API_KEY,TELEGRAM_BOT_TOKEN,SHIPMATE_REPOS,GITHUB_TOKEN)

## Quick Start (pick your path)

### Railway (recommended, ~5 min)

1. Click **Deploy on Railway** above
2. Fill 4 env vars in Railway UI:
   - `SHIPMATE_REPOS` — target repo (`owner/repo`)
   - `GITHUB_TOKEN` — [Fine-grained PAT](https://github.com/settings/personal-access-tokens/new) scoped to that repo
   - `TELEGRAM_BOT_TOKEN` — from [@BotFather](https://t.me/BotFather)
   - `ANTHROPIC_API_KEY` — from [Anthropic Console](https://console.anthropic.com/settings/keys)
3. Add bot to your Telegram group

### Docker Compose (~10 min)

```bash
git clone https://github.com/navisevenseven/shipmate.git
cd shipmate
./setup/wizard.sh        # Interactive: repo → tokens → channel → LLM
docker compose up -d
```

### AI Assistant (Cursor / Claude Code / Windsurf)

Add the [ShipMate snippet](docs/agent-config-snippet.md) to your project's agent config, then ask your AI: "Set up ShipMate for this project."

### Advanced (manual)

See [docs/quick-start.md](docs/quick-start.md) for manual setup, GitLab, Slack/Discord channels, Jira integration, and upgrade guide.

## What Can ShipMate Do?

- **Code Review** — deep PR/MR analysis across 6 dimensions (architecture, security, performance, testing, maintainability, correctness)
- **Sprint Analytics** — sprint progress, velocity tracking, burndown, blocker detection
- **Project Planning** — feature decomposition into epics/stories/tasks with estimates and dependencies
- **DevOps** — Kubernetes pod status, log retrieval, deployment management
- **System Design** — architecture review, design doc generation, trade-off analysis
- **Graceful Degradation** — works with whatever tools you have. Missing Jira? Sprint data from git.

## Integrations

| Service | What ShipMate Uses |
|---------|-------------------|
| GitHub | PRs, issues, actions (`gh` CLI + GraphQL plugin) |
| GitLab | MRs, pipelines, issues (`glab` CLI + GraphQL plugin) |
| Jira Cloud | Sprints, tasks, epics, boards (REST API) |
| Kubernetes | Pods, logs, rollouts (`kubectl`) |
| Sentry | Error tracking (REST API) |
| Grafana | Dashboards, metrics (REST API) |

## Security

**Principle: One Instance = One Project.** Each ShipMate is scoped to specific repositories. No personal mode.

| Layer | What |
|-------|------|
| **ScopeGuard** | Plugin blocks access to non-allowed repos/projects |
| **Token Scoping** | Fine-grained PAT / Project Access Token for one repo only |
| **Tool Policy** | `group:fs` denied, elevated mode disabled |
| **Sandbox** | Bash runs in isolated Docker container |

Security invariants are enforced by `auto-config.js` at every container start — even with `SHIPMATE_MANUAL_CONFIG=true`.

See [docs/security.md](docs/security.md) for the full threat model.

## Architecture

```
Your Team Chat (Telegram / Slack / Discord)
│
▼
┌────────────────────────────────────┐
│        OpenClaw Gateway            │
│      + ShipMate Skills (6)         │
│      + ShipMate Plugin (5 tools)   │
│      + auto-config.js              │
└────────────────────────────────────┘
│
├── GitHub / GitLab (code, PRs, issues)
├── Jira Cloud (sprints, boards, epics)
├── Kubernetes (pods, logs, deployments)
├── Sentry (error tracking)
└── Grafana (monitoring)
```

Three extension layers:
1. **Skills** (SKILL.md) — teach the LLM how to think about PM tasks
2. **Bootstrap** (SOUL.md / AGENTS.md) — configure PM personality and rules
3. **Plugin** (TypeScript) — custom tools for cached, rate-limited API access

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
