#!/usr/bin/env bash
# ShipMate — Health Check / Verification Script
# Checks all integrations and reports status.
# Can be run repeatedly — no side effects.
#
# Usage:
#   ./setup/verify.sh
#   ./setup/verify.sh --openclaw-dir ~/.openclaw

set -uo pipefail

# ── Defaults ──────────────────────────────────────────────────
OPENCLAW_DIR="${HOME}/.openclaw"
OPENCLAW_PORT=18789

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()    { echo -e "  ${GREEN}✅${NC} $*"; }
warn()  { echo -e "  ${YELLOW}⚠️${NC}  $*"; }
fail()  { echo -e "  ${RED}❌${NC} $*"; }
info()  { echo -e "  ${BLUE}ℹ${NC}  $*"; }
header() { echo ""; echo "── $1 ───────────────────────────────────"; }

PASS=0
WARN=0
FAIL=0

check_pass() { ok "$*"; PASS=$((PASS + 1)); }
check_warn() { warn "$*"; WARN=$((WARN + 1)); }
check_fail() { fail "$*"; FAIL=$((FAIL + 1)); }

# ── Parse arguments ───────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --openclaw-dir) OPENCLAW_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--openclaw-dir <path>]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   🚢 ShipMate — Health Check        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. OpenClaw running ──────────────────────────────────────
echo "1. OpenClaw Status"
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${OPENCLAW_PORT}/health" 2>/dev/null | grep -q "200"; then
  check_pass "OpenClaw: running (port $OPENCLAW_PORT)"
else
  check_warn "OpenClaw: not running on port $OPENCLAW_PORT (start it before using ShipMate)"
fi

# ── 2. Workspace ─────────────────────────────────────────────
echo ""
echo "2. Workspace"

# Try to read workspace from config
WORKSPACE=""
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
if [[ -f "$CONFIG_FILE" ]]; then
  # Extract workspace path (handles JSON5 comments)
  WORKSPACE=$(grep -oP '"?workspace"?\s*:\s*"?\K[^",]+' "$CONFIG_FILE" 2>/dev/null | head -1 || echo "")
fi

if [[ -n "$WORKSPACE" ]] && [[ -d "$WORKSPACE" ]]; then
  if [[ -d "$WORKSPACE/.git" ]]; then
    check_pass "Workspace: $WORKSPACE (git repo)"
  else
    check_fail "Workspace: $WORKSPACE (exists but not a git repo)"
  fi
else
  check_fail "Workspace: not configured or path not found"
  info "Set agents.defaults.workspace in $CONFIG_FILE"
fi

# ── 3. Skills loaded ─────────────────────────────────────────
echo ""
echo "3. Skills"

