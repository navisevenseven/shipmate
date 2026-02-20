#!/usr/bin/env node
// ShipMate — auto-config.js unit tests
// Runner: node --test setup/auto-config.test.js

"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Save original env and restore before each test
const originalEnv = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("SHIPMATE_") || key.startsWith("GITHUB_") || key.startsWith("GITLAB_") ||
        key.startsWith("JIRA_") || key.startsWith("TELEGRAM_") || key.startsWith("SLACK_") ||
        key.startsWith("DISCORD_") || key.startsWith("ANTHROPIC_") || key.startsWith("OPENAI_") ||
        key.startsWith("SENTRY_") || key.startsWith("GRAFANA_") || key === "OPENCLAW_DIR" ||
        key === "OPENCLAW_WORKSPACE") {
      delete process.env[key];
    }
  }
}

function setMinimalEnv() {
  process.env.SHIPMATE_REPOS = "myorg/myapp";
  process.env.GITHUB_TOKEN = "ghp_test123";
  process.env.TELEGRAM_BOT_TOKEN = "123456:ABC-DEF";
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
}

// Re-require module to pick up env changes
function loadModule() {
  delete require.cache[require.resolve("./auto-config.js")];
  return require("./auto-config.js");
}

// ── Repo parsing ───────────────────────────────────────────

describe("parseRepos", () => {
  beforeEach(resetEnv);

  it("parses single repo", () => {
    const { parseRepos } = loadModule();
    assert.deepEqual(parseRepos("owner/repo"), ["owner/repo"]);
  });

  it("parses comma-separated repos", () => {
    const { parseRepos } = loadModule();
    assert.deepEqual(parseRepos("org/a,org/b,org/c"), ["org/a", "org/b", "org/c"]);
  });

  it("trims whitespace", () => {
    const { parseRepos } = loadModule();
    assert.deepEqual(parseRepos(" org/a , org/b "), ["org/a", "org/b"]);
  });

  it("filters empty elements", () => {
    const { parseRepos } = loadModule();
    assert.deepEqual(parseRepos("org/a,,org/b,"), ["org/a", "org/b"]);
  });

  it("returns empty for empty string", () => {
    const { parseRepos } = loadModule();
    assert.deepEqual(parseRepos(""), []);
  });
});

describe("validateRepos", () => {
  beforeEach(resetEnv);

  it("accepts valid repo format", () => {
    const { validateRepos } = loadModule();
    assert.doesNotThrow(() => validateRepos(["owner/repo"]));
  });

  it("accepts repos with dots and hyphens", () => {
    const { validateRepos } = loadModule();
    assert.doesNotThrow(() => validateRepos(["my-org/my.repo-name"]));
  });

  it("rejects wildcard *", () => {
    const { validateRepos } = loadModule();
    assert.throws(() => validateRepos(["*"]), /Wildcards/);
  });

  it("rejects owner/* pattern", () => {
    const { validateRepos } = loadModule();
    assert.throws(() => validateRepos(["owner/*"]), /Wildcards/);
  });

  it("rejects empty string elements", () => {
    const { validateRepos } = loadModule();
    assert.throws(() => validateRepos([""]), /Invalid repo format/);
  });

  it("rejects bare owner without repo", () => {
    const { validateRepos } = loadModule();
    assert.throws(() => validateRepos(["owner"]), /Invalid repo format/);
  });
});

// ── Channel config ─────────────────────────────────────────

describe("buildChannels", () => {
  beforeEach(resetEnv);

  it("builds telegram channel from env", () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:ABC";
    const { buildTelegramChannel } = loadModule();
    const ch = buildTelegramChannel();
    assert.equal(ch.enabled, true);
    assert.equal(ch.botToken, "123456:ABC");
    assert.equal(ch.dmPolicy, "pairing");
  });

  it("builds slack channel with both tokens", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_APP_TOKEN = "xapp-test";
    const { buildSlackChannel } = loadModule();
    const ch = buildSlackChannel();
    assert.equal(ch.botToken, "xoxb-test");
    assert.equal(ch.appToken, "xapp-test");
  });

  it("throws if slack bot token set without app token", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    const { buildSlackChannel } = loadModule();
    assert.throws(() => buildSlackChannel(), /SLACK_APP_TOKEN is missing/);
  });

  it("builds discord channel with guild IDs", () => {
    process.env.DISCORD_BOT_TOKEN = "disc-token";
    process.env.DISCORD_GUILD_IDS = "111,222";
    const { buildDiscordChannel } = loadModule();
    const ch = buildDiscordChannel();
    assert.equal(ch.token, "disc-token");
    assert.ok(ch.guilds["111"]);
    assert.ok(ch.guilds["222"]);
  });

  it("throws if no channel configured", () => {
    const { buildChannels } = loadModule();
    assert.throws(() => buildChannels(), /No chat channel configured/);
  });
});

