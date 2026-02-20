#!/bin/bash
set -e

echo "╔══════════════════════════════════════╗"
echo "║   🚢 ShipMate v0.5.0                ║"
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
for var in GITHUB_TOKEN GITLAB_TOKEN JIRA_API_TOKEN ANTHROPIC_API_KEY OPENAI_API_KEY; do
    if [ -n "${!var}" ]; then
        echo "  ✅ $var: set"
    else
        echo "  ⚠️  $var: not set"
    fi
done

echo ""

# Generate config from env vars (or validate manual config)
echo "Configuring OpenClaw..."
node /app/setup/auto-config.js

echo ""

# Start OpenClaw gateway
if command -v openclaw &>/dev/null; then
    GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
    echo "Starting OpenClaw gateway on port ${GATEWAY_PORT}..."
    exec openclaw gateway --port "$GATEWAY_PORT" "$@"
else
    echo "OpenClaw not found — running in standalone mode."
    echo "Mount OpenClaw or install it: npm install -g openclaw"
    echo "Container will stay alive for debugging."
    exec tail -f /dev/null
fi
