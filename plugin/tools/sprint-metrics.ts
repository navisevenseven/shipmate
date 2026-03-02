/**
 * Tool: sprint_metrics
 *
 * Aggregated sprint metrics from Jira + GitHub/GitLab.
 * Jira provides task/story data, GitHub/GitLab provides code metrics.
 */

import type { PluginAPI, SprintMetrics } from "../lib/types.js";
import type { JiraClient } from "../clients/jira.js";
import type { GitHubClient } from "../clients/github.js";
import type { GitLabClient } from "../clients/gitlab.js";
import { parseRepo } from "../clients/github.js";
import { logger } from "../lib/logger.js";
import { RateLimitError } from "../lib/rate-limiter.js";

interface SprintMetricsDeps {
  jira: JiraClient | null;
  github: GitHubClient | null;
  gitlab: GitLabClient | null;
}

export function registerSprintMetrics(api: PluginAPI, deps: SprintMetricsDeps): void {
  api.registerTool({
    name: "sprint_metrics",
    description:
      "Fetch aggregated sprint metrics: task progress from Jira, code metrics from GitHub/GitLab. " +
      "Shows completion %, velocity, blockers, risks. Requires at least one data source configured.",
    parameters: {
      type: "object",
      properties: {
        board_id: {
          type: "number",
          description: "Jira board ID. Required if using Jira as data source.",
        },
        sprint_id: {
          type: "number",
          description: "Specific sprint ID. If omitted, uses the active sprint.",
        },
        github_repo: {
          type: "string",
          description: 'GitHub repo in "owner/repo" format for code metrics.',
        },
        gitlab_project: {
          type: "string",
          description: "GitLab project ID or path for code metrics.",
        },
        source: {
          type: "string",
          enum: ["jira", "github", "gitlab", "all"],
          description: 'Data sources to query. Default: "all" (uses all configured sources).',
        },
      },
    },
    handler: async (params) => {
      const boardId = params.board_id as number | undefined;
      const sprintId = params.sprint_id as number | undefined;
      const githubRepo = params.github_repo as string | undefined;
      const gitlabProject = params.gitlab_project as string | undefined;
      const source = (params.source as string) ?? "all";

      try {
        let metrics: SprintMetrics | null = null;

        // 1. Jira sprint data (primary source for task progress)
        const useJira = deps.jira && (source === "all" || source === "jira");
        if (useJira && boardId) {
          metrics = await deps.jira!.getSprintMetrics(boardId, sprintId);
          if (!metrics) {
            return { error: "No active sprint found on the specified board.", hint: "Provide sprint_id if you want a specific sprint." };
          }
        }

        // If no Jira data, create a basic metrics shell from dates
        if (!metrics) {
          const today = new Date();
          const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
          metrics = {
            sprint: {
              id: null,
              name: "Current Period",
              start_date: twoWeeksAgo.toISOString().split("T")[0],
              end_date: today.toISOString().split("T")[0],
              days_remaining: 0,
              goal: null,
            },
            progress: {
              total_issues: 0,
              completed: 0,
              in_progress: 0,
              todo: 0,
              blocked: 0,
              completion_percent: 0,
            },
            story_points: null,
            velocity: {
              prs_merged: 0,
              avg_lines_per_pr: 0,
              commits: 0,
              contributors_active: 0,
            },
            blockers: [],
            risks: [],
          };
        }

        const sprintStartDate = metrics.sprint.start_date;

        // 2. GitHub code metrics
        const useGithub = deps.github && githubRepo && (source === "all" || source === "github");
        if (useGithub) {
          try {
            const { owner, repo } = parseRepo(githubRepo!);
            const prData = await deps.github!.getMergedPRCount(owner, repo, sprintStartDate);
            metrics.velocity.prs_merged += prData.count;
            if (prData.avg_lines > metrics.velocity.avg_lines_per_pr) {
              metrics.velocity.avg_lines_per_pr = prData.avg_lines;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            metrics.risks.push(`GitHub data unavailable: ${msg}`);
          }
        }

        // 3. GitLab code metrics
        const useGitlab = deps.gitlab && gitlabProject && (source === "all" || source === "gitlab");
        if (useGitlab) {
          try {
            const mrData = await deps.gitlab!.getMergedMRCount(gitlabProject!, sprintStartDate);
            metrics.velocity.prs_merged += mrData.count;
            if (mrData.avg_lines > metrics.velocity.avg_lines_per_pr) {
              metrics.velocity.avg_lines_per_pr = mrData.avg_lines;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            metrics.risks.push(`GitLab data unavailable: ${msg}`);
          }
        }

        // Health indicator
        const health = metrics.progress.total_issues > 0
          ? metrics.progress.completion_percent >= 80 && metrics.blockers.length === 0
            ? "on_track"
            : metrics.progress.completion_percent >= 50 || metrics.blockers.length <= 1
              ? "at_risk"
              : "off_track"
          : "unknown";

        const configuredSources: string[] = [];
        if (useJira) configuredSources.push("jira");
        if (useGithub) configuredSources.push("github");
        if (useGitlab) configuredSources.push("gitlab");

        logger.info("sprint_metrics", "completed",
          `${metrics.sprint.name} — ${metrics.progress.completion_percent}% complete, ${health}`);

        return {
          ...metrics,
          health,
          data_sources: configuredSources,
        };
      } catch (err) {
        if (err instanceof RateLimitError) {
          return { error: err.message, retry_after_ms: err.retry_after_ms };
        }
        const message = err instanceof Error ? err.message : String(err);
        logger.error("sprint_metrics", "failed", message);
        return { error: `Failed to fetch sprint metrics: ${message}` };
      }
    },
  });
}
