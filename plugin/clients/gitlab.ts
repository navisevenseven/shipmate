/**
 * GitLab GraphQL/REST client.
 *
 * Uses GitLab GraphQL API (/api/graphql) for MR data.
 * Falls back to REST for endpoints not available in GraphQL.
 */

import { Cache, cacheKey } from "../lib/cache.js";
import { RateLimiter } from "../lib/rate-limiter.js";
import { logger } from "../lib/logger.js";
import { CacheTTL } from "../lib/types.js";
import type { ReviewResult, FileChange, CheckResult, ReviewComment } from "../lib/types.js";
import type { ScopeGuard } from "../lib/scope-guard.js";

export class GitLabClient {
  private host: string;
  private token: string;
  private cache: Cache;
  private limiter: RateLimiter;
  private guard: ScopeGuard;

  constructor(host: string, token: string, cache: Cache, limiter: RateLimiter, guard: ScopeGuard) {
    this.host = host.replace(/\/+$/, "");
    this.token = token;
    this.cache = cache;
    this.limiter = limiter;
    this.guard = guard;
  }

  /**
   * Execute a GitLab GraphQL query.
   */
  private async graphql<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const url = `${this.host}/api/graphql`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PRIVATE-TOKEN": this.token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitLab GraphQL error ${res.status}: ${text}`);
    }

    const json: any = await res.json();
    if (json.errors?.length) {
      throw new Error(`GitLab GraphQL: ${json.errors.map((e: any) => e.message).join("; ")}`);
    }

    return json.data as T;
  }

  /**
   * Execute a GitLab REST API call.
   */
  private async rest<T = any>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.host}/api/v4${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: { "PRIVATE-TOKEN": this.token },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitLab REST error ${res.status}: ${text}`);
    }

    return (await res.json()) as T;
  }

  /**
   * Fetch full MR context via GraphQL.
   * project should be the full path like "group/subgroup/project"
   */
  async getMergeRequest(project: string, iid: number, refresh = false): Promise<ReviewResult> {
    this.guard.checkGitLab(project);

    const key = cacheKey("gitlab", "mr", project, String(iid));
    const cached = this.cache.get<ReviewResult>(key, refresh);
    if (cached) {
      logger.debug("gitlab_mr_review", "cache hit", key);
      return cached;
    }

    this.limiter.consume();
    logger.info("gitlab_mr_review", "fetching MR", `${project}!${iid}`);

    const query = `
      query MergeRequestReview($project: ID!, $iid: String!) {
        project(fullPath: $project) {
          mergeRequest(iid: $iid) {
            title
            description
            state
            webUrl
            createdAt
            updatedAt
            author { username }
            diffStatsSummary {
              additions
              deletions
              fileCount
            }
            commitCount
            labels {
              nodes { title }
            }
            diffStats {
              path
              additions
              deletions
            }
            headPipeline {
              status
              stages {
                nodes {
                  name
                  status
                  jobs {
                    nodes {
                      name
                      status
                    }
                  }
                }
              }
            }
            notes(first: 50) {
              nodes {
                author { username }
                body
                createdAt
                system
                resolvable
                resolved
              }
            }
            approvedBy {
              nodes { username }
            }
          }
        }
      }
    `;

    const data: any = await this.graphql(query, { project, iid: String(iid) });
    const mr = data.project?.mergeRequest;

    if (!mr) {
      throw new Error(`MR !${iid} not found in project ${project}`);
    }

    const files: FileChange[] = (mr.diffStats ?? []).map((d: any) => ({
      path: d.path,
      additions: d.additions,
      deletions: d.deletions,
      status: "modified",
    }));

    const checks: CheckResult[] = [];
    if (mr.headPipeline) {
      checks.push({
        name: "pipeline",
        status: mr.headPipeline.status,
        conclusion: mr.headPipeline.status,
      });
      for (const stage of mr.headPipeline.stages?.nodes ?? []) {
        for (const job of stage.jobs?.nodes ?? []) {
          checks.push({
            name: `${stage.name}/${job.name}`,
            status: job.status,
            conclusion: job.status,
          });
        }
      }
    }

    // Filter out system notes, keep discussion comments
    const reviews: ReviewComment[] = (mr.notes?.nodes ?? [])
      .filter((n: any) => !n.system && n.body)
      .map((n: any) => ({
        author: n.author?.username ?? "unknown",
        state: n.resolvable ? (n.resolved ? "RESOLVED" : "PENDING") : "COMMENTED",
        body: n.body,
        submitted_at: n.createdAt,
      }));

    // Add approvals as review entries
    for (const approver of mr.approvedBy?.nodes ?? []) {
      reviews.push({
        author: approver.username,
        state: "APPROVED",
        body: "",
        submitted_at: mr.updatedAt,
      });
    }

    const result: ReviewResult = {
      source: "gitlab",
      id: iid,
      title: mr.title,
      author: mr.author?.username ?? "unknown",
      url: mr.webUrl,
      state: mr.state,
      created_at: mr.createdAt,
      updated_at: mr.updatedAt,
      lines: {
        additions: mr.diffStatsSummary?.additions ?? 0,
        deletions: mr.diffStatsSummary?.deletions ?? 0,
      },
      files_changed: mr.diffStatsSummary?.fileCount ?? 0,
      files,
      commits_count: mr.commitCount ?? 0,
      checks,
      reviews,
      labels: (mr.labels?.nodes ?? []).map((l: any) => l.title),
    };

    this.cache.set(key, result, CacheTTL.METADATA);
    return result;
  }

  /**
   * Fetch merged MR count for sprint metrics.
   * Uses REST since search-based queries are simpler with REST.
   */
  async getMergedMRCount(projectId: string, since: string): Promise<{ count: number; avg_lines: number }> {
    this.guard.checkGitLab(projectId);

    const key = cacheKey("gitlab", "merged-count", projectId, since);
    const cached = this.cache.get<{ count: number; avg_lines: number }>(key);
    if (cached) return cached;

    this.limiter.consume();

    const mrs: any[] = await this.rest(`/projects/${encodeURIComponent(projectId)}/merge_requests`, {
      state: "merged",
      created_after: since,
      per_page: "100",
    });

    let totalLines = 0;
    for (const mr of mrs) {
      // changes_count is a string in GitLab REST API
      totalLines += parseInt(mr.changes_count ?? "0", 10);
    }

    const result = {
      count: mrs.length,
      avg_lines: mrs.length > 0 ? Math.round(totalLines / mrs.length) : 0,
    };

    this.cache.set(key, result, CacheTTL.SPRINT);
    return result;
  }
}
