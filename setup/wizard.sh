#!/usr/bin/env bash
# ShipMate — Interactive Setup Wizard
# Guides through configuration: repo → tokens → channel → LLM → optional Jira
# Generates .env file, validates via auto-config.js
#
# Usage:
#   ./setup/wizard.sh                                # Interactive (default)
#   ./setup/wizard.sh --non-interactive --env-file .env  # Read .env, validate, run auto-config
#   ./setup/wizard.sh --reset                        # Remove .env, show cleanup instructions
#   ./setup/wizard.sh --migrate                      # Extract tokens from existing openclaw.json → .env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Defaults ────────────────────────────────────────────────
MODE="interactive"
ENV_FILE="${PROJECT_DIR}/.env"
OPENCLAW_DIR="${HOME}/.openclaw"

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✅${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠️${NC}  $*"; }
fail() { echo -e "  ${RED}❌${NC} $*"; }
info() { echo -e "  ${BLUE}ℹ${NC}  $*"; }

# ── Parse arguments ────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --non-interactive) MODE="non-interactive"; shift ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --reset) MODE="reset"; shift ;;
    --migrate) MODE="migrate"; shift ;;
    -h|--help)
      echo "Usage: $0 [--non-interactive --env-file <path>] [--reset] [--migrate]"
      echo ""
      echo "Modes:"
      echo "  (default)          Interactive setup wizard"
      echo "  --non-interactive  Read .env, validate, run auto-config.js"
      echo "  --reset            Remove .env, show Docker cleanup instructions"
      echo "  --migrate          Extract config from existing openclaw.json → .env"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Reset mode ──────────────────────────────────────────────
if [[ "$MODE" == "reset" ]]; then
  echo ""
  echo -e "${BOLD}🚢 ShipMate — Reset${NC}"
  echo ""
  if [[ -f "$ENV_FILE" ]]; then
    rm "$ENV_FILE"
    ok "Removed $ENV_FILE"
  else
    info "$ENV_FILE not found (already clean)"
  fi
  echo ""
  echo "  To fully clean up Docker:"
  echo "    docker compose down -v"
  echo "    docker image rm shipmate shipmate-sandbox 2>/dev/null || true"
  echo ""
  exit 0
fi

# ── Migrate mode ─────────────────────────────────────────────
if [[ "$MODE" == "migrate" ]]; then
  echo ""
  echo -e "${BOLD}🚢 ShipMate — Migrate from openclaw.json${NC}"
  echo ""
  CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
  if [[ ! -f "$CONFIG_FILE" ]]; then
    fail "Config not found: $CONFIG_FILE"
    exit 1
  fi

  info "Reading $CONFIG_FILE..."

  # Extract values (handles JSON5 with comments)
  extract_val() {
    local key="$1"
    grep -oP "\"?${key}\"?\s*:\s*\"?\K[^\"',}]+" "$CONFIG_FILE" 2>/dev/null | head -1 || echo ""
  }

  GH_TOKEN=$(extract_val "GITHUB_TOKEN")
  GL_TOKEN=$(extract_val "GITLAB_TOKEN")
  GL_HOST=$(extract_val "GITLAB_HOST")
  JIRA_URL=$(extract_val "JIRA_BASE_URL")
  JIRA_TOKEN=$(extract_val "JIRA_API_TOKEN")
  JIRA_EMAIL=$(extract_val "JIRA_USER_EMAIL")
  SCOPE_GH=$(extract_val "SHIPMATE_SCOPE_GITHUB_REPOS")
  SCOPE_GL=$(extract_val "SHIPMATE_SCOPE_GITLAB_PROJECTS")
  SCOPE_JP=$(extract_val "SHIPMATE_SCOPE_JIRA_PROJECTS")
  SCOPE_JB=$(extract_val "SHIPMATE_SCOPE_JIRA_BOARDS")

  # Determine SHIPMATE_REPOS
  REPOS=""
  [[ -n "$SCOPE_GH" ]] && REPOS="$SCOPE_GH"
  [[ -n "$SCOPE_GL" ]] && REPOS="$SCOPE_GL"

  {
    echo "# Migrated from $CONFIG_FILE"
    echo "# Review and add missing values (bot token, LLM key)"
    echo ""
    [[ -n "$REPOS" ]] && echo "SHIPMATE_REPOS=$REPOS"
    [[ -n "$GH_TOKEN" ]] && echo "GITHUB_TOKEN=$GH_TOKEN"
    [[ -n "$GL_TOKEN" ]] && echo "GITLAB_TOKEN=$GL_TOKEN"
    [[ -n "$GL_HOST" ]] && echo "GITLAB_HOST=$GL_HOST"
    [[ -n "$JIRA_URL" ]] && echo "JIRA_BASE_URL=$JIRA_URL"
    [[ -n "$JIRA_TOKEN" ]] && echo "JIRA_API_TOKEN=$JIRA_TOKEN"
    [[ -n "$JIRA_EMAIL" ]] && echo "JIRA_USER_EMAIL=$JIRA_EMAIL"
    [[ -n "$SCOPE_JP" ]] && echo "SHIPMATE_SCOPE_JIRA_PROJECTS=$SCOPE_JP"
    [[ -n "$SCOPE_JB" ]] && echo "SHIPMATE_SCOPE_JIRA_BOARDS=$SCOPE_JB"
    echo ""
    echo "# TODO: Add these manually"
    echo "# TELEGRAM_BOT_TOKEN="
    echo "# ANTHROPIC_API_KEY="
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  ok "Migrated to $ENV_FILE"
  warn "Add TELEGRAM_BOT_TOKEN (or SLACK/DISCORD) and ANTHROPIC_API_KEY (or OPENAI)"
  echo ""
  exit 0
fi

# ── Non-interactive mode ─────────────────────────────────────
if [[ "$MODE" == "non-interactive" ]]; then
  echo ""
  echo -e "${BOLD}🚢 ShipMate — Non-interactive Setup${NC}"
  echo ""
  if [[ ! -f "$ENV_FILE" ]]; then
    fail "Env file not found: $ENV_FILE"
    exit 1
  fi

  info "Loading $ENV_FILE..."
  set -a
  source "$ENV_FILE"
  set +a

  info "Validating via auto-config.js..."
  node "$SCRIPT_DIR/auto-config.js"
  echo ""
  ok "Configuration valid"
  echo ""
  echo "  Next: docker compose up -d"
  echo ""
  exit 0
fi

# ══════════════════════════════════════════════════════════════
# Interactive mode
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}🚢 ShipMate Setup Wizard${NC}"
echo ""

