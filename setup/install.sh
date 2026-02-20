#!/usr/bin/env bash
# ShipMate — Installation Script (scoped mode)
# Validates environment, detects scope, copies files, generates config.
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

# Scope variables (populated in Step 2)
SCOPE_GITHUB_REPOS=""
SCOPE_GITLAB_PROJECTS=""
SCOPE_JIRA_PROJECTS=""
SCOPE_JIRA_BOARDS=""
SCOPE_K8S_NAMESPACES=""

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
echo ""
warn "DEPRECATED: install.sh is deprecated since v0.5.0."
info "Use setup/wizard.sh for interactive setup, or .env + auto-config.js for Docker/Railway."
echo ""

# ── Step 1: Validate workspace ────────────────────────────────
header "Step 1: Validate workspace"

WORKSPACE="$(cd "$WORKSPACE" 2>/dev/null && pwd)" || {
  fail "Workspace path does not exist: $WORKSPACE"
  exit 1
}

# Safety: reject dangerous paths
if [[ "$WORKSPACE" == "$HOME" ]] || [[ "$WORKSPACE" == "/" ]]; then
  fail "Workspace must be a project directory, not $WORKSPACE"
  exit 1
fi

if [[ ! -d "$WORKSPACE/.git" ]]; then
  fail "Workspace is not a git repository (no .git directory): $WORKSPACE"
  exit 1
fi

ok "Workspace: $WORKSPACE (git repo)"

# ── Step 2: Detect project scope ──────────────────────────────
header "Step 2: Configure project scope"

GIT_REMOTE=""
if git -C "$WORKSPACE" remote get-url origin &>/dev/null; then
  GIT_REMOTE=$(git -C "$WORKSPACE" remote get-url origin)
fi

