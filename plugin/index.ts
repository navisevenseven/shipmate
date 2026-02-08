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
import type { PluginAPI } from "./lib/types.js";

import { GitHubClient } from "./clients/github.js";
import { GitLabClient } from "./clients/gitlab.js";
import { JiraClient } from "./clients/jira.js";

import { registerGithubPrReview } from "./tools/github-pr-review.js";
import { registerGithubTeamStats } from "./tools/github-team-stats.js";
import { registerGitlabMrReview } from "./tools/gitlab-mr-review.js";
import { registerSprintMetrics } from "./tools/sprint-metrics.js";
import { registerJiraSearch } from "./tools/jira-search.js";

export default function register(api: PluginAPI): void {
  // Shared infrastructure — single cache and rate limiter for all tools
  const cache = new Cache();
  const limiter = new RateLimiter(10, 30); // burst 10, 30/min

  let toolsRegistered = 0;

  // --- GitHub tools ---
  let githubClient: GitHubClient | null = null;
  const githubToken = process.env.GITHUB_TOKEN;

  if (githubToken) {
    githubClient = new GitHubClient(githubToken, cache, limiter);
    registerGithubPrReview(api, githubClient);
    registerGithubTeamStats(api, githubClient);
    toolsRegistered += 2;
    logger.info("plugin", "registered", "github_pr_review, github_team_stats");
  } else {
    logger.warn("plugin", "skipped GitHub tools", "GITHUB_TOKEN not set");
  }

  // --- GitLab tools ---
  let gitlabClient: GitLabClient | null = null;
  const gitlabToken = process.env.GITLAB_TOKEN;
  const gitlabHost = process.env.GITLAB_HOST ?? "https://gitlab.com";

  if (gitlabToken) {
    gitlabClient = new GitLabClient(gitlabHost, gitlabToken, cache, limiter);
    registerGitlabMrReview(api, gitlabClient);
    toolsRegistered += 1;
    logger.info("plugin", "registered", "gitlab_mr_review");
  } else {
    logger.warn("plugin", "skipped GitLab tools", "GITLAB_TOKEN not set");
  }

  // --- Jira tools ---
  let jiraClient: JiraClient | null = null;
  const jiraBaseUrl = process.env.JIRA_BASE_URL;
  const jiraToken = process.env.JIRA_API_TOKEN;
  const jiraEmail = process.env.JIRA_USER_EMAIL;

  if (jiraBaseUrl && jiraToken && jiraEmail) {
    jiraClient = new JiraClient(
      { baseUrl: jiraBaseUrl, email: jiraEmail, token: jiraToken },
      cache,
      limiter
    );
    registerJiraSearch(api, jiraClient);
    toolsRegistered += 1;
    logger.info("plugin", "registered", "jira_search");
  } else {
    const missing = [
      !jiraBaseUrl && "JIRA_BASE_URL",
      !jiraToken && "JIRA_API_TOKEN",
      !jiraEmail && "JIRA_USER_EMAIL",
    ].filter(Boolean);
    logger.warn("plugin", "skipped Jira tools", `missing: ${missing.join(", ")}`);
  }

  // --- Sprint metrics (aggregation tool, uses all available sources) ---
  // Register even if only one source is available
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

  // --- Summary ---
  logger.info("plugin", "loaded", `ShipMate v0.3.0 — ${toolsRegistered} tools registered`);
}