# Collected vars
declare -A VARS

# ── Step 1: Repository ──────────────────────────────────────
echo -e "${CYAN}Step 1/5: Repository${NC}"

# Try auto-detect from git remote
DETECTED_REPO=""
if git remote get-url origin &>/dev/null 2>&1; then
  REMOTE=$(git remote get-url origin)
  if [[ "$REMOTE" =~ ^git@[^:]+:(.+)$ ]]; then
    DETECTED_REPO="${BASH_REMATCH[1]%.git}"
  elif [[ "$REMOTE" =~ ^https?://[^/]+/(.+)$ ]]; then
    DETECTED_REPO="${BASH_REMATCH[1]%.git}"
  fi
fi

if [[ -n "$DETECTED_REPO" ]]; then
  echo -e "  Detected: ${GREEN}$DETECTED_REPO${NC}"
  read -r -p "  Target repository? [$DETECTED_REPO]: " INPUT_REPO
  INPUT_REPO="${INPUT_REPO:-$DETECTED_REPO}"
else
  read -r -p "  Target repository? (owner/repo or comma-separated): " INPUT_REPO
fi

if [[ -z "$INPUT_REPO" ]]; then
  fail "Repository is required"
  exit 1
fi

# Validate format
IFS=',' read -ra REPO_PARTS <<< "$INPUT_REPO"
for r in "${REPO_PARTS[@]}"; do
  r=$(echo "$r" | xargs)
  if [[ ! "$r" =~ ^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$ ]]; then
    fail "Invalid repo format: $r (expected: owner/repo)"
    exit 1
  fi
done
VARS[SHIPMATE_REPOS]="$INPUT_REPO"

# Detect platform
PLATFORM="github"
if [[ "$REMOTE" =~ gitlab ]]; then
  PLATFORM="gitlab"
fi
ok "${PLATFORM^}: $INPUT_REPO"
echo ""

# ── Step 2: Platform Token ──────────────────────────────────
echo -e "${CYAN}Step 2/5: Platform Token${NC}"

if [[ "$PLATFORM" == "github" ]]; then
  echo "  Fine-grained PAT for $INPUT_REPO"
  echo -e "  → ${BLUE}https://github.com/settings/personal-access-tokens/new${NC}"
  echo "  → Repository access: Only select → $INPUT_REPO"
  echo "  → Permissions: Contents(R), PRs(RW), Issues(RW), Actions(R)"
  echo ""
  read -rs -p "  Token: " GH_TOKEN
  echo ""

  if [[ -z "$GH_TOKEN" ]]; then
    fail "Token is required"
    exit 1
  fi

  # Validate
  FIRST_REPO=$(echo "$INPUT_REPO" | cut -d',' -f1 | xargs)
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: token ${GH_TOKEN}" \
    "https://api.github.com/repos/${FIRST_REPO}" 2>/dev/null || echo "000")

  if [[ "$HTTP_CODE" == "200" ]]; then
    ok "Token valid, access to $FIRST_REPO confirmed"
  else
    fail "Token validation failed (HTTP $HTTP_CODE). Check repo name and permissions."
    exit 1
  fi
  VARS[GITHUB_TOKEN]="$GH_TOKEN"
else
  echo "  GitLab Project Access Token for $INPUT_REPO"
  echo -e "  → GitLab → Settings → Access Tokens → Project Access Token"
  echo "  → Scopes: read_api, read_repository, read_merge_request"
  echo ""
  read -rs -p "  Token: " GL_TOKEN
  echo ""

  if [[ -z "$GL_TOKEN" ]]; then
    fail "Token is required"
    exit 1
  fi
  VARS[GITLAB_TOKEN]="$GL_TOKEN"

  read -r -p "  GitLab host? [https://gitlab.com]: " GL_HOST
  GL_HOST="${GL_HOST:-https://gitlab.com}"
  VARS[GITLAB_HOST]="$GL_HOST"

  ok "GitLab token set for $INPUT_REPO"
fi
echo ""

# ── Step 3: Chat Channel ───────────────────────────────────
echo -e "${CYAN}Step 3/5: Chat Channel${NC}"
echo "  Where should ShipMate live?"
echo "  1) Telegram"
echo "  2) Slack"
echo "  3) Discord"
echo ""
read -r -p "  > " CHANNEL_CHOICE

case "$CHANNEL_CHOICE" in
  1|telegram|Telegram)
    echo ""
    echo "  Create a bot via @BotFather → /newbot"
    echo ""
    read -rs -p "  Bot token: " TG_TOKEN
    echo ""
    if [[ -z "$TG_TOKEN" ]]; then
      fail "Bot token is required"
      exit 1
    fi

    # Validate
    BOT_INFO=$(curl -sf "https://api.telegram.org/bot${TG_TOKEN}/getMe" 2>/dev/null || echo "")
    if echo "$BOT_INFO" | grep -q '"ok":true'; then
      BOT_NAME=$(echo "$BOT_INFO" | grep -oP '"username"\s*:\s*"\K[^"]+' || echo "unknown")
      ok "Bot: @$BOT_NAME"
    else
      fail "Invalid bot token"
      exit 1
    fi
    VARS[TELEGRAM_BOT_TOKEN]="$TG_TOKEN"
    ;;

  2|slack|Slack)
    echo ""
    echo "  Create a Slack App:"
    echo -e "  → ${BLUE}https://api.slack.com/apps${NC} → Create New App"
    echo "  → OAuth & Permissions → Bot Token Scopes: chat:write, channels:read, groups:read"
    echo "  → Install to Workspace"
    echo ""
    read -rs -p "  Bot Token (xoxb-...): " SLACK_BOT
    echo ""
    if [[ -z "$SLACK_BOT" ]]; then
      fail "Bot token is required"
      exit 1
    fi
    VARS[SLACK_BOT_TOKEN]="$SLACK_BOT"

    echo ""
    echo "  → App-Level Tokens → Generate Token (connections:write scope)"
    echo ""
    read -rs -p "  App Token (xapp-...): " SLACK_APP
    echo ""
    if [[ -z "$SLACK_APP" ]]; then
      fail "App token is required for Socket Mode"
      exit 1
    fi
    VARS[SLACK_APP_TOKEN]="$SLACK_APP"
    ok "Slack tokens set"
    ;;

  3|discord|Discord)
    echo ""
    echo "  Create a Discord Bot:"
    echo -e "  → ${BLUE}https://discord.com/developers/applications${NC} → New Application"
    echo "  → Bot → Privileged Gateway Intents: Message Content"
    echo "  → Reset Token → Copy"
    echo ""
    read -rs -p "  Bot Token: " DISC_TOKEN
    echo ""
    if [[ -z "$DISC_TOKEN" ]]; then
      fail "Bot token is required"
      exit 1
    fi
    VARS[DISCORD_BOT_TOKEN]="$DISC_TOKEN"

    echo ""
    echo "  Guild (server) IDs where bot is allowed (comma-separated)."
    echo "  Enable Developer Mode in Discord → Right-click server → Copy Server ID"
    echo ""
    read -r -p "  Guild IDs: " DISC_GUILDS
    if [[ -n "$DISC_GUILDS" ]]; then
      VARS[DISCORD_GUILD_IDS]="$DISC_GUILDS"
    fi
    ok "Discord token set"
    ;;

  *)
    fail "Invalid choice: $CHANNEL_CHOICE"
    exit 1
    ;;
