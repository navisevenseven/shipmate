#!/usr/bin/env node
// ShipMate — Auto-configuration generator
// Reads env vars → generates ~/.openclaw/openclaw.json at container start.
// Runs on EVERY start (env vars = source of truth).
// If SHIPMATE_MANUAL_CONFIG=true → validates security invariants only.

"use strict";

const fs = require("fs");
const path = require("path");

// ── Config path ────────────────────────────────────────────
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(require("os").homedir(), ".openclaw");
const CONFIG_PATH = path.join(OPENCLAW_DIR, "openclaw.json");

// ── Security invariants (hardcoded, never from env) ────────
const SECURITY = {
  toolsDeny: ["group:fs", "group:ui", "group:nodes", "group:automation"],
  toolsAllow: ["bash", "shipmate_*"],
  elevatedEnabled: false,
  sandboxEnvWhitelist: [
    "GITHUB_TOKEN", "GITLAB_TOKEN", "GITLAB_HOST",
    "JIRA_BASE_URL", "JIRA_API_TOKEN", "JIRA_USER_EMAIL",
    "SENTRY_URL", "SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT",
    "GRAFANA_URL", "GRAFANA_TOKEN",
    "SHIPMATE_SCOPE_GITHUB_REPOS", "SHIPMATE_SCOPE_GITLAB_PROJECTS",
    "SHIPMATE_SCOPE_JIRA_PROJECTS", "SHIPMATE_SCOPE_JIRA_BOARDS",
  ],
};

// ── Helpers ────────────────────────────────────────────────

function env(name, fallback = "") {
  return process.env[name] || fallback;
}

function requireAny(names, description) {
  for (const name of names) {
    if (process.env[name]) return { name, value: process.env[name] };
  }
  const list = names.join(" or ");
  throw new Error(`Missing required env var: ${list} (${description})`);
}

function parseRepos(raw) {
  if (!raw) return [];
  return raw.split(",").map((r) => r.trim()).filter(Boolean);
}

function validateRepos(repos) {
  const pattern = /^[\w.\-]+\/[\w.\-]+$/;
  for (const repo of repos) {
    if (!pattern.test(repo)) {
      throw new Error(
        `Invalid repo format: "${repo}". Expected "owner/repo". Wildcards (* or owner/*) are rejected.`
      );
    }
  }
}

function detectPlatform(repos) {
  const gitlabToken = env("GITLAB_TOKEN");
  const githubToken = env("GITHUB_TOKEN");
  if (gitlabToken && !githubToken) return "gitlab";
  if (githubToken && !gitlabToken) return "github";
  if (githubToken) return "github";
  return "unknown";
}

// ── Channel config builders ────────────────────────────────

function buildTelegramChannel() {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) return null;
  return {
    enabled: true,
    botToken: token,
    dmPolicy: "pairing",
    groups: { "*": { requireMention: true } },
  };
}

function buildSlackChannel() {
  const botToken = env("SLACK_BOT_TOKEN");
  const appToken = env("SLACK_APP_TOKEN");
  if (!botToken) return null;
  if (!appToken) {
    throw new Error(
      "SLACK_BOT_TOKEN is set but SLACK_APP_TOKEN is missing. Slack requires both tokens."
    );
  }
  return {
    enabled: true,
    botToken,
    appToken,
    channels: { "*": { requireMention: true } },
  };
}

function buildDiscordChannel() {
  const token = env("DISCORD_BOT_TOKEN");
  if (!token) return null;
  const guildIds = env("DISCORD_GUILD_IDS");
  const guilds = {};
  if (guildIds) {
    for (const id of guildIds.split(",").map((s) => s.trim()).filter(Boolean)) {
      guilds[id] = { requireMention: false };
    }
  } else {
    guilds["*"] = { requireMention: true };
  }
  return { enabled: true, token, guilds };
}

function buildChannels() {
  const channels = {};
  const telegram = buildTelegramChannel();
  if (telegram) channels.telegram = telegram;
  const slack = buildSlackChannel();
  if (slack) channels.slack = slack;
  const discord = buildDiscordChannel();
  if (discord) channels.discord = discord;
  if (Object.keys(channels).length === 0) {
    throw new Error(
      "No chat channel configured. Set one of: TELEGRAM_BOT_TOKEN, SLACK_BOT_TOKEN, DISCORD_BOT_TOKEN"
    );
  }
  return channels;
}

// ── Model config builder ───────────────────────────────────

function buildModel() {
  const anthropicKey = env("ANTHROPIC_API_KEY");
  const openaiKey = env("OPENAI_API_KEY");
  if (!anthropicKey && !openaiKey) {
    throw new Error("No LLM configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY");
  }
  if (anthropicKey) {
    return { primary: "anthropic/claude-sonnet-4-5" };
  }
  return { primary: "openai/gpt-4o" };
}

// ── Skill env builder ──────────────────────────────────────

function buildSkillEnv(scopeGithubRepos, scopeGitlabProjects) {
  const skillEnv = {};

  const passthrough = [
    "GITHUB_TOKEN", "GITLAB_TOKEN", "GITLAB_HOST",
    "JIRA_BASE_URL", "JIRA_API_TOKEN", "JIRA_USER_EMAIL",
    "SENTRY_URL", "SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT",
    "GRAFANA_URL", "GRAFANA_TOKEN",
  ];
  for (const key of passthrough) {
    if (process.env[key]) skillEnv[key] = process.env[key];
  }

  if (scopeGithubRepos.length > 0) {
    skillEnv.SHIPMATE_SCOPE_GITHUB_REPOS = scopeGithubRepos.join(",");
  }
  if (scopeGitlabProjects.length > 0) {
    skillEnv.SHIPMATE_SCOPE_GITLAB_PROJECTS = scopeGitlabProjects.join(",");
  }
  const jiraProjects = env("SHIPMATE_SCOPE_JIRA_PROJECTS");
  if (jiraProjects) skillEnv.SHIPMATE_SCOPE_JIRA_PROJECTS = jiraProjects;
  const jiraBoards = env("SHIPMATE_SCOPE_JIRA_BOARDS");
  if (jiraBoards) skillEnv.SHIPMATE_SCOPE_JIRA_BOARDS = jiraBoards;

  return skillEnv;
}

