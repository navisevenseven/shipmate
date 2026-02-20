/**
 * ScopeGuard — hard enforcement of project isolation.
 *
 * Every API call through plugin tools is validated against allowlists.
 * No scope configured = tools not registered (fail-closed).
 * No modes, no toggles — always enforcing.
 */

import { logger } from "./logger.js";

export interface ScopeConfig {
  githubRepos?: string;
  gitlabProjects?: string;
  jiraProjects?: string;
  jiraBoards?: string;
  sentryOrg?: string;
  sentryProject?: string;
}

export class ScopeGuard {
  private ghRepos: Set<string>;
  private glProjects: Set<string>;
  private jiraProjects: Set<string>;
  private jiraBoards: Set<number>;
  private _sentryOrg: string | null;
  private _sentryProject: string | null;

  constructor(config: ScopeConfig) {
    this.ghRepos = parseStringList(config.githubRepos);
    this.glProjects = parseStringList(config.gitlabProjects);
    this.jiraProjects = parseStringList(config.jiraProjects, false);
    this.jiraBoards = parseNumberList(config.jiraBoards);
    this._sentryOrg = config.sentryOrg?.trim() || null;
    this._sentryProject = config.sentryProject?.trim() || null;

    if (this.ghRepos.size > 0) {
      logger.info("scope-guard", "GitHub repos", [...this.ghRepos].join(", "));
    }
    if (this.glProjects.size > 0) {
      logger.info("scope-guard", "GitLab projects", [...this.glProjects].join(", "));
    }
    if (this.jiraProjects.size > 0) {
      logger.info("scope-guard", "Jira projects", [...this.jiraProjects].join(", "));
    }
    if (this.jiraBoards.size > 0) {
      logger.info("scope-guard", "Jira boards", [...this.jiraBoards].join(", "));
    }
    if (this._sentryOrg && this._sentryProject) {
      logger.info("scope-guard", "Sentry", `${this._sentryOrg}/${this._sentryProject}`);
    }
  }

  /**
   * Validate GitHub repo access. Throws on violation.
   */
  checkGitHub(owner: string, repo: string): void {
    const full = `${owner}/${repo}`.toLowerCase();
    if (!this.ghRepos.has(full)) {
      throw new ScopeViolationError("github", full, [...this.ghRepos]);
    }
  }

  /**
   * Validate GitLab project access. Throws on violation.
   */
  checkGitLab(project: string): void {
    const normalized = project.toLowerCase();
    if (!this.glProjects.has(normalized)) {
      throw new ScopeViolationError("gitlab", project, [...this.glProjects]);
    }
  }

  /**
   * Validate Jira board access. Throws on violation.
   * Skips check if no boards are configured (boards are optional — project filter is primary).
   */
  checkJiraBoard(boardId: number): void {
    if (this.jiraBoards.size > 0 && !this.jiraBoards.has(boardId)) {
      throw new ScopeViolationError(
        "jira-board",
        String(boardId),
        [...this.jiraBoards].map(String),
      );
    }
  }

  /**
   * Inject project filter into a JQL query.
   * Wraps the original query and ANDs with the allowed project list.
   * If no Jira projects configured, returns the original JQL unchanged.
   */
  scopeJQL(jql: string): string {
    if (this.jiraProjects.size === 0) return jql;
    const projects = [...this.jiraProjects].map((p) => `"${p}"`).join(", ");
    return `(${jql}) AND project IN (${projects})`;
  }

  get hasGitHubScope(): boolean {
    return this.ghRepos.size > 0;
  }

  get hasGitLabScope(): boolean {
    return this.glProjects.size > 0;
  }

  get hasJiraScope(): boolean {
    return this.jiraProjects.size > 0;
  }

  /**
   * Validate Sentry org/project access. Throws on violation.
   */
  checkSentry(org: string, project: string): void {
    if (!this._sentryOrg || !this._sentryProject) {
      throw new ScopeViolationError("sentry", `${org}/${project}`, []);
    }
    if (org !== this._sentryOrg || project !== this._sentryProject) {
      throw new ScopeViolationError(
        "sentry",
        `${org}/${project}`,
        [`${this._sentryOrg}/${this._sentryProject}`],
      );
    }
  }

  get hasSentryScope(): boolean {
    return this._sentryOrg !== null && this._sentryProject !== null;
  }

  get sentryOrg(): string | null {
    return this._sentryOrg;
  }

  get sentryProject(): string | null {
    return this._sentryProject;
  }
}

export class ScopeViolationError extends Error {
  constructor(
    public readonly resource: string,
    public readonly requested: string,
    public readonly allowed: string[],
  ) {
    super(
      `Scope violation: ${resource} "${requested}" is not in the allowed list [${allowed.join(", ")}]. ` +
        `ShipMate is configured for a specific project — access to other resources is blocked.`,
    );
    this.name = "ScopeViolationError";
  }
}

function parseStringList(value: string | undefined, lowercase = true): Set<string> {
  if (!value || value.trim() === "") return new Set();
  return new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => (lowercase ? s.toLowerCase() : s)),
  );
}

function parseNumberList(value: string | undefined): Set<number> {
  if (!value || value.trim() === "") return new Set();
  return new Set(
    value
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n)),
  );
}