esac
echo ""

# ── Step 4: LLM Provider ───────────────────────────────────
echo -e "${CYAN}Step 4/5: LLM Provider${NC}"
echo "  1) Anthropic Claude (recommended)"
echo "  2) OpenAI GPT"
echo ""
read -r -p "  > " LLM_CHOICE

case "$LLM_CHOICE" in
  1|anthropic|Anthropic)
    echo ""
    echo -e "  → ${BLUE}https://console.anthropic.com/settings/keys${NC}"
    read -rs -p "  API key: " ANT_KEY
    echo ""
    if [[ -z "$ANT_KEY" ]]; then
      fail "API key is required"
      exit 1
    fi
    VARS[ANTHROPIC_API_KEY]="$ANT_KEY"
    ok "Anthropic API key set"
    ;;

  2|openai|OpenAI)
    echo ""
    echo -e "  → ${BLUE}https://platform.openai.com/api-keys${NC}"
    read -rs -p "  API key: " OAI_KEY
    echo ""
    if [[ -z "$OAI_KEY" ]]; then
      fail "API key is required"
      exit 1
    fi
    VARS[OPENAI_API_KEY]="$OAI_KEY"
    ok "OpenAI API key set"
    ;;

  *)
    fail "Invalid choice: $LLM_CHOICE"
    exit 1
    ;;