EXPECTED_SKILLS=("shipmate" "code-review" "project-planning" "sprint-analytics" "system-design" "devops")
LOADED=0
TOTAL=${#EXPECTED_SKILLS[@]}

for skill in "${EXPECTED_SKILLS[@]}"; do
  if [[ -f "$OPENCLAW_DIR/skills/$skill/SKILL.md" ]]; then
    check_pass "Skill: $skill"
    LOADED=$((LOADED + 1))
  else
    check_warn "Skill not loaded: $skill"
  fi
done

echo ""
info "Skills: $LOADED/$TOTAL loaded"

# ── 4. Bootstrap ─────────────────────────────────────────────
echo ""
echo "4. Bootstrap"

for f in SOUL.md AGENTS.md; do
  if [[ -f "$OPENCLAW_DIR/workspace/$f" ]]; then
    check_pass "$f present"
  else
    check_fail "$f missing in $OPENCLAW_DIR/workspace/"
  fi
done

if [[ -f "$OPENCLAW_DIR/workspace/data/team-context.md" ]]; then
  # Check if it's filled or just template
  if grep -q '<!-- ' "$OPENCLAW_DIR/workspace/data/team-context.md" 2>/dev/null; then
    check_warn "data/team-context.md present (template — fill in your team data)"
  else
    check_pass "data/team-context.md present (configured)"
  fi
else
  check_warn "data/team-context.md not found (ShipMate will run onboarding)"
fi

# ── 5. GitLab auth ───────────────────────────────────────────
echo ""
echo "5. Service Connections"

# GitLab
if command -v glab &>/dev/null; then
  if glab auth status &>/dev/null 2>&1; then
    GL_HOST=$(glab auth status 2>&1 | grep -oP 'Logged in to \K[^ ]+' || echo "unknown")
    GL_USER=$(glab auth status 2>&1 | grep -oP 'as \K\S+' || echo "unknown")
    check_pass "GitLab: authenticated ($GL_HOST, $GL_USER)"
  else
    check_fail "GitLab: not authenticated"
    info "Run: glab auth login --hostname <your-gitlab-host>"
  fi
else
  check_warn "GitLab: glab CLI not installed"
fi

# GitHub
if command -v gh &>/dev/null; then
  if gh auth status &>/dev/null 2>&1; then
    GH_USER=$(gh auth status 2>&1 | grep -oP 'Logged in to .* as \K\S+' || echo "unknown")
    check_pass "GitHub: authenticated ($GH_USER)"
  else
    check_fail "GitHub: not authenticated"
    info "Run: gh auth login"
  fi
else
  check_warn "GitHub: gh CLI not installed"
fi

# Jira
JIRA_BASE_URL=""
JIRA_API_TOKEN=""
JIRA_USER_EMAIL=""
if [[ -f "$CONFIG_FILE" ]]; then
  JIRA_BASE_URL=$(grep -oP 'JIRA_BASE_URL"?\s*:\s*"?\K[^",]+' "$CONFIG_FILE" 2>/dev/null | head -1 || echo "")
  JIRA_API_TOKEN=$(grep -oP 'JIRA_API_TOKEN"?\s*:\s*"?\K[^",]+' "$CONFIG_FILE" 2>/dev/null | head -1 || echo "")
  JIRA_USER_EMAIL=$(grep -oP 'JIRA_USER_EMAIL"?\s*:\s*"?\K[^",]+' "$CONFIG_FILE" 2>/dev/null | head -1 || echo "")
fi

if [[ -n "$JIRA_BASE_URL" ]] && [[ -n "$JIRA_API_TOKEN" ]] && [[ -n "$JIRA_USER_EMAIL" ]]; then
  JIRA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
    "${JIRA_BASE_URL}/rest/api/3/myself" 2>/dev/null || echo "000")
  if [[ "$JIRA_STATUS" == "200" ]]; then
    JIRA_NAME=$(curl -s -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" \
      "${JIRA_BASE_URL}/rest/api/3/myself" 2>/dev/null | jq -r '.displayName' 2>/dev/null || echo "unknown")
    check_pass "Jira: connected (${JIRA_BASE_URL}, ${JIRA_NAME})"
  else
    check_fail "Jira: auth failed (HTTP $JIRA_STATUS)"
    info "Check JIRA_BASE_URL, JIRA_API_TOKEN, JIRA_USER_EMAIL in config"
  fi
else
  check_warn "Jira: not configured (JIRA_BASE_URL/JIRA_API_TOKEN/JIRA_USER_EMAIL empty)"
fi

# Kubernetes
if command -v kubectl &>/dev/null; then
  if kubectl cluster-info &>/dev/null 2>&1; then
    K8S_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "unknown")
    check_pass "Kubernetes: connected (context: $K8S_CONTEXT)"
  else
    check_fail "Kubernetes: not configured"
    info "Set KUBECONFIG or run: kubectl config set-context"
  fi
else
  check_warn "Kubernetes: kubectl not installed (devops skill unavailable)"
fi

# Sentry
SENTRY_URL=""
SENTRY_AUTH_TOKEN=""
if [[ -f "$CONFIG_FILE" ]]; then
  SENTRY_URL=$(grep -oP 'SENTRY_URL"?\s*:\s*"?\K[^",]+' "$CONFIG_FILE" 2>/dev/null | head -1 || echo "")
  SENTRY_AUTH_TOKEN=$(grep -oP 'SENTRY_AUTH_TOKEN"?\s*:\s*"?\K[^",]+' "$CONFIG_FILE" 2>/dev/null | head -1 || echo "")
fi

if [[ -n "$SENTRY_URL" ]] && [[ -n "$SENTRY_AUTH_TOKEN" ]]; then
  SENTRY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
    "${SENTRY_URL}/api/0/" 2>/dev/null || echo "000")
  if [[ "$SENTRY_STATUS" == "200" ]]; then
    check_pass "Sentry: connected ($SENTRY_URL)"
  else
    check_fail "Sentry: auth failed (HTTP $SENTRY_STATUS)"
  fi
else
  check_warn "Sentry: not configured (SENTRY_URL not set)"
fi

# ── 6. Security policy ───────────────────────────────────────
echo ""
echo "6. Security Policy"

if [[ -f "$CONFIG_FILE" ]]; then
  if grep -q 'group:fs' "$CONFIG_FILE" 2>/dev/null; then
    check_pass "Security: group:fs in deny list"
  else
    check_warn "Security: group:fs NOT in deny list (ok for local dev, required for team chat)"
  fi

  if grep -q '"elevated".*false\|elevated.*enabled.*false' "$CONFIG_FILE" 2>/dev/null; then
    check_pass "Security: elevated mode disabled"
  else
    check_warn "Security: elevated mode not explicitly disabled"
  fi
else
  check_warn "Security: config file not found at $CONFIG_FILE"