// ── Model config ───────────────────────────────────────────

describe("buildModel", () => {
  beforeEach(resetEnv);

  it("selects anthropic when ANTHROPIC_API_KEY set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { buildModel } = loadModule();
    const m = buildModel();
    assert.match(m.primary, /anthropic/);
  });

  it("selects openai when only OPENAI_API_KEY set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { buildModel } = loadModule();
    const m = buildModel();
    assert.match(m.primary, /openai/);
  });

  it("prefers anthropic when both set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.OPENAI_API_KEY = "sk-test";
    const { buildModel } = loadModule();
    const m = buildModel();
    assert.match(m.primary, /anthropic/);
  });

  it("throws when no LLM key set", () => {
    const { buildModel } = loadModule();
    assert.throws(() => buildModel(), /No LLM configured/);
  });
});

// ── Full config generation ─────────────────────────────────

describe("generateConfig", () => {
  beforeEach(resetEnv);

  it("generates valid config with minimal env", () => {
    setMinimalEnv();
    const { generateConfig } = loadModule();
    const config = generateConfig();
    assert.equal(config.agents.defaults.workspace, "/workspace");
    assert.ok(config.channels.telegram);
    assert.match(config.agents.defaults.model.primary, /anthropic/);
  });

  it("maps github single repo to scope", () => {
    setMinimalEnv();
    const { generateConfig } = loadModule();
    const config = generateConfig();
    assert.equal(
      config.skills.entries.shipmate.env.SHIPMATE_SCOPE_GITHUB_REPOS,
      "myorg/myapp"
    );
  });

  it("maps github multi-repo comma-separated", () => {
    setMinimalEnv();
    process.env.SHIPMATE_REPOS = "org/a,org/b";
    const { generateConfig } = loadModule();
    const config = generateConfig();
    assert.equal(
      config.skills.entries.shipmate.env.SHIPMATE_SCOPE_GITHUB_REPOS,
      "org/a,org/b"
    );
  });

  it("detects gitlab from GITLAB_TOKEN", () => {
    process.env.SHIPMATE_REPOS = "group/project";
    process.env.GITLAB_TOKEN = "glpat-test";
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { generateConfig } = loadModule();
    const config = generateConfig();
    assert.equal(
      config.skills.entries.shipmate.env.SHIPMATE_SCOPE_GITLAB_PROJECTS,
      "group/project"
    );
  });

  it("supports SHIPMATE_REPO singular (backward compat)", () => {
    process.env.SHIPMATE_REPO = "myorg/myapp";
    process.env.GITHUB_TOKEN = "ghp_test";
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { generateConfig } = loadModule();
    const config = generateConfig();
    assert.equal(
      config.skills.entries.shipmate.env.SHIPMATE_SCOPE_GITHUB_REPOS,
      "myorg/myapp"
    );
  });

  it("throws on missing SHIPMATE_REPOS", () => {
    process.env.GITHUB_TOKEN = "ghp_test";
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { generateConfig } = loadModule();
    assert.throws(() => generateConfig(), /SHIPMATE_REPOS is required/);
  });

  it("throws on missing platform token", () => {
    process.env.SHIPMATE_REPOS = "org/repo";
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { generateConfig } = loadModule();
    assert.throws(() => generateConfig(), /GITHUB_TOKEN or GITLAB_TOKEN/);
  });

  it("SHIPMATE_REPOS with wildcards rejects", () => {
    setMinimalEnv();
    process.env.SHIPMATE_REPOS = "owner/*";
    const { generateConfig } = loadModule();
    assert.throws(() => generateConfig(), /Wildcards/);
  });
});

// ── Security invariants ────────────────────────────────────

