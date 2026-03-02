/**
 * Tool: gitlab_mr_review
 *
 * Fetches full MR context via GitLab GraphQL in a single call.
 * Replaces multiple `glab` CLI calls.
 */

import type { PluginAPI } from "../lib/types.js";
import type { GitLabClient } from "../clients/gitlab.js";
import { logger } from "../lib/logger.js";
import { RateLimitError } from "../lib/rate-limiter.js";

export function registerGitlabMrReview(api: PluginAPI, client: GitLabClient): void {
  api.registerTool({
    name: "gitlab_mr_review",
    description:
      "Fetch full GitLab MR context: metadata, diff stats, pipeline status, discussions, approvals — in a single API call. " +
      "Use this instead of multiple `glab` CLI calls for faster, cached MR reviews.",
    parameters: {
      type: "object",
      properties: {
        mr_number: {
          type: "number",
          description: "Merge request IID (the number shown in the UI, e.g. !15)",
        },
        project: {
          type: "string",
          description: 'GitLab project full path, e.g. "group/subgroup/project-name".',
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
      required: ["mr_number", "project"],
    },
    handler: async (params) => {
      const mrNumber = params.mr_number as number;
      const project = params.project as string;
      const refresh = (params.refresh as boolean) ?? false;

      try {
        const result = await client.getMergeRequest(project, mrNumber, refresh);

        logger.info("gitlab_mr_review", "completed",
          `${project}!${mrNumber} — ${result.files_changed} files, +${result.lines.additions}/-${result.lines.deletions}`);

        return result;
      } catch (err) {
        if (err instanceof RateLimitError) {
          return { error: err.message, retry_after_ms: err.retry_after_ms };
        }
        const message = err instanceof Error ? err.message : String(err);
        logger.error("gitlab_mr_review", "failed", message);
        return { error: `Failed to fetch MR !${mrNumber}: ${message}` };
      }
    },
  });
}
