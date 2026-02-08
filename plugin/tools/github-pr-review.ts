/**
 * Tool: github_pr_review
 *
 * Fetches full PR context via GitHub GraphQL in a single call.
 * Replaces 3-5 CLI calls (gh pr view + gh pr diff --stat + gh pr checks).
 */

import type { PluginAPI } from "../lib/types.js";
import type { GitHubClient } from "../clients/github.js";
import { parseRepo } from "../clients/github.js";
import { logger } from "../lib/logger.js";
import { RateLimitError } from "../lib/rate-limiter.js";

export function registerGithubPrReview(api: PluginAPI, client: GitHubClient): void {
  api.registerTool({
    name: "github_pr_review",
    description:
      "Fetch full GitHub PR context: metadata, files changed, CI checks, review comments — in a single API call. " +
      "Use this instead of multiple `gh` CLI calls for faster, cached PR reviews.",
    parameters: {
      type: "object",
      properties: {
        pr_number: {
          type: "number",
          description: "Pull request number",
        },
        repo: {
          type: "string",
          description: 'Repository in "owner/repo" format. If omitted, uses current repo.',
        },
        focus: {
          type: "array",
          items: { type: "string" },
          description: "Optional focus areas: security, performance, architecture, testing, correctness",
        },
        refresh: {
          type: "boolean",
          description: "Force refresh, bypass cache. Default: false.",
        },
      },
      required: ["pr_number"],
    },
    handler: async (params) => {
      const prNumber = params.pr_number as number;
      const repoStr = params.repo as string | undefined;
      const refresh = (params.refresh as boolean) ?? false;

      if (!repoStr) {
        return { error: 'Parameter "repo" is required. Format: "owner/repo".' };
      }

      try {
        const { owner, repo } = parseRepo(repoStr);
        const result = await client.getPullRequest(owner, repo, prNumber, refresh);

        logger.info("github_pr_review", "completed", `${repoStr}#${prNumber} — ${result.files_changed} files, +${result.lines.additions}/-${result.lines.deletions}`);

        return result;
      } catch (err) {
        if (err instanceof RateLimitError) {
          return { error: err.message, retry_after_ms: err.retry_after_ms };
        }
        const message = err instanceof Error ? err.message : String(err);
        logger.error("github_pr_review", "failed", message);
        return { error: `Failed to fetch PR #${prNumber}: ${message}` };
      }
    },
  });
}