if [[ -n "$GIT_REMOTE" ]]; then
  # Extract path (owner/repo or group/project or group/subgroup/project)
  GIT_PATH=""
  if [[ "$GIT_REMOTE" =~ ^git@[^:]+:(.+)$ ]]; then
    GIT_PATH="${BASH_REMATCH[1]%.git}"
  elif [[ "$GIT_REMOTE" =~ ^https?://[^/]+/(.+)$ ]]; then
    GIT_PATH="${BASH_REMATCH[1]%.git}"
  fi

  if [[ -n "$GIT_PATH" ]]; then
    if [[ "$GIT_REMOTE" =~ github\.com ]]; then
      SCOPE_GITHUB_REPOS="$GIT_PATH"
      ok "GitHub: $SCOPE_GITHUB_REPOS (from git remote)"
    elif [[ "$GIT_REMOTE" =~ gitlab ]]; then
      SCOPE_GITLAB_PROJECTS="$GIT_PATH"
      ok "GitLab: $SCOPE_GITLAB_PROJECTS (from git remote)"
    else
      info "Git remote not GitHub/GitLab: $GIT_REMOTE"
    fi
  fi
else
  warn "No git remote 'origin' — scope will be empty"
fi

# Interactive prompts (skip when piped / non-interactive)
ask_scope() {
  local prompt="$1"
  local default="$2"
  local var_ref="$3"
  local val
  read -r -p "  $prompt " val 2>/dev/null || true
  val="${val:-$default}"
  val=$(echo "$val" | xargs)
  if [[ -n "$val" ]] && [[ "$val" != "skip" ]]; then
    printf -v "$var_ref" "%s" "$val"
  fi
}

ask_scope "Jira project key? [skip]: " "skip" "SCOPE_JIRA_PROJECTS"
ask_scope "Jira board ID? [skip]: " "skip" "SCOPE_JIRA_BOARDS"
ask_scope "K8s namespace(s, comma-separated)? [skip]: " "skip" "SCOPE_K8S_NAMESPACES"

if [[ -z "$SCOPE_GITHUB_REPOS" ]] && [[ -z "$SCOPE_GITLAB_PROJECTS" ]]; then
  warn "No repo scope — configure SCOPE_GITHUB_REPOS or SCOPE_GITLAB_PROJECTS in config"
fi

# ── Step 3: Check CLI tools ───────────────────────────────────
header "Step 3: Check CLI tools"

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

check_bin "git"        "P0" "all skills" || true
check_bin "glab"       "P0" "code-review, sprint-analytics (GitLab)" || true
check_bin "gh"         "P0" "code-review, sprint-analytics (GitHub)" || true
check_bin "jq"         "P0" "data processing, Jira integration" || true
check_bin "curl"       "P0" "Jira/Confluence/Sentry REST API" || true
HAS_KUBECTL=false
check_bin "kubectl"    "P1" "devops skill" && HAS_KUBECTL=true || true
check_bin "sentry-cli" "P1" "incident tracking" || true

# ── Step 4: Check authentication + validate token scope ────────
header "Step 4: Check authentication"

GITLAB_HOST=""

# glab auth
if command -v glab &>/dev/null; then
  if glab auth status &>/dev/null 2>&1; then
    GITLAB_HOST=$(glab auth status 2>&1 | grep -oP 'Logged in to \K[^ ]+' 2>/dev/null || echo "")
    ok "glab: authenticated${GITLAB_HOST:+ ($GITLAB_HOST)}"
    if [[ -n "$SCOPE_GITLAB_PROJECTS" ]]; then
      info "Use Project Access Token (not Personal) for GitLab scope"
    fi
  else
    warn "glab: not authenticated. Run: glab auth login --hostname gitlab.yourhost.com"
  fi
fi

# gh auth + token scope validation
if command -v gh &>/dev/null; then
  if gh auth status &>/dev/null 2>&1; then
    GH_USER=$(gh auth status 2>&1 | grep -oP 'Logged in to .* as \K\S+' 2>/dev/null || echo "unknown")
    ok "gh: authenticated ($GH_USER)"

    # Validate token scope if we have GitHub repos in scope
    if [[ -n "$SCOPE_GITHUB_REPOS" ]]; then
      VISIBLE_REPOS=$(gh api /user/repos --jq '.[].full_name' 2>/dev/null || true)
      if [[ -n "$VISIBLE_REPOS" ]]; then
        # Build scope set (comma-separated → array)
        SCOPE_ARRAY=()
        IFS=',' read -ra PARTS <<< "$SCOPE_GITHUB_REPOS"
        for p in "${PARTS[@]}"; do
          SCOPE_ARRAY+=("$(echo "$p" | xargs)")
        done
        # Find visible repos not in scope
        EXTRA=""
        while IFS= read -r repo; do
          [[ -z "$repo" ]] && continue
          FOUND=false
          for s in "${SCOPE_ARRAY[@]}"; do
            [[ "$repo" == "$s" ]] && { FOUND=true; break; }
          done
          [[ "$FOUND" == false ]] && EXTRA="${EXTRA:+$EXTRA, }$repo"
        done <<< "$VISIBLE_REPOS"
        if [[ -n "$EXTRA" ]]; then
          warn "GitHub token sees repos outside scope: $EXTRA"
          info "Create Fine-grained PAT: github.com/settings/tokens → Fine-grained → Select only: $SCOPE_GITHUB_REPOS"
        else
          ok "GitHub token scope OK (only scoped repos visible)"
        fi
      fi
    fi
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

# ── Step 5: Copy files ────────────────────────────────────────
if [[ "$SKIP_COPY" == true ]]; then
  header "Step 5: Copy files (SKIPPED — --skip-copy)"
else
  header "Step 5: Copy files"

  mkdir -p "$OPENCLAW_DIR/skills"
  mkdir -p "$OPENCLAW_DIR/workspace"

  # Copy skills
  if [[ -d "$PROJECT_DIR/skills" ]]; then
    cp -r "$PROJECT_DIR/skills/"* "$OPENCLAW_DIR/skills/" 2>/dev/null || true
    SKILL_COUNT=$(find "$OPENCLAW_DIR/skills" -name "SKILL.md" 2>/dev/null | wc -l)
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

# ── Step 6: Generate openclaw.json ──────────────────────────────
header "Step 6: Generate configuration"

CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
TEMPLATE="$PROJECT_DIR/setup/openclaw.json.template"
mkdir -p "$OPENCLAW_DIR"

if [[ -f "$CONFIG_FILE" ]]; then
  info "Config already exists: $CONFIG_FILE (not overwriting)"
elif [[ -f "$TEMPLATE" ]]; then
  # Substitute all placeholders (use empty string for unset tokens)
  sed \
    -e "s|{{WORKSPACE_PATH}}|${WORKSPACE}|g" \
    -e "s|{{GITLAB_HOST}}|${GITLAB_HOST:-gitlab.yourhost.com}|g" \
    -e "s|{{GITHUB_TOKEN}}|${GITHUB_TOKEN:-}|g" \
    -e "s|{{GITLAB_TOKEN}}|${GITLAB_TOKEN:-}|g" \
    -e "s|{{JIRA_BASE_URL}}|${JIRA_BASE_URL:-}|g" \
    -e "s|{{JIRA_API_TOKEN}}|${JIRA_API_TOKEN:-}|g" \
    -e "s|{{JIRA_USER_EMAIL}}|${JIRA_USER_EMAIL:-}|g" \
    -e "s|{{SCOPE_GITHUB_REPOS}}|${SCOPE_GITHUB_REPOS}|g" \
    -e "s|{{SCOPE_GITLAB_PROJECTS}}|${SCOPE_GITLAB_PROJECTS}|g" \
    -e "s|{{SCOPE_JIRA_PROJECTS}}|${SCOPE_JIRA_PROJECTS}|g" \
    -e "s|{{SCOPE_JIRA_BOARDS}}|${SCOPE_JIRA_BOARDS}|g" \
    -e "s|{{SCOPE_K8S_NAMESPACES}}|${SCOPE_K8S_NAMESPACES}|g" \
    -e "s|{{SENTRY_URL}}|${SENTRY_URL:-}|g" \
    -e "s|{{SENTRY_AUTH_TOKEN}}|${SENTRY_AUTH_TOKEN:-}|g" \
    -e "s|{{SENTRY_ORG}}|${SENTRY_ORG:-}|g" \
    -e "s|{{SENTRY_PROJECT}}|${SENTRY_PROJECT:-}|g" \
    -e "s|{{GRAFANA_URL}}|${GRAFANA_URL:-}|g" \
    -e "s|{{GRAFANA_TOKEN}}|${GRAFANA_TOKEN:-}|g" \
    "$TEMPLATE" > "$CONFIG_FILE"
  ok "Config generated: $CONFIG_FILE"
  info "Fill in your tokens in $CONFIG_FILE (or use .env)"
elif [[ ! -f "$TEMPLATE" ]]; then
  info "Template removed in v0.5.0. Use setup/wizard.sh or auto-config.js instead."
fi

# ── Step 7: Generate .env.scoped ────────────────────────────────
header "Step 7: Generate .env.scoped"

if [[ -f "$PROJECT_DIR/setup/generate-scoped-env.sh" ]]; then
  if [[ -f "$WORKSPACE/.env" ]]; then
    if (cd "$WORKSPACE" && "$PROJECT_DIR/setup/generate-scoped-env.sh" --input .env --output .env.scoped 2>/dev/null); then
      ok ".env.scoped generated from $WORKSPACE/.env"
    else
      warn "generate-scoped-env.sh failed or .env.scoped not created"
    fi
  else
    info "No $WORKSPACE/.env — skip .env.scoped (create .env and re-run to generate)"
  fi
else
  info ".env.scoped flow removed in v0.5.0. Use .env directly with auto-config.js."
fi

# ── Step 8: Docker check ───────────────────────────────────────
header "Step 8: Docker check"

SANDBOX_IMAGE="ghcr.io/navisevenseven/shipmate-sandbox:latest"

if command -v docker &>/dev/null; then
  ok "docker: $(docker --version 2>&1 | head -1)"
  if docker image inspect "$SANDBOX_IMAGE" &>/dev/null 2>&1; then
    ok "Sandbox image: $SANDBOX_IMAGE (present)"
  else
    info "Sandbox image not pulled. Run: docker pull $SANDBOX_IMAGE"
  fi
else
  warn "docker: not found (required for sandbox mode)"
fi

# ── Step 9: Summary ─────────────────────────────────────────────
header "Summary"

SKILL_NAMES=$(find "$OPENCLAW_DIR/skills" -name "SKILL.md" -exec dirname {} \; 2>/dev/null | xargs -I{} basename {} 2>/dev/null | sort | tr '\n' ', ' | sed 's/,$//' | sed 's/,/, /g') || SKILL_NAMES="none"
SKILL_COUNT=$(find "$OPENCLAW_DIR/skills" -name "SKILL.md" 2>/dev/null | wc -l) || SKILL_COUNT=0

BIN_AVAILABLE=0
BIN_TOTAL=7
for bin in git glab gh jq curl kubectl sentry-cli; do
  command -v "$bin" &>/dev/null && BIN_AVAILABLE=$((BIN_AVAILABLE + 1))
done

echo ""
ok "Workspace: $WORKSPACE (git repo)"
ok "Scope: GitHub=$SCOPE_GITHUB_REPOS GitLab=$SCOPE_GITLAB_PROJECTS Jira=$SCOPE_JIRA_PROJECTS"
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
echo "  1. Fill tokens in $CONFIG_FILE (or create $WORKSPACE/.env)"
if [[ -f "$WORKSPACE/.env" ]]; then
  echo "  2. .env.scoped generated — use for sandbox isolation"
fi
if command -v glab &>/dev/null && ! glab auth status &>/dev/null 2>&1; then
  echo "  3. Run: glab auth login --hostname <your-gitlab-host>"
fi
echo "  4. Start OpenClaw and send a message to ShipMate"
echo ""