fi

# ── Scope Configuration ────────────────────────────────────
header "Scope Configuration"

# Check SHIPMATE_SCOPE_* vars from config
HAS_ANY_SCOPE=false

if [[ -n "${SHIPMATE_SCOPE_GITHUB_REPOS:-}" ]]; then
  ok "GitHub scope: $SHIPMATE_SCOPE_GITHUB_REPOS"
  HAS_ANY_SCOPE=true
else
  info "SHIPMATE_SCOPE_GITHUB_REPOS: not set"
fi

if [[ -n "${SHIPMATE_SCOPE_GITLAB_PROJECTS:-}" ]]; then
  ok "GitLab scope: $SHIPMATE_SCOPE_GITLAB_PROJECTS"
  HAS_ANY_SCOPE=true
else
  info "SHIPMATE_SCOPE_GITLAB_PROJECTS: not set"
fi

if [[ -n "${SHIPMATE_SCOPE_JIRA_PROJECTS:-}" ]]; then
  ok "Jira project scope: $SHIPMATE_SCOPE_JIRA_PROJECTS"
  HAS_ANY_SCOPE=true
else
  info "SHIPMATE_SCOPE_JIRA_PROJECTS: not set"
fi

if [[ -n "${SHIPMATE_SCOPE_JIRA_BOARDS:-}" ]]; then
  ok "Jira board scope: $SHIPMATE_SCOPE_JIRA_BOARDS"
else
  info "SHIPMATE_SCOPE_JIRA_BOARDS: not set (optional)"
fi

if [[ -n "${SHIPMATE_SCOPE_K8S_NAMESPACES:-}" ]]; then
  ok "K8s namespace scope: $SHIPMATE_SCOPE_K8S_NAMESPACES"
else
  info "SHIPMATE_SCOPE_K8S_NAMESPACES: not set (optional)"
fi

if [[ "$HAS_ANY_SCOPE" == false ]]; then
  check_fail "No scope configured — plugin tools will not register (fail-closed)"
fi

# ── Token Scope Validation ─────────────────────────────────
header "Token Scope Validation"

# GitHub: check if token sees only scoped repos
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  if [[ -n "${SHIPMATE_SCOPE_GITHUB_REPOS:-}" ]]; then
    VISIBLE_REPOS=$(gh api /user/repos --jq '.[].full_name' 2>/dev/null | tr '\n' ',' | sed 's/,$//' || echo "")
    EXPECTED_REPO=$(echo "$SHIPMATE_SCOPE_GITHUB_REPOS" | tr ',' '\n' | head -1 | xargs)

    if [[ -n "$VISIBLE_REPOS" ]]; then
      REPO_COUNT=$(echo "$VISIBLE_REPOS" | tr ',' '\n' | wc -l | xargs)
      if [[ $REPO_COUNT -le 2 ]]; then
        ok "GitHub token sees $REPO_COUNT repo(s): $VISIBLE_REPOS"
      else
        warn "GitHub token sees $REPO_COUNT repos — consider using a Fine-grained PAT scoped to $EXPECTED_REPO only"
      fi
    fi
  fi
fi

# .env.scoped check
if [[ -f ".env.scoped" ]]; then
  SCOPED_VAR_COUNT=$(grep -c "=" .env.scoped 2>/dev/null || echo "0")
  ok ".env.scoped exists ($SCOPED_VAR_COUNT variables)"

  # Check for dangerous vars that should NOT be in .env.scoped
  for dangerous_var in DATABASE_URL REDIS_URL AWS_SECRET_ACCESS_KEY; do
    if grep -q "^${dangerous_var}=" .env.scoped 2>/dev/null; then
      check_fail ".env.scoped contains $dangerous_var — this should not be in the sandbox!"
    fi
  done
else
  warn ".env.scoped not found — run setup/generate-scoped-env.sh"
fi

# Docker / Sandbox check
if command -v docker &>/dev/null; then
  if docker ps &>/dev/null 2>&1; then
    ok "Docker: available"
    if docker image inspect ghcr.io/navisevenseven/shipmate-sandbox:latest &>/dev/null 2>&1; then
      ok "Sandbox image: present"
    else
      warn "Sandbox image not found — run: docker pull ghcr.io/navisevenseven/shipmate-sandbox:latest"
    fi
  else
    warn "Docker: daemon not running"
  fi
else
  warn "Docker: not installed (sandbox requires Docker)"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "  Results: ${GREEN}$PASS passed${NC}, ${YELLOW}$WARN warnings${NC}, ${RED}$FAIL failed${NC}"
echo "═══════════════════════════════════════"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "  Fix the failed checks before using ShipMate in production."
  exit 1
else
  echo "  ShipMate is ready! Start OpenClaw and send a message."
  exit 0
fi
