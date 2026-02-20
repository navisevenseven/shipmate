/**
 * ShipMate — OpenClaw Plugin
 *
 * Custom tools for engineering project management.
 * Phase 2: data-rich integrations via GitHub GraphQL, GitLab GraphQL, Jira REST API.
 *
 * Tools registered:
 * - github_pr_review    — PR review via GitHub GraphQL (cached, rate-limited)
 * - github_team_stats   — Team contribution metrics from GitHub
 * - gitlab_mr_review    — MR review via GitLab GraphQL (cached, rate-limited)
 * - sprint_metrics      — Aggregated sprint data from Jira + GitHub/GitLab
 * - jira_search         — Flexible Jira issue search via JQL
 *
 * All tools gracefully degrade: if env vars are missing, the corresponding
 * tools are simply not registered (with a warning log).
 */

import { Cache } from "./lib/cache.js";
import { RateLimiter } from "./lib/rate-limiter.js";
import { logger } from "./lib/logger.js";
import { ScopeGuard } from "./lib/scope-guard.js";
import type { PluginAPI } from "./lib/types.js";

import { GitHubClient } from "./clients/github.js";
import { GitLabClient } from "./clients/gitlab.js";
import { JiraClient } from "./clients/jira.js";
import { SentryClient } from "./clients/sentry.js";
import { GrafanaClient } from "./clients/grafana.js";

import { registerGithubPrReview } from "./tools/github-pr-review.js";
import { registerGithubTeamStats } from "./tools/github-team-stats.js";
import { registerGitlabMrReview } from "./tools/gitlab-mr-review.js";
import { registerSprintMetrics } from "./tools/sprint-metrics.js";
import { registerJiraSearch } from "./tools/jira-search.js";
import { registerSentryIssues } from "./tools/sentry-issues.js";
import { registerGrafanaAlerts } from "./tools/grafana-alerts.js";

