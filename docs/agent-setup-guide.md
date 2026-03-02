# ShipMate — Agent Setup Guide

You are guiding a user through ShipMate setup (~10-15 min).
The main time is spent by the user creating tokens in browser UIs.
Your job: guide, validate, deploy.

## Step 1: Prerequisites + Target Repo

CHECK: `docker` and `docker compose` available
DETECT: `git -C {user_project} remote get-url origin` → extract owner/repo
ASK user to confirm: "Set up ShipMate for {detected_repo}?"
IF not a git repo or different repo → ASK for repo URL
STORE: SHIPMATE_REPOS, PLATFORM (github|gitlab)

## Step 2: Platform Token

IF GitHub:
  TELL user:
  - Go to https://github.com/settings/personal-access-tokens/new
  - Repository access: Only select repositories → {detected_repo}
  - Permissions: Contents(R), PRs(RW), Issues(RW), Actions(R), Metadata(R)
  - Generate token and paste it here

IF GitLab:
  TELL user:
  - Go to GitLab → Settings → Access Tokens → Project Access Token
  - Scopes: read_api, read_repository, read_merge_request
  - Create and paste it here
  - ASK for GitLab host URL

ASK: "Paste the token"
Write token to .env file (NOT to terminal/command history)

VALIDATE (secure — token in env var, not in cmdline):
```bash
source .env && curl -sf -H "Authorization: token ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/{REPO}" > /dev/null && echo "✅ Valid" || echo "❌ Invalid"
```
IF fails → diagnose (wrong repo? missing permissions?) and re-ask
STORE: GITHUB_TOKEN or GITLAB_TOKEN

## Step 3: Chat Channel + Bot Token(s)

ASK: "Which chat platform? Telegram / Slack / Discord"

### Telegram (1 token)
TELL user:
1. Open https://t.me/BotFather in Telegram
2. Send /newbot
3. Choose a name and username
4. Copy the bot token

ASK: "Paste the bot token"
VALIDATE: `curl -sf "https://api.telegram.org/bot${TOKEN}/getMe"` → check `"ok":true`
STORE: TELEGRAM_BOT_TOKEN

### Slack (2 tokens)
TELL user:
1. Go to https://api.slack.com/apps → Create New App → From Scratch
2. OAuth & Permissions → Bot Token Scopes: `chat:write`, `channels:read`, `groups:read`, `im:read`, `mpim:read`
3. Install to Workspace → Copy Bot User OAuth Token (starts with `xoxb-`)
4. Basic Information → App-Level Tokens → Generate Token (scope: `connections:write`)
5. Copy App-Level Token (starts with `xapp-`)
6. Socket Mode → Enable Socket Mode

ASK: "Paste the Bot Token (xoxb-...)"
ASK: "Paste the App Token (xapp-...)"
STORE: SLACK_BOT_TOKEN, SLACK_APP_TOKEN

### Discord (token + guild IDs)
TELL user:
1. Go to https://discord.com/developers/applications → New Application
2. Bot → Privileged Gateway Intents → Enable: Message Content Intent
3. Bot → Reset Token → Copy
4. OAuth2 → URL Generator → Scopes: `bot` → Permissions: Send Messages, Read Message History
5. Use generated URL to invite bot to your server
6. Enable Developer Mode in Discord settings
7. Right-click server → Copy Server ID

ASK: "Paste the bot token"
ASK: "Paste the guild (server) ID(s), comma-separated"
STORE: DISCORD_BOT_TOKEN, DISCORD_GUILD_IDS

## Step 4: LLM + Optional Integrations

ASK: "LLM provider? Anthropic Claude (recommended) or OpenAI"

IF Anthropic:
  TELL: Go to https://console.anthropic.com/settings/keys
  ASK: "Paste API key"
  STORE: ANTHROPIC_API_KEY

IF OpenAI:
  TELL: Go to https://platform.openai.com/api-keys
  ASK: "Paste API key"
  STORE: OPENAI_API_KEY

ASK: "Use Jira integration? (optional)"
IF yes:
  TELL: Go to https://id.atlassian.com/manage-profile/security/api-tokens
  ASK: Jira base URL, API token, email
  STORE: JIRA_BASE_URL, JIRA_API_TOKEN, JIRA_USER_EMAIL

## Step 5: Generate Config + Deploy

Write all collected vars to `.env` file:
```bash
cat > /tmp/shipmate/.env << 'ENVEOF'
SHIPMATE_REPOS={value}
GITHUB_TOKEN={value}
TELEGRAM_BOT_TOKEN={value}
ANTHROPIC_API_KEY={value}
ENVEOF
chmod 600 /tmp/shipmate/.env
```

RUN: `cd /tmp/shipmate && ./setup/wizard.sh --non-interactive --env-file .env`

IF Railway deployment:
  Guide user to click Deploy button with env vars ready
  OR help set env vars in Railway dashboard

IF Docker Compose:
  RUN: `docker compose up -d`
  WAIT 30 seconds
  CHECK: `curl -sf http://localhost:3177/health` (port maps to OpenClaw 18789)
  IF unhealthy → `docker compose logs shipmate` → diagnose

## Step 6: Connect

IF Telegram:
  TELL: "Add @{bot_username} to your Telegram group and send a test message"
IF Slack:
  TELL: "Invite the bot to a Slack channel and mention it"
IF Discord:
  TELL: "The bot should be online in your Discord server. Send a message in the configured channel"

CONFIRM: user reports bot responds

## Troubleshooting

| Error | Diagnosis | Fix |
|-------|-----------|-----|
| `SHIPMATE_REPOS is required` | Missing env var | Set SHIPMATE_REPOS in .env |
| `Missing required env var: GITHUB_TOKEN or GITLAB_TOKEN` | No platform token | Add token to .env |
| `No chat channel configured` | No bot token | Add TELEGRAM/SLACK/DISCORD_BOT_TOKEN |
| `No LLM configured` | No API key | Add ANTHROPIC_API_KEY or OPENAI_API_KEY |
| `Invalid repo format` | Wildcard or wrong format | Use owner/repo format, no wildcards |
| `SLACK_APP_TOKEN is missing` | Only bot token set | Slack needs both xoxb- and xapp- tokens |
| Health check fails | OpenClaw not started | Check `docker compose logs shipmate` |
| Bot doesn't respond | Bot not in group | Invite bot to group, ensure correct token |
