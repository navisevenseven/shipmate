/**
 * Sentry REST API client.
 *
 * Uses native fetch for Sentry Issues API v0.
 * Provides issue listing, details, and latest events.
 */

import { Cache, cacheKey } from "../lib/cache.js";
import { RateLimiter } from "../lib/rate-limiter.js";
import { logger } from "../lib/logger.js";
import { CacheTTL } from "../lib/types.js";
import type { SentryIssue, SentryIssuesResult, SentryEvent } from "../lib/types.js";
import type { ScopeGuard } from "../lib/scope-guard.js";

export interface SentryConfig {
  url: string;
  token: string;
  org: string;
  project: string;
}

export class SentryClient {
  private baseUrl: string;
  private token: string;
  private org: string;
  private project: string;
  private cache: Cache;
  private limiter: RateLimiter;
  private guard: ScopeGuard;

  constructor(config: SentryConfig, cache: Cache, limiter: RateLimiter, guard: ScopeGuard) {
    this.baseUrl = config.url.replace(/\/+$/, "");
    this.token = config.token;
    this.org = config.org;
    this.project = config.project;
    this.cache = cache;
    this.limiter = limiter;
    this.guard = guard;
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/0${path}`);
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
      throw new Error(`Sentry API ${res.status}: ${res.statusText} — ${body.slice(0, 200)}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Fetch unresolved issues for the configured project.
   */
  async getUnresolvedIssues(options: {
    level?: string;
    timeRange?: string;
    limit?: number;
    refresh?: boolean;
  } = {}): Promise<SentryIssuesResult> {
    this.guard.checkSentry(this.org, this.project);

    const limit = Math.min(options.limit ?? 25, 100);
    const query = buildQuery(options.level, options.timeRange);

    const key = cacheKey("sentry", "issues", this.org, this.project, query, String(limit));
    const cached = this.cache.get<SentryIssuesResult>(key, options.refresh);
    if (cached) {
      logger.debug("sentry", "cache hit", key);
      return cached;
    }

    this.limiter.consume();
    logger.info("sentry", "fetching issues", `${this.org}/${this.project} q=${query}`);

    const raw = await this.request<any[]>(
      `/projects/${this.org}/${this.project}/issues/`,
      { query, limit: String(limit), sort: "date" },
    );

    const issues: SentryIssue[] = raw.map(mapIssue);

    const result: SentryIssuesResult = {
      project: this.project,
      org: this.org,
      total: issues.length,
      issues,
    };

    this.cache.set(key, result, CacheTTL.ALERTS);
    return result;
  }

  /**
   * Fetch details for a specific issue by ID.
   */
  async getIssueDetails(issueId: string, refresh = false): Promise<SentryIssue> {
    this.guard.checkSentry(this.org, this.project);

    const key = cacheKey("sentry", "issue-detail", issueId);
    const cached = this.cache.get<SentryIssue>(key, refresh);
    if (cached) return cached;

    this.limiter.consume();
    logger.info("sentry", "fetching issue", issueId);

    const raw = await this.request<any>(`/issues/${issueId}/`);
    const issue = mapIssue(raw);

    this.cache.set(key, issue, CacheTTL.ALERTS);
    return issue;
  }

  /**
   * Fetch the latest event for an issue (includes stacktrace).
   */
  async getLatestEvent(issueId: string, refresh = false): Promise<SentryEvent> {
    this.guard.checkSentry(this.org, this.project);

    const key = cacheKey("sentry", "event-latest", issueId);
    const cached = this.cache.get<SentryEvent>(key, refresh);
    if (cached) return cached;

    this.limiter.consume();
    logger.info("sentry", "fetching latest event", issueId);

    const raw = await this.request<any>(`/issues/${issueId}/events/latest/`);

    const frames = extractFrames(raw);
    const event: SentryEvent = {
      event_id: raw.eventID ?? raw.id ?? "",
      title: raw.title ?? "",
      message: raw.message ?? raw.metadata?.value ?? "",
      timestamp: raw.dateCreated ?? raw.dateReceived ?? "",
      tags: (raw.tags ?? []).map((t: any) => ({ key: t.key, value: t.value })),
      context: raw.contexts ?? {},
      stacktrace: frames.length > 0 ? { frames } : null,
    };

    this.cache.set(key, event, CacheTTL.ALERTS);
    return event;
  }
}

function mapIssue(raw: any): SentryIssue {
  return {
    id: raw.id ?? "",
    title: raw.title ?? "",
    culprit: raw.culprit ?? "",
    level: raw.level ?? "error",
    status: raw.status ?? "unresolved",
    count: raw.count ?? "0",
    first_seen: raw.firstSeen ?? "",
    last_seen: raw.lastSeen ?? "",
    short_id: raw.shortId ?? "",
    permalink: raw.permalink ?? "",
    metadata: {
      type: raw.metadata?.type,
      value: raw.metadata?.value,
      filename: raw.metadata?.filename,
      function: raw.metadata?.function,
    },
    tags: (raw.tags ?? []).slice(0, 10).map((t: any) => ({
      key: t.key ?? t.name ?? "",
      value: t.value ?? t.topValues?.[0]?.value ?? "",
    })),
  };
}

function extractFrames(raw: any): SentryEvent["stacktrace"] extends { frames: infer F } | null ? F extends Array<infer I> ? I[] : never : never {
  const entries = raw.entries ?? [];
  for (const entry of entries) {
    if (entry.type === "exception") {
      const values = entry.data?.values ?? [];
      for (const exc of values) {
        const frames = exc.stacktrace?.frames;
        if (Array.isArray(frames) && frames.length > 0) {
          return frames.slice(-10).map((f: any) => ({
            filename: f.filename ?? f.absPath ?? "",
            function: f.function ?? "<anonymous>",
            lineno: f.lineNo ?? f.lineno ?? null,
            context_line: f.contextLine ?? f.context_line ?? null,
          }));
        }
      }
    }
  }
  return [];
}

function buildQuery(level?: string, timeRange?: string): string {
  const parts = ["is:unresolved"];
  if (level) parts.push(`level:${level}`);
  if (timeRange) {
    const map: Record<string, string> = {
      "1h": "1h", "24h": "24h", "7d": "7d", "14d": "14d", "30d": "30d",
    };
    const age = map[timeRange] ?? timeRange;
    parts.push(`age:-${age}`);
  }
  return parts.join(" ");
}
