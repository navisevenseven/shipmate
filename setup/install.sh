#!/usr/bin/env bash
# ShipMate — Installation Script
# Non-interactive. Validates environment, copies files, generates config.
#
# Usage:
#   ./setup/install.sh --workspace /path/to/project
#   ./setup/install.sh --workspace /path/to/project --openclaw-dir ~/.openclaw
#   ./setup/install.sh --workspace /path/to/project --skip-copy

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────
WORKSPACE=""
OPENCLAW_DIR="${HOME}/.openclaw"
SKIP_COPY=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

WARN_COUNT=0
FAIL_COUNT=0

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ok()   { echo -e "  ${GREEN}✅${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠️${NC}  $*"; WARN_COUNT=$((WARN_COUNT + 1)); }
fail() { echo -e "  ${RED}❌${NC} $*"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
info() { echo -e "  ${BLUE}ℹ${NC}  $*"; }
header() { echo -e "\n${BLUE}━━━ $* ━━━${NC}"; }

# ── Parse arguments ───────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --workspace)    WORKSPACE="$2"; shift 2 ;;
    --openclaw-dir) OPENCLAW_DIR="$2"; shift 2 ;;
    --skip-copy)    SKIP_COPY=true; shift ;;
    -h|--help)
      echo "Usage: $0 --workspace <path> [--openclaw-dir <path>] [--skip-copy]"
      echo ""
      echo "Options:"
      echo "  --workspace <path>     Path to target project (required)"
      echo "  --openclaw-dir <path>  Path to OpenClaw home (default: ~/.openclaw)"
      echo "  --skip-copy            Skip file copying (for re-validation only)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$WORKSPACE" ]]; then
  echo "Error: --workspace is required"
  echo "Usage: $0 --workspace /path/to/your/project"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   🚢 ShipMate — Installation Setup  ║"
echo "╚══════════════════════════════════════╝"

# ── Step 1: Validate workspace ────────────────────────────────
header "Step 1: Validate workspace"

WORKSPACE="$(cd "$WORKSPACE" 2>/dev/null && pwd)" || {
  fail "Workspace path does not exist: $WORKSPACE"
  exit 1
}

# Safety: reject dangerous paths
case "$WORKSPACE" in
  "$HOME"|"/"|"/Users/"*[!/]*[!/])
    # Allow /Users/name/something but not /Users/name itself
    if [[ "$WORKSPACE" == "$HOME" ]] || [[ "$WORKSPACE" == "/" ]]; then
      fail "Workspace must be a project directory, not $WORKSPACE"
      exit 1
    fi
    ;;
esac

if [[ ! -d "$WORKSPACE/.git" ]]; then
  fail "Workspace is not a git repository (no .git directory): $WORKSPACE"
  exit 1
fi

ok "Workspace: $WORKSPACE (git repo)"

# ── Step 2: Check CLI tools ───────────────────────────────────
header "Step 2: Check CLI tools"

check_bin() {
  local name="$1"
  local priority="$2"
  local used_by="$3"

  if command -v "$name" &>/dev/null; then
    local version
    version=$("$name" --version 2>&1 | head -1 || echo "unknown")
    ok "$name — $version"
    return 0
  else
    if [[ "$priority" == "P0" ]]; then
      warn "$name — not found (used by: $used_by)"
    else
      info "$name — not found (optional, used by: $used_by)"
    fi
    return 1
  fi
}

check_bin "git"        "P0" "all skills"
check_bin "glab"       "P0" "code-review, sprint-analytics (GitLab)"
check_bin "gh"         "P0" "code-review, sprint-analytics (GitHub)"
check_bin "jq"         "P0" "data processing, Jira integration"
check_bin "curl"       "P0" "Jira/Confluence/Sentry REST API"
HAS_KUBECTL=false
check_bin "kubectl"    "P1" "devops skill" && HAS_KUBECTL=true
check_bin "sentry-cli" "P1" "incident tracking"

# ── Step 3: Check auth status ─────────────────────────────────
header "Step 3: Check authentication"

GITLAB_HOST=""

# glab auth
if command -v glab &>/dev/null; then
  if glab auth status &>/dev/null 2>&1; then
    GITLAB_HOST=$(glab auth status 2>&1 | grep -oP 'Logged in to \K[^ ]+' || echo "")
    ok "glab: authenticated${GITLAB_HOST:+ ($GITLAB_HOST)}"
  else
    warn "glab: not authenticated. Run: glab auth login --hostname gitlab.yourhost.com"
  fi
fi

