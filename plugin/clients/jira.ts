/**
 * Jira Cloud REST API client.
 *
 * Uses Basic Auth (email:token) against Jira Cloud REST API v3 and Agile API.
 */

import { Cache, cacheKey, hashParams } from "../lib/cache.js";
import { RateLimiter } from "../lib/rate-limiter.js";
import { logger } from "../lib/logger.js";
import { CacheTTL } from "../lib/types.js";
import type { JiraIssue, JiraSearchResult, SprintMetrics, BlockerItem } from "../lib/types.js";

interface JiraConfig {
  baseUrl: string;
  email: string;
  token: string;
}

export class JiraClient {
  private config: JiraConfig;
  private authHeader: string;
  private cache: Cache;
  private limiter: RateLimiter;

  constructor(config: JiraConfig, cache: Cache, limiter: RateLimiter) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ""),
    };
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.token}`).toString("base64")}`;
    this.cache = cache;
    this.limiter = limiter;
  }

  /**
   * Execute a Jira REST API call.
   */
  private async request<T = any>(path: string, options?: {
    method?: string;
    body?: unknown;
    params?: Record<string, string>;
  }): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${path}`);
    if (options?.params) {
      for (const [k, v] of Object.entries(options.params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      method: options?.method ?? "GET",
      headers: {
        "Authorization": this.authHeader,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira API error ${res.status}: ${text}`);
    }

    return (await res.json()) as T;
  }

  /**
   * Get active sprint for a board.
   */
  async getActiveSprint(boardId: number): Promise<{
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    goal: string | null;
  } | null> {
    const key = cacheKey("jira", "active-sprint", String(boardId));
    const cached = this.cache.get<any>(key);
    if (cached) return cached;

    this.limiter.consume();
    logger.info("sprint_metrics", "fetching active sprint", `board ${boardId}`);

    const data: any = await this.request(`/rest/agile/1.0/board/${boardId}/sprint`, {
      params: { state: "active" },
    });

    const sprint = data.values?.[0];
    if (!sprint) return null;

    const result = {
      id: sprint.id,
      name: sprint.name,
      startDate: sprint.startDate ?? "",
      endDate: sprint.endDate ?? "",
      goal: sprint.goal ?? null,
    };

    this.cache.set(key, result, CacheTTL.SPRINT);
    return result;
  }

  /**
   * Get all issues in a sprint.
   */
  async getSprintIssues(sprintId: number): Promise<JiraIssue[]> {
    const key = cacheKey("jira", "sprint-issues", String(sprintId));
    const cached = this.cache.get<JiraIssue[]>(key);
    if (cached) return cached;

    this.limiter.consume();
    logger.info("sprint_metrics", "fetching sprint issues", `sprint ${sprintId}`);

    const data: any = await this.request(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
      params: {
        maxResults: "100",
        fields: "summary,status,assignee,priority,issuetype,customfield_10016,created,updated,labels",
      },
    });

    const issues: JiraIssue[] = (data.issues ?? []).map((issue: any) => ({
      key: issue.key,
      summary: issue.fields?.summary ?? "",
      status: issue.fields?.status?.name ?? "Unknown",
      assignee: issue.fields?.assignee?.displayName ?? null,
      priority: issue.fields?.priority?.name ?? "Medium",
      issue_type: issue.fields?.issuetype?.name ?? "Task",
      story_points: issue.fields?.customfield_10016 ?? null,
      created: issue.fields?.created ?? "",
      updated: issue.fields?.updated ?? "",
      labels: issue.fields?.labels ?? [],
    }));

    this.cache.set(key, issues, CacheTTL.SPRINT);
    return issues;
  }

  /**
   * Build sprint metrics from Jira data.
   */
  async getSprintMetrics(boardId: number, sprintId?: number): Promise<SprintMetrics | null> {
    // Get active sprint if no specific sprint requested
    let sprint: any;
    if (sprintId) {
      const key = cacheKey("jira", "sprint-info", String(sprintId));
      sprint = this.cache.get(key);
      if (!sprint) {
        this.limiter.consume();
        sprint = await this.request(`/rest/agile/1.0/sprint/${sprintId}`);
        this.cache.set(key, sprint, CacheTTL.SPRINT);
      }
      sprint = {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate ?? "",
        endDate: sprint.endDate ?? "",
        goal: sprint.goal ?? null,
      };
    } else {
      sprint = await this.getActiveSprint(boardId);
    }

    if (!sprint) return null;

    const issues = await this.getSprintIssues(sprint.id);

    // Categorize issues by status
    const doneStatuses = new Set(["Done", "Closed", "Resolved", "Released"]);
    const inProgressStatuses = new Set(["In Progress", "In Review", "In Testing", "Code Review"]);
    const blockedStatuses = new Set(["Blocked", "On Hold", "Impediment"]);

    let completed = 0;
    let inProgress = 0;
    let todo = 0;
    let blocked = 0;
    let totalPoints = 0;
    let completedPoints = 0;

    const blockers: BlockerItem[] = [];

    for (const issue of issues) {
      const status = issue.status;
      const points = issue.story_points ?? 0;
      totalPoints += points;

      if (doneStatuses.has(status)) {
        completed++;
        completedPoints += points;
      } else if (blockedStatuses.has(status)) {
        blocked++;
        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(issue.updated).getTime()) / (1000 * 60 * 60 * 24)
        );
        blockers.push({
          key: issue.key,
          title: issue.summary,
          assignee: issue.assignee,
          stuck_days: daysSinceUpdate,
          reason: `Status: ${status}`,
        });
      } else if (inProgressStatuses.has(status)) {
        inProgress++;
      } else {
        todo++;
      }
    }

    // Detect stale issues (open > 5 days without update) as risks
    const risks: string[] = [];
    for (const issue of issues) {
      if (doneStatuses.has(issue.status)) continue;
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(issue.updated).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceUpdate > 5) {
        risks.push(`${issue.key} "${issue.summary}" — no activity for ${daysSinceUpdate} days`);
      }
    }

    // Days remaining
    const endDate = new Date(sprint.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    const totalIssues = issues.length;

    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        start_date: sprint.startDate,
        end_date: sprint.endDate,
        days_remaining: daysRemaining,
        goal: sprint.goal,
      },
      progress: {
        total_issues: totalIssues,
        completed,
        in_progress: inProgress,
        todo,
        blocked,
        completion_percent: totalIssues > 0 ? Math.round((completed / totalIssues) * 100 * 10) / 10 : 0,
      },
      story_points: totalPoints > 0 ? {
        total: totalPoints,
        completed: completedPoints,
        remaining: totalPoints - completedPoints,
      } : null,
      velocity: {
        prs_merged: 0, // filled by sprint_metrics tool from GitHub/GitLab
        avg_lines_per_pr: 0,
        commits: 0,
        contributors_active: 0,
      },
      blockers,
      risks,
    };
  }

  /**
   * Search issues via JQL.
   */
  async search(jql: string, fields?: string[], maxResults = 50, refresh = false): Promise<JiraSearchResult> {
    const key = cacheKey("jira", "search", hashParams({ jql, fields, maxResults }));
    const cached = this.cache.get<JiraSearchResult>(key, refresh);
    if (cached) {
      logger.debug("jira_search", "cache hit", key);
      return cached;
    }

    this.limiter.consume();
    logger.info("jira_search", "searching", jql.substring(0, 80));

    const defaultFields = ["summary", "status", "assignee", "priority", "issuetype", "customfield_10016", "created", "updated", "labels"];

    const data: any = await this.request("/rest/api/3/search", {
      method: "POST",
      body: {
        jql,
        maxResults,
        fields: fields ?? defaultFields,
      },
    });

    const issues: JiraIssue[] = (data.issues ?? []).map((issue: any) => ({
      key: issue.key,
      summary: issue.fields?.summary ?? "",
      status: issue.fields?.status?.name ?? "Unknown",
      assignee: issue.fields?.assignee?.displayName ?? null,
      priority: issue.fields?.priority?.name ?? "Medium",
      issue_type: issue.fields?.issuetype?.name ?? "Task",
      story_points: issue.fields?.customfield_10016 ?? null,
      created: issue.fields?.created ?? "",
      updated: issue.fields?.updated ?? "",
      labels: issue.fields?.labels ?? [],
    }));

    const result: JiraSearchResult = {
      total: data.total ?? issues.length,
      issues,
    };

    this.cache.set(key, result, CacheTTL.ISSUE_LIST);
    return result;
  }
}