describe("security invariants", () => {
  beforeEach(resetEnv);

  it("tools.deny always includes group:fs", () => {
    setMinimalEnv();
    const { generateConfig } = loadModule();
    const config = generateConfig();
    assert.ok(config.tools.deny.includes("group:fs"));
  });

  it("tools.deny includes all required groups", () => {
    setMinimalEnv();
    const { generateConfig, SECURITY } = loadModule();
    const config = generateConfig();
    for (const group of SECURITY.toolsDeny) {
      assert.ok(config.tools.deny.includes(group), `Missing ${group} in tools.deny`);
    }
  });

  it("elevated.enabled is always false", () => {
    setMinimalEnv();
    const { generateConfig } = loadModule();
    const config = generateConfig();
    assert.equal(config.tools.elevated.enabled, false);
  });

  it("sandbox env whitelist excludes DATABASE_URL and AWS_*", () => {
    setMinimalEnv();
    const { SECURITY } = loadModule();
    for (const dangerous of ["DATABASE_URL", "AWS_SECRET_ACCESS_KEY", "AWS_ACCESS_KEY_ID", "REDIS_URL"]) {
      assert.ok(!SECURITY.sandboxEnvWhitelist.includes(dangerous), `${dangerous} should not be in whitelist`);
    }
  });

  it("SHIPMATE_DISABLE_SANDBOX=true sets sandbox mode none", () => {
    setMinimalEnv();
    process.env.SHIPMATE_DISABLE_SANDBOX = "true";
    const { generateConfig } = loadModule();
    const config = generateConfig();
    assert.equal(config.agents.defaults.sandbox.mode, "none");
  });

  it("sandbox mode is 'all' by default", () => {
    setMinimalEnv();
    const { generateConfig } = loadModule();
    const config = generateConfig();
    assert.equal(config.agents.defaults.sandbox.mode, "all");
  });
});

// ── Manual config validation ───────────────────────────────

describe("validateManualConfig", () => {
  beforeEach(resetEnv);
  const fs = require("fs");
  const os = require("os");
  const path = require("path");

  function writeTempConfig(obj) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shipmate-test-"));
    const configPath = path.join(tmpDir, "openclaw.json");
    fs.writeFileSync(configPath, JSON.stringify(obj, null, 2));
    return configPath;
  }

  it("passes valid manual config", () => {
    const configPath = writeTempConfig({
      tools: {
        deny: ["group:fs", "group:ui", "group:nodes", "group:automation"],
        elevated: { enabled: false },
      },
      agents: { defaults: { sandbox: { mode: "all" } } },
    });
    const { validateManualConfig } = loadModule();
    assert.doesNotThrow(() => validateManualConfig(configPath));
  });

  it("fails if tools.deny missing group:fs", () => {
    const configPath = writeTempConfig({
      tools: {
        deny: ["group:ui"],
        elevated: { enabled: false },
      },
      agents: { defaults: { sandbox: { mode: "all" } } },
    });
    const { validateManualConfig } = loadModule();
    assert.throws(() => validateManualConfig(configPath), /group:fs/);
  });

  it("fails if elevated.enabled is true", () => {
    const configPath = writeTempConfig({
      tools: {
        deny: ["group:fs"],
        elevated: { enabled: true },
      },
      agents: { defaults: { sandbox: { mode: "all" } } },
    });
    const { validateManualConfig } = loadModule();
    assert.throws(() => validateManualConfig(configPath), /elevated/);
  });

  it("fails if sandbox none without explicit opt-out", () => {
    const configPath = writeTempConfig({
      tools: {
        deny: ["group:fs"],
        elevated: { enabled: false },
      },
      agents: { defaults: { sandbox: { mode: "none" } } },
    });
    const { validateManualConfig } = loadModule();
    assert.throws(() => validateManualConfig(configPath), /sandbox/);
  });

  it("passes sandbox none with SHIPMATE_DISABLE_SANDBOX=true", () => {
    process.env.SHIPMATE_DISABLE_SANDBOX = "true";
    const configPath = writeTempConfig({
      tools: {
        deny: ["group:fs"],
        elevated: { enabled: false },
      },
      agents: { defaults: { sandbox: { mode: "none" } } },
    });
    const { validateManualConfig } = loadModule();
    assert.doesNotThrow(() => validateManualConfig(configPath));
  });

  it("fails if config file missing", () => {
    const { validateManualConfig } = loadModule();
    assert.throws(() => validateManualConfig("/nonexistent/path"), /not found/);
  });
});