# gh auth
if command -v gh &>/dev/null; then
  if gh auth status &>/dev/null 2>&1; then
    GH_USER=$(gh auth status 2>&1 | grep -oP 'Logged in to .* as \K\S+' || echo "unknown")
    ok "gh: authenticated ($GH_USER)"
  else
    warn "gh: not authenticated. Run: gh auth login"
  fi
fi

# kubectl
if [[ "$HAS_KUBECTL" == true ]]; then
  if kubectl cluster-info &>/dev/null 2>&1; then
    ok "kubectl: cluster accessible"
  else
    info "kubectl: installed but no cluster configured"
  fi
fi

# ── Step 4: Copy files ────────────────────────────────────────
if [[ "$SKIP_COPY" == true ]]; then
  header "Step 4: Copy files (SKIPPED — --skip-copy)"
else
  header "Step 4: Copy files"

  mkdir -p "$OPENCLAW_DIR/skills"
  mkdir -p "$OPENCLAW_DIR/workspace"

  # Copy skills
  if [[ -d "$PROJECT_DIR/skills" ]]; then
    cp -r "$PROJECT_DIR/skills/"* "$OPENCLAW_DIR/skills/" 2>/dev/null || true
    SKILL_COUNT=$(find "$OPENCLAW_DIR/skills" -name "SKILL.md" | wc -l)
    ok "Skills: $SKILL_COUNT installed to $OPENCLAW_DIR/skills/"
  else
    fail "Skills directory not found: $PROJECT_DIR/skills"
  fi

  # Copy bootstrap
  if [[ -d "$PROJECT_DIR/bootstrap" ]]; then
    cp -r "$PROJECT_DIR/bootstrap/"* "$OPENCLAW_DIR/workspace/" 2>/dev/null || true
    ok "Bootstrap: SOUL.md, AGENTS.md, data/team-context.md"
  else
    fail "Bootstrap directory not found: $PROJECT_DIR/bootstrap"
  fi

  # Verify files are in place
  for f in SOUL.md AGENTS.md; do
    if [[ ! -f "$OPENCLAW_DIR/workspace/$f" ]]; then
      fail "Missing after copy: $OPENCLAW_DIR/workspace/$f"
    fi
  done
fi

# ── Step 5: Generate openclaw.json ────────────────────────────
header "Step 5: Generate configuration"

CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"

if [[ -f "$CONFIG_FILE" ]]; then
  info "Config already exists: $CONFIG_FILE (not overwriting)"
else
  TEMPLATE="$PROJECT_DIR/setup/openclaw.json.template"
  if [[ -f "$TEMPLATE" ]]; then
    sed \
      -e "s|{{WORKSPACE_PATH}}|${WORKSPACE}|g" \
      -e "s|{{GITLAB_HOST}}|${GITLAB_HOST:-gitlab.yourhost.com}|g" \
      "$TEMPLATE" > "$CONFIG_FILE"
    ok "Config generated: $CONFIG_FILE"
    info "Fill in your tokens in $CONFIG_FILE"
  else
    fail "Template not found: $TEMPLATE"
  fi
fi

# ── Step 6: Summary ──────────────────────────────────────────
header "Summary"

SKILL_NAMES=$(find "$OPENCLAW_DIR/skills" -name "SKILL.md" -exec dirname {} \; 2>/dev/null | xargs -I{} basename {} | sort | tr '\n' ', ' | sed 's/,$//' | sed 's/,/, /g')
SKILL_COUNT=$(find "$OPENCLAW_DIR/skills" -name "SKILL.md" 2>/dev/null | wc -l)

BIN_AVAILABLE=0
BIN_TOTAL=7
for bin in git glab gh jq curl kubectl sentry-cli; do
  command -v "$bin" &>/dev/null && BIN_AVAILABLE=$((BIN_AVAILABLE + 1))
done

echo ""
ok "Workspace: $WORKSPACE (git repo)"
ok "Skills: $SKILL_COUNT installed (${SKILL_NAMES:-none})"
ok "Bootstrap: SOUL.md, AGENTS.md, data/team-context.md"
ok "CLI: $BIN_AVAILABLE/$BIN_TOTAL tools available"

if [[ $WARN_COUNT -gt 0 ]]; then
  echo ""
  warn "$WARN_COUNT warning(s) — see above for details"
fi

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo ""
  fail "$FAIL_COUNT error(s) — fix before proceeding"
  exit 1
fi

echo ""
echo "  Next steps:"
echo "  1. Fill tokens in $CONFIG_FILE"
if command -v glab &>/dev/null && ! glab auth status &>/dev/null 2>&1; then
  echo "  2. Run: glab auth login --hostname <your-gitlab-host>"
fi
echo "  3. Start OpenClaw and send a message to ShipMate"
echo ""
