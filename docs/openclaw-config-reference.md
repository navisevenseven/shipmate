# OpenClaw Configuration Reference

Verified reference for ShipMate auto-config layer. Based on OpenClaw documentation, source code analysis, and existing verify.sh/install.sh behavior.

## CLI

### Start command

```bash
openclaw gateway
```

### Flags

| Flag | Description |
|------|-------------|
| `--port <number>` | Override gateway port (default: 18789) |
| `--verbose` | Enable verbose logging |
| `--force` | Force kill existing listener on port |

### Port configuration (precedence)

1. `--port` CLI flag
2. `OPENCLAW_GATEWAY_PORT` env var
3. `gateway.port` in `openclaw.json`
4. Default: `18789`

## Health Endpoint

```
GET http://localhost:18789/health → HTTP 200
```

Used in `verify.sh` line 57. Confirmed working.

## Config File

**Location:** `~/.openclaw/openclaw.json` (JSON5 format — comments and trailing commas allowed)

### Minimum viable config

```json5
{
  agents: {
    defaults: {
      workspace: "/workspace",
      model: {
        primary: "anthropic/claude-sonnet-4-5",
      },
    },
  },
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
    },
  },
}
```

### Full schema

```json5
{
  // Gateway settings (optional — CLI flags take precedence)
  gateway: {
    port: 18789,
  },

  // Agent defaults
  agents: {
    defaults: {
      workspace: "/workspace",

      // LLM model
      model: {
        primary: "anthropic/claude-sonnet-4-5",
        fallbacks: ["openai/gpt-4o-mini"],
      },

      // Sandbox (Docker isolation for bash commands)
      sandbox: {
        mode: "all",  // "all" | "none"
        docker: {
          image: "ghcr.io/navisevenseven/shipmate-sandbox:latest",
          mountWorkspace: true,
          workspaceAccess: "rw",
          env: [
            "GITHUB_TOKEN", "GITLAB_TOKEN", "GITLAB_HOST",
            "JIRA_BASE_URL", "JIRA_API_TOKEN", "JIRA_USER_EMAIL",
            "SHIPMATE_SCOPE_GITHUB_REPOS", "SHIPMATE_SCOPE_GITLAB_PROJECTS",
            "SHIPMATE_SCOPE_JIRA_PROJECTS", "SHIPMATE_SCOPE_JIRA_BOARDS",
          ],
        },
      },
    },
  },

  // Tool policy
  tools: {
    deny: ["group:fs", "group:ui", "group:nodes", "group:automation"],
    allow: ["bash", "shipmate_*"],
    elevated: { enabled: false },
  },

  // Skills
  skills: {
    entries: {
      shipmate: {
        enabled: true,
        env: {
          GITHUB_TOKEN: "...",
          GITLAB_TOKEN: "...",
          GITLAB_HOST: "...",
          JIRA_BASE_URL: "...",
          JIRA_API_TOKEN: "...",
          JIRA_USER_EMAIL: "...",
          SHIPMATE_SCOPE_GITHUB_REPOS: "...",
          SHIPMATE_SCOPE_GITLAB_PROJECTS: "...",
          SHIPMATE_SCOPE_JIRA_PROJECTS: "...",
          SHIPMATE_SCOPE_JIRA_BOARDS: "...",
        },
      },
    },
  },

  // Channels
  channels: {
    // Telegram (1 token)
    telegram: {
      enabled: true,
      botToken: "123456:ABC-DEF",
      dmPolicy: "pairing",   // "pairing" | "allowlist" | "open" | "disabled"
      allowFrom: [],          // telegram user IDs for DM allowlist
      groups: {
        "*": {                // "*" = all groups, or specific group ID
          requireMention: true,
        },
      },
    },

    // Slack (2 tokens)
    slack: {
      enabled: true,
      botToken: "xoxb-...",     // Bot User OAuth Token
      appToken: "xapp-...",     // App-Level Token (Socket Mode)
      channels: {
        "*": {
          requireMention: true,
        },
      },
    },

    // Discord (token + guild IDs)
    discord: {
      enabled: true,
      token: "...",             // Bot token
      guilds: {
        "guild_id": {           // Discord guild (server) ID
          requireMention: false,
        },
      },
    },
  },

  // Environment variables passed to skills
  env: {
    ANTHROPIC_API_KEY: "sk-ant-...",
    // or OPENAI_API_KEY: "sk-..."
  },
}
```

### Key patterns

- **API keys**: Set via top-level `env` section or as OS environment variables. OpenClaw reads both.
- **Channel tokens**: Always in `channels.<platform>` config section, not in `env`.
- **Skill env**: `skills.entries.<name>.env` passes vars to the skill's sandbox and tools.
- **Model provider**: Inferred from model name prefix (`anthropic/`, `openai/`).

## Model providers

| Provider | Model name format | Env var for key |
|----------|-------------------|-----------------|
| Anthropic | `anthropic/claude-sonnet-4-5` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai/gpt-4o` | `OPENAI_API_KEY` |

## Channel requirements

| Channel | Tokens needed | Token names |
|---------|---------------|-------------|
| Telegram | 1 | `botToken` |
| Slack | 2 | `botToken` (xoxb-*), `appToken` (xapp-*) |
| Discord | 1 + guild IDs | `token`, `guilds` object |
