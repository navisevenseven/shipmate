# ShipMate — Production Image
#
# Full self-hosted deployment: OpenClaw gateway + ShipMate skills + plugin + CLI tools.
# For Railway, Docker Compose, or any container runtime.
#
# Build:
#   docker build -t shipmate .
#
# Run:
#   docker run -v /path/to/project:/workspace \
#     -e GITHUB_TOKEN=... -e GITLAB_TOKEN=... \
#     shipmate

# ── Stage 1: Build plugin ───────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build

# Install plugin dependencies and compile TypeScript
COPY plugin/package.json plugin/package-lock.json ./plugin/
RUN cd plugin && npm ci --ignore-scripts

COPY plugin/ ./plugin/
RUN cd plugin && npx tsc

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM node:20-slim

LABEL org.opencontainers.image.title="ShipMate"
LABEL org.opencontainers.image.description="AI Engineering PM — OpenClaw skills pack + plugin"
LABEL org.opencontainers.image.source="https://github.com/navisevenseven/shipmate"
LABEL org.opencontainers.image.licenses="MIT"

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

# ── System packages ──────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    jq \
    ca-certificates \
    gnupg \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# ── GitHub CLI (gh) ──────────────────────────────────────────
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# ── GitLab CLI (glab) ───────────────────────────────────────
ARG GLAB_VERSION=1.46.1
RUN ARCH=$(dpkg --print-architecture) \
    && curl -fsSL "https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/glab_${GLAB_VERSION}_linux_${ARCH}.deb" \
       -o /tmp/glab.deb \
    && dpkg -i /tmp/glab.deb \
    && rm /tmp/glab.deb

# ── kubectl ──────────────────────────────────────────────────
ARG KUBECTL_VERSION=1.31.4
RUN ARCH=$(dpkg --print-architecture) \
    && curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/${ARCH}/kubectl" \
       -o /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/kubectl

# ── OpenClaw (installed globally) ────────────────────────────
# OpenClaw is the runtime that loads ShipMate skills and plugin.
# Pin to a stable version; update when compatibility is verified.
ARG OPENCLAW_VERSION=latest
RUN npm install -g openclaw@${OPENCLAW_VERSION} --ignore-scripts 2>/dev/null \
    || echo "WARN: openclaw package not found — ensure it is available or mount as volume"

# ── Application layout ──────────────────────────────────────
WORKDIR /app

# Copy skills and bootstrap
COPY skills/ ./skills/
COPY bootstrap/ ./bootstrap/
COPY setup/ ./setup/

# Copy compiled plugin (from builder stage)
COPY --from=builder /build/plugin/dist/ ./plugin/dist/
COPY --from=builder /build/plugin/package.json ./plugin/
COPY --from=builder /build/plugin/openclaw.plugin.json ./plugin/
COPY --from=builder /build/plugin/node_modules/ ./plugin/node_modules/

# ── Workspace directory ──────────────────────────────────────
RUN mkdir -p /workspace
VOLUME /workspace

# ── Environment (all optional — graceful degradation) ────────
# GitHub
ENV GITHUB_TOKEN=""
# GitLab
ENV GITLAB_TOKEN=""
ENV GITLAB_HOST="https://gitlab.com"
# Jira
ENV JIRA_BASE_URL=""
ENV JIRA_API_TOKEN=""
ENV JIRA_USER_EMAIL=""
# Sentry
ENV SENTRY_URL=""
ENV SENTRY_AUTH_TOKEN=""
ENV SENTRY_ORG=""
ENV SENTRY_PROJECT=""
# Grafana
ENV GRAFANA_URL=""
ENV GRAFANA_TOKEN=""
# OpenClaw
ENV OPENCLAW_WORKSPACE="/workspace"

# ── Healthcheck ──────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "console.log('ok')" || exit 1

# ── Entrypoint ───────────────────────────────────────────────
# Start OpenClaw gateway with ShipMate configuration.
# Override CMD to pass additional arguments.
COPY <<'ENTRYPOINT_SCRIPT' /app/entrypoint.sh
#!/bin/bash
set -e

echo "╔══════════════════════════════════════╗"
echo "║   🚢 ShipMate v0.3.0                ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check workspace
if [ -d "/workspace/.git" ]; then
    echo "  ✅ Workspace: /workspace (git repo)"
else
    echo "  ⚠️  Workspace: /workspace (not a git repo — mount your project)"
fi

# Check tools
for tool in git gh glab jq curl kubectl; do
    if command -v "$tool" &>/dev/null; then
        echo "  ✅ $tool: $(command -v "$tool")"
    else
        echo "  ❌ $tool: not found"
    fi
done

echo ""

# Check tokens (presence only, not values)
for var in GITHUB_TOKEN GITLAB_TOKEN JIRA_API_TOKEN; do
    if [ -n "${!var}" ]; then
        echo "  ✅ $var: set"
    else
        echo "  ⚠️  $var: not set (optional)"
    fi
done

echo ""

# Start OpenClaw if available, otherwise keep container running
if command -v openclaw &>/dev/null; then
    echo "Starting OpenClaw gateway..."
    exec openclaw start --workspace "$OPENCLAW_WORKSPACE" "$@"
else
    echo "OpenClaw not found — running in standalone mode."
    echo "Mount OpenClaw or install it: npm install -g openclaw"
    echo "Container will stay alive for debugging."
    exec tail -f /dev/null
fi
ENTRYPOINT_SCRIPT

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
