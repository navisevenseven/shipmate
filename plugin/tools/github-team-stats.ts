/**
 * Tool: github_team_stats
 *
 * Fetches team contribution stats for a time period via GitHub GraphQL.
 * Shows PR throughput, review load distribution, merge times per contributor.
 */

import type { PluginAPI } from "../lib/types.js";
import type { GitHubClient } from "../clients/github.js";
import { parseRepo } from "../clients/github.js";
import { logger } from "../lib/logger.js";
import { RateLimitError } from "../lib/rate-limiter.js";

export function registerGithubTeamStats(api: PluginAPI, client: GitHubClient): void {
  api.registerTool({
    name: "github_team_stats",
    description:
      "Fetch team contribution stats from GitHub: PRs authored/reviewed per contributor, " +
      "average merge time, lines changed. Useful for sprint retros and workload analysis.",
    parameters: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: 'Repository in "owner/repo" format.',
        },
        period: {
          type: "string",
          description: 'Time period start date in YYYY-MM-DD format. Example: "2026-01-01".',
        },
        until: {
          type: "string",
          description: "Optional end date in YYYY-MM-DD format. Defaults to today.",
        },
      },
      required: ["repo", "period"],
    },
    handler: async (params) => {
      const repoStr = params.repo as string;
      const period = params.period as string;
      const until = params.until as string | undefined;

      try {
        const { owner, repo } = parseRepo(repoStr);
        const result = await client.getTeamStats(owner, repo, period, until);

        logger.info("github_team_stats", "completed",
          `${repoStr} ${result.period} — ${result.summary.total_prs} PRs, ${result.contributors.length} contributors`);

        return result;
      } catch (err) {
        if (err instanceof RateLimitError) {
          return { error: err.message, retry_after_ms: err.retry_after_ms };
        }
        const message = err instanceof Error ? err.message : String(err);
        logger.error("github_team_stats", "failed", message);
        return { error: `Failed to fetch team stats: ${message}` };
      }
    },
  });
}
