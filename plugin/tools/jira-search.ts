/**
 * Tool: jira_search
 *
 * Flexible Jira issue search via JQL.
 * Useful for ad-hoc queries, filtering by project/sprint/assignee/label.
 */

import type { PluginAPI } from "../lib/types.js";
import type { JiraClient } from "../clients/jira.js";
import { logger } from "../lib/logger.js";
import { RateLimitError } from "../lib/rate-limiter.js";

export function registerJiraSearch(api: PluginAPI, client: JiraClient): void {
  api.registerTool({
    name: "jira_search",
    description:
      "Search Jira issues using JQL (Jira Query Language). Returns issues with key fields: " +
      "summary, status, assignee, priority, story points, labels. " +
      "Examples: 'project = SHIP AND sprint in openSprints()', 'assignee = currentUser() AND status != Done'.",
    parameters: {
      type: "object",
      properties: {
        jql: {
          type: "string",
          description: "JQL query string. Example: 'project = SHIP AND status = \"In Progress\"'",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Specific Jira fields to return. Default: summary, status, assignee, priority, issuetype, story_points, labels, created, updated.",
        },
        max_results: {
          type: "number",
          description: "Maximum issues to return. Default: 50, max: 100.",
        },
        refresh: {
          type: "boolean",
          description: "Force refresh, bypass cache. Default: false.",
        },
      },
      required: ["jql"],
    },
    handler: async (params) => {
      const jql = params.jql as string;
      const fields = params.fields as string[] | undefined;
      const maxResults = Math.min((params.max_results as number) ?? 50, 100);
      const refresh = (params.refresh as boolean) ?? false;

      try {
        const result = await client.search(jql, fields, maxResults, refresh);

        logger.info("jira_search", "completed",
          `"${jql.substring(0, 60)}${jql.length > 60 ? "..." : ""}" — ${result.total} total, ${result.issues.length} returned`);

        return result;
      } catch (err) {
        if (err instanceof RateLimitError) {
          return { error: err.message, retry_after_ms: err.retry_after_ms };
        }
        const message = err instanceof Error ? err.message : String(err);
        logger.error("jira_search", "failed", message);
        return { error: `Jira search failed: ${message}` };
      }
    },
  });
}
