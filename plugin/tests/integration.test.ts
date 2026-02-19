import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ScopeGuard, ScopeViolationError } from "../lib/scope-guard.js";

describe("Integration: fail-closed registration logic", () => {
  it("hasGitHubScope blocks tools when no scope configured", () => {
    const guard = new ScopeGuard({ githubRepos: "" });
    assert.equal(guard.hasGitHubScope, false);
  });

  it("hasGitHubScope enables tools when scope is configured", () => {
    const guard = new ScopeGuard({ githubRepos: "acme/app" });
    assert.equal(guard.hasGitHubScope, true);
  });

  it("hasGitLabScope blocks tools when no scope configured", () => {
    const guard = new ScopeGuard({ gitlabProjects: "" });
    assert.equal(guard.hasGitLabScope, false);
  });

  it("hasJiraScope blocks tools when no scope configured", () => {
    const guard = new ScopeGuard({ jiraProjects: "" });
    assert.equal(guard.hasJiraScope, false);
  });
});

describe("Integration: tool handler scope violation", () => {
  const guard = new ScopeGuard({
    githubRepos: "acme/widget",
    gitlabProjects: "acme-group/widget",
    jiraProjects: "WIDGET",
    jiraBoards: "42",
  });

  it("GitHub: wrong repo returns ScopeViolationError", () => {
    try {
      guard.checkGitHub("evil-org", "secret-repo");
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ScopeViolationError);
      assert.equal(err.resource, "github");
      assert.ok(err.message.includes("not in the allowed list"));
    }
  });

  it("GitLab: wrong project returns ScopeViolationError", () => {
    try {
      guard.checkGitLab("other-group/secret-project");
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ScopeViolationError);
      assert.equal(err.resource, "gitlab");
    }
  });

  it("Jira: wrong board returns ScopeViolationError", () => {
    try {
      guard.checkJiraBoard(999);
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ScopeViolationError);
      assert.equal(err.resource, "jira-board");
    }
  });
});

describe("Integration: JQL injection in Jira search", () => {
  it("scopes simple JQL", () => {
    const guard = new ScopeGuard({ jiraProjects: "WIDGET" });
    const result = guard.scopeJQL("status = Open");
    assert.ok(result.includes("AND project IN"));
    assert.ok(result.includes('"WIDGET"'));
  });

  it("scopes JQL even when user specifies another project", () => {
    const guard = new ScopeGuard({ jiraProjects: "WIDGET" });
    const result = guard.scopeJQL("project = SECRET AND status = Open");
    assert.ok(result.includes("AND project IN"));
    assert.ok(result.includes('"WIDGET"'));
    assert.ok(result.startsWith("(project = SECRET AND status = Open)"));
  });

  it("multiple allowed projects appear in IN clause", () => {
    const guard = new ScopeGuard({ jiraProjects: "WIDGET,GADGET" });
    const result = guard.scopeJQL("status = Open");
    assert.ok(result.includes('"WIDGET"'));
    assert.ok(result.includes('"GADGET"'));
  });
});

describe("Integration: allowed access works", () => {
  const guard = new ScopeGuard({
    githubRepos: "acme/widget",
    gitlabProjects: "acme-group/widget",
    jiraBoards: "42",
  });

  it("GitHub: allowed repo passes", () => {
    assert.doesNotThrow(() => guard.checkGitHub("acme", "widget"));
  });

  it("GitLab: allowed project passes", () => {
    assert.doesNotThrow(() => guard.checkGitLab("acme-group/widget"));
  });

  it("Jira: allowed board passes", () => {
    assert.doesNotThrow(() => guard.checkJiraBoard(42));
  });
});
