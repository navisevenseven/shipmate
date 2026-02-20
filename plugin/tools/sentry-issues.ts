/**
 * Tool: sentry_issues
 *
 * Fetches unresolved Sentry issues with optional filtering by level and time range.
 * Can also fetch details + stacktrace for a specific issue by ID.
 */

import type { PluginAPI } from "../lib/types.js";
import type { SentryClient } from "../clients/sentry.js";
import { logger } from "../lib/logger.js";
import { RateLimitError } from "../lib/rate-limiter.js";

export function registerSentryIssues(api: PluginAPI, client: SentryClient): void {
  api.registerTool({
    name: "sentry_issues",
    description:
      "Fetch unresolved Sentry issues for the configured project. " +
      "Returns title, culprit, count, severity, first/last seen, and tags. " +
      "Pass issue_id to get details with stacktrace for a specific issue.",
    parameters: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["error", "warning", "info", "fatal"],
          description: "Filter by severity level. Default: all levels.",
        },
        time_range: {
          type: "string",
          enum: ["1h", "24h", "7d", "14d", "30d"],
          description: "Only issues seen within this time range. Default: all time.",
        },
        limit: {
          type: "number",
          description: "Max issues to return (1-100). Default: 25.",
        },
        issue_id: {
          type: "string",
          description: "Specific Sentry issue ID to get details + stacktrace.",
        },
        refresh: {
          type: "boolean",
          description: "Force refresh, bypass cache. Default: false.",
        },
      },
    },
    handler: async (params) => {
      const issueId = params.issue_id as string | undefined;
      const refresh = (params.refresh as boolean) ?? false;

      try {
        if (issueId) {
          const [issue, event] = await Promise.all([
            client.getIssueDetails(issueId, refresh),
            client.getLatestEvent(issueId, refresh),
          ]);

          logger.info("sentry_issues", "detail", `issue ${issueId} — ${issue.title}`);
          return { issue, latest_event: event };
        }

        const result = await client.getUnresolvedIssues({
          level: params.level as string | undefined,
          timeRange: params.time_range as string | undefined,
          limit: params.limit as number | undefined,
          refresh,
        });

        logger.info("sentry_issues", "list", `${result.total} issues for ${result.org}/${result.project}`);
        return result;
      } catch (err) {
        if (err instanceof RateLimitError) {
          return { error: err.message, retry_after_ms: err.retry_after_ms };
        }
        const message = err instanceof Error ? err.message : String(err);
        logger.error("sentry_issues", "failed", message);
        return { error: `Sentry request failed: ${message}` };
      }
    },
  });
}