export default function register(api: PluginAPI): void {
  const cache = new Cache();
  const limiter = new RateLimiter(10, 30);

  const guard = new ScopeGuard({
    githubRepos: process.env.SHIPMATE_SCOPE_GITHUB_REPOS,
    gitlabProjects: process.env.SHIPMATE_SCOPE_GITLAB_PROJECTS,
    jiraProjects: process.env.SHIPMATE_SCOPE_JIRA_PROJECTS,
    jiraBoards: process.env.SHIPMATE_SCOPE_JIRA_BOARDS,
    sentryOrg: process.env.SENTRY_ORG,
    sentryProject: process.env.SENTRY_PROJECT,
  });

  let toolsRegistered = 0;

  // --- GitHub tools (fail-closed: token + scope required) ---
  let githubClient: GitHubClient | null = null;
  const githubToken = process.env.GITHUB_TOKEN;

  if (githubToken && guard.hasGitHubScope) {
    githubClient = new GitHubClient(githubToken, cache, limiter, guard);
    registerGithubPrReview(api, githubClient);
    registerGithubTeamStats(api, githubClient);
    toolsRegistered += 2;
    logger.info("plugin", "registered", "github_pr_review, github_team_stats");

    githubClient.validateTokenScope().then((result) => {
      if (!result.ok) logger.warn("plugin", "TOKEN SCOPE", result.message);
    });
  } else if (githubToken && !guard.hasGitHubScope) {
    logger.error("plugin", "BLOCKED",
      "GITHUB_TOKEN set but SHIPMATE_SCOPE_GITHUB_REPOS is empty — GitHub tools disabled. " +
      "Set SHIPMATE_SCOPE_GITHUB_REPOS=owner/repo to enable.");
  } else {
    logger.warn("plugin", "skipped GitHub tools", "GITHUB_TOKEN not set");
  }

  // --- GitLab tools (fail-closed: token + scope required) ---
  let gitlabClient: GitLabClient | null = null;
  const gitlabToken = process.env.GITLAB_TOKEN;
  const gitlabHost = process.env.GITLAB_HOST ?? "https://gitlab.com";

  if (gitlabToken && guard.hasGitLabScope) {
    gitlabClient = new GitLabClient(gitlabHost, gitlabToken, cache, limiter, guard);
    registerGitlabMrReview(api, gitlabClient);
    toolsRegistered += 1;
    logger.info("plugin", "registered", "gitlab_mr_review");
  } else if (gitlabToken && !guard.hasGitLabScope) {
    logger.error("plugin", "BLOCKED",
      "GITLAB_TOKEN set but SHIPMATE_SCOPE_GITLAB_PROJECTS is empty — GitLab tools disabled. " +
      "Set SHIPMATE_SCOPE_GITLAB_PROJECTS=group/project to enable.");
  } else {
    logger.warn("plugin", "skipped GitLab tools", "GITLAB_TOKEN not set");
  }

  // --- Jira tools (fail-closed: credentials + scope required) ---
  let jiraClient: JiraClient | null = null;
  const jiraBaseUrl = process.env.JIRA_BASE_URL;
  const jiraToken = process.env.JIRA_API_TOKEN;
  const jiraEmail = process.env.JIRA_USER_EMAIL;

  if (jiraBaseUrl && jiraToken && jiraEmail && guard.hasJiraScope) {
    jiraClient = new JiraClient(
      { baseUrl: jiraBaseUrl, email: jiraEmail, token: jiraToken },
      cache,
      limiter,
      guard,
    );
    registerJiraSearch(api, jiraClient);
    toolsRegistered += 1;
    logger.info("plugin", "registered", "jira_search");
  } else if (jiraBaseUrl && jiraToken && jiraEmail && !guard.hasJiraScope) {
    logger.error("plugin", "BLOCKED",
      "Jira credentials set but SHIPMATE_SCOPE_JIRA_PROJECTS is empty — Jira tools disabled. " +
      "Set SHIPMATE_SCOPE_JIRA_PROJECTS=PROJ to enable.");
  } else {
    const missing = [
      !jiraBaseUrl && "JIRA_BASE_URL",
      !jiraToken && "JIRA_API_TOKEN",
      !jiraEmail && "JIRA_USER_EMAIL",
    ].filter(Boolean);
    if (missing.length > 0) {
      logger.warn("plugin", "skipped Jira tools", `missing: ${missing.join(", ")}`);
    }
  }

  // --- Sprint metrics (aggregation — uses whatever sources are available) ---
  if (githubClient || gitlabClient || jiraClient) {
    registerSprintMetrics(api, {
      jira: jiraClient,
      github: githubClient,
      gitlab: gitlabClient,
    });
    toolsRegistered += 1;
    logger.info("plugin", "registered", "sprint_metrics");
  } else {
    logger.warn("plugin", "skipped sprint_metrics", "no data sources configured");
  }

  // --- Sentry tools (fail-closed: url + token + org required) ---
  const sentryUrl = process.env.SENTRY_URL;
  const sentryToken = process.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  if (sentryUrl && sentryToken && sentryOrg && sentryProject && guard.hasSentryScope) {
    const sentryClient = new SentryClient(
      { url: sentryUrl, token: sentryToken, org: sentryOrg, project: sentryProject },
      cache,
      limiter,
      guard,
    );
    registerSentryIssues(api, sentryClient);
    toolsRegistered += 1;
    logger.info("plugin", "registered", "sentry_issues");
  } else if (sentryUrl && sentryToken && sentryOrg && !sentryProject) {
    logger.error("plugin", "BLOCKED",
      "Sentry credentials set but SENTRY_PROJECT is empty — Sentry tools disabled. " +
      "Set SENTRY_PROJECT to enable.");
  } else if (!sentryUrl && !sentryToken) {
    logger.warn("plugin", "skipped Sentry tools", "SENTRY_URL / SENTRY_AUTH_TOKEN not set");
  }

  // --- Grafana tools (fail-closed: url + token required) ---
  const grafanaUrl = process.env.GRAFANA_URL;
  const grafanaToken = process.env.GRAFANA_TOKEN;

  if (grafanaUrl && grafanaToken) {
    const grafanaClient = new GrafanaClient(
      { url: grafanaUrl, token: grafanaToken },
      cache,
      limiter,
    );
    registerGrafanaAlerts(api, grafanaClient);
    toolsRegistered += 1;
    logger.info("plugin", "registered", "grafana_alerts");
  } else {
    const missing = [
      !grafanaUrl && "GRAFANA_URL",
      !grafanaToken && "GRAFANA_TOKEN",
    ].filter(Boolean);
    if (missing.length > 0) {
      logger.warn("plugin", "skipped Grafana tools", `missing: ${missing.join(", ")}`);
    }
  }

  logger.info("plugin", "loaded", `ShipMate v0.5.0 — ${toolsRegistered} tools registered`);
}