esac
echo ""

# ── Step 5: Optional — Jira ────────────────────────────────
echo -e "${CYAN}Step 5/5: Optional — Jira${NC}"
read -r -p "  Use Jira? (y/N): " USE_JIRA

if [[ "${USE_JIRA,,}" == "y" ]]; then
  read -r -p "  Jira URL (https://yourorg.atlassian.net): " JIRA_URL
  VARS[JIRA_BASE_URL]="$JIRA_URL"

  echo -e "  → ${BLUE}https://id.atlassian.com/manage-profile/security/api-tokens${NC}"
  read -rs -p "  API token: " JIRA_TOKEN
  echo ""
  VARS[JIRA_API_TOKEN]="$JIRA_TOKEN"

  read -r -p "  Email: " JIRA_EMAIL
  VARS[JIRA_USER_EMAIL]="$JIRA_EMAIL"

  read -r -p "  Project keys (comma-separated, optional): " JIRA_PROJ
  [[ -n "$JIRA_PROJ" ]] && VARS[SHIPMATE_SCOPE_JIRA_PROJECTS]="$JIRA_PROJ"

  read -r -p "  Board IDs (comma-separated, optional): " JIRA_BOARDS
  [[ -n "$JIRA_BOARDS" ]] && VARS[SHIPMATE_SCOPE_JIRA_BOARDS]="$JIRA_BOARDS"

  # Validate Jira connection
  if [[ -n "$JIRA_URL" ]] && [[ -n "$JIRA_TOKEN" ]] && [[ -n "$JIRA_EMAIL" ]]; then
    JIRA_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
      -u "${JIRA_EMAIL}:${JIRA_TOKEN}" \
      "${JIRA_URL}/rest/api/3/myself" 2>/dev/null || echo "000")
    if [[ "$JIRA_STATUS" == "200" ]]; then
      ok "Jira connected"
    else
      warn "Jira auth check failed (HTTP $JIRA_STATUS) — double-check credentials"
    fi
  fi
fi
echo ""

# ── Write .env ──────────────────────────────────────────────
{
  echo "# Generated by ShipMate wizard — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for key in "${!VARS[@]}"; do
    echo "${key}=${VARS[$key]}"
  done
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"

ok ".env created (chmod 600)"

# ── Validate via auto-config.js ─────────────────────────────
echo ""
info "Validating configuration..."
set -a
source "$ENV_FILE"
set +a

if node "$SCRIPT_DIR/auto-config.js"; then
  ok "Config validated via auto-config.js"
else
  fail "Validation failed — check errors above"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "  Next: docker compose up -d"

# Show bot-specific instructions
if [[ -n "${VARS[TELEGRAM_BOT_TOKEN]:-}" ]]; then
  echo "  Then: add your bot to a Telegram group"
elif [[ -n "${VARS[SLACK_BOT_TOKEN]:-}" ]]; then
  echo "  Then: invite your bot to a Slack channel"
elif [[ -n "${VARS[DISCORD_BOT_TOKEN]:-}" ]]; then
  echo "  Then: add your bot to a Discord server"
fi

echo ""
echo "  Trouble? Run: ./setup/wizard.sh --reset"
echo ""
