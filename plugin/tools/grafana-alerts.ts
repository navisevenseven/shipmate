/**
 * Tool: grafana_alerts
 *
 * Fetches active Grafana alerts, alert rules, and annotations.
 * Supports filtering by state and time range.
 */

import type { PluginAPI } from "../lib/types.js";
import type { GrafanaClient } from "../clients/grafana.js";
import { logger } from "../lib/logger.js";
import { RateLimitError } from "../lib/rate-limiter.js";

export function registerGrafanaAlerts(api: PluginAPI, client: GrafanaClient): void {
  api.registerTool({
    name: "grafana_alerts",
    description:
      "Fetch active Grafana alerts, alert rules, and dashboard annotations. " +
      "Returns alert name, state, labels, value, and silenced/inhibited status. " +
      "Use mode='rules' to get configured alert rules, mode='annotations' for incident markers.",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["alerts", "rules", "annotations"],
          description: "What to fetch. Default: alerts.",
        },
        state: {
          type: "string",
          enum: ["firing", "pending", "suppressed"],
          description: "Filter alerts by state (only for mode=alerts). Default: all states.",
        },
        time_range: {
          type: "string",
          enum: ["1h", "6h", "24h", "7d"],
          description: "Time range for annotations. Default: 24h.",
        },
        dashboard_uid: {
          type: "string",
          description: "Filter annotations by dashboard UID.",
        },
        limit: {
          type: "number",
          description: "Max annotations to return (1-200). Default: 50.",
        },
        refresh: {
          type: "boolean",
          description: "Force refresh, bypass cache. Default: false.",
        },
      },
    },
    handler: async (params) => {
      const mode = (params.mode as string) ?? "alerts";
      const refresh = (params.refresh as boolean) ?? false;

      try {
        if (mode === "rules") {
          const rules = await client.getAlertRules(refresh);
          logger.info("grafana_alerts", "rules", `${rules.length} rules`);
          return { total: rules.length, rules };
        }

        if (mode === "annotations") {
          const annotations = await client.getAnnotations({
            dashboardUid: params.dashboard_uid as string | undefined,
            timeRange: (params.time_range as string) ?? "24h",
            limit: params.limit as number | undefined,
            refresh,
          });
          logger.info("grafana_alerts", "annotations", `${annotations.length} annotations`);
          return { total: annotations.length, annotations };
        }

        const result = await client.getAlerts({
          state: params.state as string | undefined,
          refresh,
        });
        logger.info("grafana_alerts", "alerts", `${result.total} alerts`);
        return result;
      } catch (err) {
        if (err instanceof RateLimitError) {
          return { error: err.message, retry_after_ms: err.retry_after_ms };
        }
        const message = err instanceof Error ? err.message : String(err);
        logger.error("grafana_alerts", "failed", message);
        return { error: `Grafana request failed: ${message}` };
      }
    },
  });
}