// ── Sandbox config builder ─────────────────────────────────

function buildSandbox() {
  const disableSandbox = env("SHIPMATE_DISABLE_SANDBOX") === "true";
  if (disableSandbox) {
    console.warn("⚠️  SHIPMATE_DISABLE_SANDBOX=true — sandbox isolation disabled. This weakens security.");
    return { mode: "none" };
  }
  return {
    mode: "all",
    docker: {
      image: "ghcr.io/navisevenseven/shipmate-sandbox:latest",
      mountWorkspace: true,
      workspaceAccess: "rw",
      env: SECURITY.sandboxEnvWhitelist,
    },
  };
}

// ── Main config generator ──────────────────────────────────

function generateConfig() {
  // Parse repos (support both plural and singular)
  const reposRaw = env("SHIPMATE_REPOS") || env("SHIPMATE_REPO");
  if (!reposRaw) {
    throw new Error(
      "SHIPMATE_REPOS is required. Set to target repositories (comma-separated: owner/repo,owner/repo2)"
    );
  }
  const repos = parseRepos(reposRaw);
  validateRepos(repos);

  // Determine platform and assign scopes
  const platform = detectPlatform(repos);
  let scopeGithubRepos = [];
  let scopeGitlabProjects = [];
  if (platform === "gitlab") {
    scopeGitlabProjects = repos;
  } else {
    scopeGithubRepos = repos;
  }

  // Require at least one platform token
  requireAny(["GITHUB_TOKEN", "GITLAB_TOKEN"], "platform access token");

  // Build env section for API keys
  const envSection = {};
  if (env("ANTHROPIC_API_KEY")) envSection.ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY");
  if (env("OPENAI_API_KEY")) envSection.OPENAI_API_KEY = env("OPENAI_API_KEY");

  const workspace = env("OPENCLAW_WORKSPACE", "/workspace");

  const config = {
    agents: {
      defaults: {
        workspace,
        model: buildModel(),
        sandbox: buildSandbox(),
      },
    },
    tools: {
      deny: [...SECURITY.toolsDeny],
      allow: [...SECURITY.toolsAllow],
      elevated: { enabled: SECURITY.elevatedEnabled },
    },
    skills: {
      entries: {
        shipmate: {
          enabled: true,
          env: buildSkillEnv(scopeGithubRepos, scopeGitlabProjects),
        },
      },
    },
    channels: buildChannels(),
    env: envSection,
  };

  return config;
}

// ── Manual config validator ────────────────────────────────

function validateManualConfig(configPath) {
  let raw;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (err) {
    throw new Error(`SHIPMATE_MANUAL_CONFIG=true but config not found at ${configPath}`);
  }

  // Strip JSON5 comments for parsing
  const stripped = raw
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,\s*([\]}])/g, "$1");

  let config;
  try {
    config = JSON.parse(stripped);
  } catch (err) {
    throw new Error(`Failed to parse ${configPath}: ${err.message}`);
  }

  const errors = [];

  // Check tools.deny contains group:fs
  const deny = config?.tools?.deny || [];
  if (!deny.includes("group:fs")) {
    errors.push("tools.deny must include 'group:fs'");
  }

  // Check elevated.enabled is false
  if (config?.tools?.elevated?.enabled !== false) {
    errors.push("tools.elevated.enabled must be false");
  }

  // Check sandbox mode
  const sandboxMode = config?.agents?.defaults?.sandbox?.mode;
  const disableSandbox = env("SHIPMATE_DISABLE_SANDBOX") === "true";
  if (sandboxMode === "none" && !disableSandbox) {
    errors.push(
      'sandbox.mode is "none" but SHIPMATE_DISABLE_SANDBOX is not set. Set SHIPMATE_DISABLE_SANDBOX=true to confirm.'
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Security invariant violations in manual config:\n  - ${errors.join("\n  - ")}`
    );
  }

  console.log("✅ Manual config security invariants OK");
}

// ── Main ───────────────────────────────────────────────────

function main() {
  const isManual = env("SHIPMATE_MANUAL_CONFIG") === "true";

  if (isManual) {
    console.log("SHIPMATE_MANUAL_CONFIG=true — validating existing config...");
    validateManualConfig(CONFIG_PATH);
    return;
  }

  console.log("Generating OpenClaw config from env vars...");

  const config = generateConfig();

  fs.mkdirSync(OPENCLAW_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");

  console.log(`✅ Config written to ${CONFIG_PATH}`);

  // Summary
  const channels = Object.keys(config.channels).join(", ");
  const model = config.agents.defaults.model.primary;
  const repos = env("SHIPMATE_REPOS") || env("SHIPMATE_REPO");
  console.log(`   Channels: ${channels}`);
  console.log(`   Model: ${model}`);
  console.log(`   Repos: ${repos}`);
  console.log(`   Sandbox: ${config.agents.defaults.sandbox.mode}`);
}

// Export for testing
if (typeof module !== "undefined") {
  module.exports = {
    generateConfig,
    validateManualConfig,
    parseRepos,
    validateRepos,
    buildTelegramChannel,
    buildSlackChannel,
    buildDiscordChannel,
    buildChannels,
    buildModel,
    buildSkillEnv,
    buildSandbox,
    SECURITY,
  };
}

// Run if executed directly
if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}
