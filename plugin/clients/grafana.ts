/**
 * Grafana REST API client.
 *
 * Uses native fetch for Grafana Alerting API (Unified Alerting).
 * Provides alert instances, alert rules, and annotations.
 */

import { Cache, cacheKey } from "../lib/cache.js";
import { RateLimiter } from "../lib/rate-limiter.js";
import { logger } from "../lib/logger.js";
import { CacheTTL } from "../lib/types.js";
import type { GrafanaAlert, GrafanaAlertsResult, GrafanaAlertRule, GrafanaAnnotation } from "../lib/types.js";

export interface GrafanaConfig {
  url: string;
  token: string;
}

export class GrafanaClient {
  private baseUrl: string;
  private token: string;
  private cache: Cache;
  private limiter: RateLimiter;

  constructor(config: GrafanaConfig, cache: Cache, limiter: RateLimiter) {
    this.baseUrl = config.url.replace(/\/+$/, "");
    this.token = config.token;
    this.cache = cache;
    this.limiter = limiter;
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Grafana API ${res.status}: ${res.statusText} — ${body.slice(0, 200)}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Fetch active alert instances from Grafana Alertmanager API.
   */
  async getAlerts(options: {
    state?: string;
    refresh?: boolean;
  } = {}): Promise<GrafanaAlertsResult> {
    const stateFilter = options.state ?? "";
    const key = cacheKey("grafana", "alerts", stateFilter);
    const cached = this.cache.get<GrafanaAlertsResult>(key, options.refresh);
    if (cached) {
      logger.debug("grafana", "cache hit", key);
      return cached;
    }

    this.limiter.consume();
    logger.info("grafana", "fetching alerts", stateFilter || "all states");

    const params: Record<string, string> = {};
    if (stateFilter) params.state = stateFilter;

    const raw = await this.request<any>("/api/alertmanager/grafana/api/v2/alerts", params);

    const allAlerts: GrafanaAlert[] = (Array.isArray(raw) ? raw : []).map(mapAlert);

    const alerts = stateFilter
      ? allAlerts.filter((a) => a.state.toLowerCase() === stateFilter.toLowerCase())
      : allAlerts;

    const result: GrafanaAlertsResult = {
      source: this.baseUrl,
      total: alerts.length,
      alerts,
    };

    this.cache.set(key, result, CacheTTL.ALERTS);
    return result;
  }

  /**
   * Fetch alert rules (Grafana Ruler API).
   */
  async getAlertRules(refresh = false): Promise<GrafanaAlertRule[]> {
    const key = cacheKey("grafana", "rules");
    const cached = this.cache.get<GrafanaAlertRule[]>(key, refresh);
    if (cached) return cached;

    this.limiter.consume();
    logger.info("grafana", "fetching alert rules", "");

    const raw = await this.request<Record<string, any[]>>("/api/ruler/grafana/api/v1/rules");

    const rules: GrafanaAlertRule[] = [];
    for (const [folder, groups] of Object.entries(raw)) {
      for (const group of groups) {
        for (const rule of group.rules ?? []) {
          rules.push({
            uid: rule.grafana_alert?.uid ?? "",
            title: rule.grafana_alert?.title ?? rule.alert ?? "",
            condition: rule.grafana_alert?.condition ?? "",
            folder_title: folder,
            state: rule.grafana_alert?.state ?? "",
            health: rule.grafana_alert?.health ?? "",
            last_evaluation: rule.grafana_alert?.last_evaluation ?? "",
            evaluation_duration: rule.grafana_alert?.evaluation_duration ?? "",
          });
        }
      }
    }

    this.cache.set(key, rules, CacheTTL.ALERTS);
    return rules;
  }

  /**
   * Fetch annotations (incident markers on dashboards).
   */
  async getAnnotations(options: {
    dashboardUid?: string;
    timeRange?: string;
    limit?: number;
    refresh?: boolean;
  } = {}): Promise<GrafanaAnnotation[]> {
    const limit = Math.min(options.limit ?? 50, 200);
    const key = cacheKey("grafana", "annotations", options.dashboardUid ?? "", options.timeRange ?? "", String(limit));
    const cached = this.cache.get<GrafanaAnnotation[]>(key, options.refresh);
    if (cached) return cached;

    this.limiter.consume();
    logger.info("grafana", "fetching annotations", options.dashboardUid ?? "all dashboards");

    const params: Record<string, string> = { limit: String(limit) };
    if (options.dashboardUid) params.dashboardUID = options.dashboardUid;
    if (options.timeRange) {
      const fromMs = timeRangeToEpoch(options.timeRange);
      if (fromMs) params.from = String(fromMs);
      params.to = String(Date.now());
    }

    const raw = await this.request<any[]>("/api/annotations", params);

    const annotations: GrafanaAnnotation[] = (raw ?? []).map((a) => ({
      id: a.id ?? 0,
      dashboard_uid: a.dashboardUID ?? a.dashboardUid ?? "",
      panel_id: a.panelId ?? 0,
      text: a.text ?? "",
      tags: a.tags ?? [],
      time: a.time ?? 0,
      time_end: a.timeEnd ?? 0,
    }));

    this.cache.set(key, annotations, CacheTTL.ALERTS);
    return annotations;
  }
}

function mapAlert(raw: any): GrafanaAlert {
  return {
    labels: raw.labels ?? {},
    annotations: raw.annotations ?? {},
    state: raw.status?.state ?? raw.state ?? "unknown",
    activeAt: raw.startsAt ?? raw.activeAt ?? "",
    value: raw.annotations?.value ?? raw.value ?? "",
    silencedBy: raw.status?.silencedBy ?? [],
    inhibitedBy: raw.status?.inhibitedBy ?? [],
  };
}

function timeRangeToEpoch(range: string): number | null {
  const match = range.match(/^(\d+)(h|d)$/);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  const unit = match[2];
  const ms = unit === "h" ? value * 3600_000 : value * 86400_000;
  return Date.now() - ms;
}
