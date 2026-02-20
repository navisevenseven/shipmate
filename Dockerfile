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
#     -e SHIPMATE_REPOS=owner/repo \
#     -e GITHUB_TOKEN=... \
#     -e TELEGRAM_BOT_TOKEN=... \
#     -e ANTHROPIC_API_KEY=... \
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

# ── OpenClaw (pinned version) ────────────────────────────────
ARG OPENCLAW_VERSION=0.12.0
RUN npm install -g openclaw@${OPENCLAW_VERSION} --ignore-scripts 2>/dev/null \
    || echo "WARN: openclaw@${OPENCLAW_VERSION} not found — ensure it is available or mount as volume"

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

# ── Environment (required vars documented in .env.example) ───
ENV OPENCLAW_WORKSPACE="/workspace"
ENV OPENCLAW_GATEWAY_PORT="18789"

# ── Healthcheck (checks actual OpenClaw gateway) ─────────────
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -sf http://localhost:${OPENCLAW_GATEWAY_PORT}/health || exit 1

# ── Expose gateway port ─────────────────────────────────────
EXPOSE ${OPENCLAW_GATEWAY_PORT}

# ── Entrypoint ──────────────────────────────────────────────
RUN chmod +x /app/setup/entrypoint.sh
ENTRYPOINT ["/app/setup/entrypoint.sh"]
