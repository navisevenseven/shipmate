import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ScopeGuard, ScopeViolationError } from "../lib/scope-guard.js";

describe("ScopeGuard", () => {
  describe("constructor / parsing", () => {
    it("parses comma-separated GitHub repos", () => {
      const g = new ScopeGuard({ githubRepos: "acme/app, acme/lib" });
      assert.equal(g.hasGitHubScope, true);
      assert.doesNotThrow(() => g.checkGitHub("acme", "app"));
      assert.doesNotThrow(() => g.checkGitHub("acme", "lib"));
    });

    it("returns empty sets for undefined values", () => {
      const g = new ScopeGuard({});
      assert.equal(g.hasGitHubScope, false);
      assert.equal(g.hasGitLabScope, false);
      assert.equal(g.hasJiraScope, false);
    });

    it("returns empty sets for empty strings", () => {
      const g = new ScopeGuard({ githubRepos: "", gitlabProjects: "  " });
      assert.equal(g.hasGitHubScope, false);
      assert.equal(g.hasGitLabScope, false);
    });

    it("handles whitespace and trailing commas", () => {
      const g = new ScopeGuard({ githubRepos: " acme/app , , acme/lib ," });
      assert.doesNotThrow(() => g.checkGitHub("acme", "app"));
      assert.doesNotThrow(() => g.checkGitHub("acme", "lib"));
    });

    it("parses Jira boards as numbers", () => {
      const g = new ScopeGuard({ jiraBoards: "42, 99, abc" });
      assert.doesNotThrow(() => g.checkJiraBoard(42));
      assert.doesNotThrow(() => g.checkJiraBoard(99));
    });
  });

  describe("checkGitHub", () => {
    const guard = new ScopeGuard({ githubRepos: "acme/widget" });

    it("allows access to scoped repo", () => {
      assert.doesNotThrow(() => guard.checkGitHub("acme", "widget"));
    });

    it("is case-insensitive", () => {
      assert.doesNotThrow(() => guard.checkGitHub("Acme", "Widget"));
      assert.doesNotThrow(() => guard.checkGitHub("ACME", "WIDGET"));
    });

    it("blocks access to out-of-scope repo", () => {
      assert.throws(
        () => guard.checkGitHub("acme", "secret-project"),
        ScopeViolationError,
      );
    });

    it("throws ScopeViolationError with correct fields", () => {
      try {
        guard.checkGitHub("other-org", "other-repo");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof ScopeViolationError);
        assert.equal(err.resource, "github");
        assert.equal(err.requested, "other-org/other-repo");
        assert.deepEqual(err.allowed, ["acme/widget"]);
      }
    });
  });

  describe("checkGitLab", () => {
    const guard = new ScopeGuard({ gitlabProjects: "group/subgroup/project" });

    it("allows access to scoped project", () => {
      assert.doesNotThrow(() => guard.checkGitLab("group/subgroup/project"));
    });

    it("is case-insensitive", () => {
      assert.doesNotThrow(() => guard.checkGitLab("Group/Subgroup/Project"));
    });

    it("blocks access to out-of-scope project", () => {
      assert.throws(
        () => guard.checkGitLab("other-group/other-project"),
        ScopeViolationError,
      );
    });
  });

  describe("checkJiraBoard", () => {
    it("allows access to scoped board", () => {
      const g = new ScopeGuard({ jiraBoards: "42" });
      assert.doesNotThrow(() => g.checkJiraBoard(42));
    });

    it("blocks access to out-of-scope board", () => {
      const g = new ScopeGuard({ jiraBoards: "42" });
      assert.throws(() => g.checkJiraBoard(999), ScopeViolationError);
    });

    it("skips check when no boards configured", () => {
      const g = new ScopeGuard({});
      assert.doesNotThrow(() => g.checkJiraBoard(999));
    });
  });

  describe("scopeJQL", () => {
    it("injects project filter into JQL", () => {
      const g = new ScopeGuard({ jiraProjects: "SHIP" });
      const result = g.scopeJQL('status = "In Progress"');
      assert.equal(result, '(status = "In Progress") AND project IN ("SHIP")');
    });

    it("handles multiple projects", () => {
      const g = new ScopeGuard({ jiraProjects: "SHIP,PROJ" });
      const result = g.scopeJQL("status = Open");
      assert.equal(result, '(status = Open) AND project IN ("SHIP", "PROJ")');
    });

    it("wraps complex JQL correctly", () => {
      const g = new ScopeGuard({ jiraProjects: "SHIP" });
      const result = g.scopeJQL("project = OTHER AND status = Open");
      assert.equal(
        result,
        '(project = OTHER AND status = Open) AND project IN ("SHIP")',
      );
    });

    it("returns original JQL when no projects configured", () => {
      const g = new ScopeGuard({});
      const jql = "status = Open";
      assert.equal(g.scopeJQL(jql), jql);
    });

    it("preserves Jira project keys case (not lowercased)", () => {
      const g = new ScopeGuard({ jiraProjects: "SHIP" });
      const result = g.scopeJQL("status = Open");
      assert.ok(result.includes('"SHIP"'));
    });
  });

  describe("scope getters", () => {
    it("hasGitHubScope is true when repos configured", () => {
      assert.equal(new ScopeGuard({ githubRepos: "a/b" }).hasGitHubScope, true);
    });

    it("hasGitHubScope is false when empty", () => {
      assert.equal(new ScopeGuard({}).hasGitHubScope, false);
    });

    it("hasGitLabScope is true when projects configured", () => {
      assert.equal(new ScopeGuard({ gitlabProjects: "g/p" }).hasGitLabScope, true);
    });

    it("hasJiraScope is true when projects configured", () => {
      assert.equal(new ScopeGuard({ jiraProjects: "SHIP" }).hasJiraScope, true);
    });
  });
});
