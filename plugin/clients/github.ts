/**
 * GitHub GraphQL client.
 *
 * Uses @octokit/graphql for efficient batched queries.
 * 1 GraphQL call replaces 3-5 REST calls.
 */

import { graphql } from "@octokit/graphql";
import { Cache, cacheKey } from "../lib/cache.js";
import { RateLimiter } from "../lib/rate-limiter.js";
import { logger } from "../lib/logger.js";
import { CacheTTL } from "../lib/types.js";
import type { ReviewResult, FileChange, CheckResult, ReviewComment, TeamStats, ContributorStats } from "../lib/types.js";
import type { ScopeGuard } from "../lib/scope-guard.js";

export class GitHubClient {
  private gql: typeof graphql;
  private cache: Cache;
  private limiter: RateLimiter;
  private guard: ScopeGuard;

  constructor(token: string, cache: Cache, limiter: RateLimiter, guard: ScopeGuard) {
    this.gql = graphql.defaults({
      headers: { authorization: `token ${token}` },
    });
    this.cache = cache;
    this.limiter = limiter;
    this.guard = guard;
  }

  /**
   * Fetch full PR context in a single GraphQL call.
   * Replaces: gh pr view + gh pr diff --stat + gh pr checks
   */
  async getPullRequest(owner: string, repo: string, number: number, refresh = false): Promise<ReviewResult> {
    this.guard.checkGitHub(owner, repo);

    const key = cacheKey("github", "pr", owner, repo, String(number));
    const cached = this.cache.get<ReviewResult>(key, refresh);
    if (cached) {
      logger.debug("github_pr_review", "cache hit", key);
      return cached;
    }

    this.limiter.consume();
    logger.info("github_pr_review", "fetching PR", `${owner}/${repo}#${number}`);

    const query = `
      query PullRequestReview($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            title
            body
            state
            url
            createdAt
            updatedAt
            author { login }
            additions
            deletions
            changedFiles
            commits { totalCount }
            labels(first: 20) {
              nodes { name }
            }
            files(first: 100) {
              nodes {
                path
                additions
                deletions
                changeType
              }
            }
            reviewDecision
            reviews(first: 50) {
              nodes {
                author { login }
                state
                body
                submittedAt
              }
            }
            commits(last: 1) {
              nodes {
                commit {
                  statusCheckRollup {
                    contexts(first: 50) {
                      nodes {
                        ... on CheckRun {
                          name
                          status
                          conclusion
                        }
                        ... on StatusContext {
                          context
                          state
                          description
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response: any = await this.gql(query, { owner, repo, number });
    const pr = response.repository.pullRequest;

    const files: FileChange[] = (pr.files?.nodes ?? []).map((f: any) => ({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
      status: f.changeType?.toLowerCase() ?? "modified",
    }));

    const checks: CheckResult[] = [];
    const rollup = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? [];
    for (const ctx of rollup) {
      if (ctx.name) {
        checks.push({ name: ctx.name, status: ctx.status, conclusion: ctx.conclusion });
      } else if (ctx.context) {
        checks.push({ name: ctx.context, status: ctx.state, conclusion: ctx.description });
      }
    }

    const reviews: ReviewComment[] = (pr.reviews?.nodes ?? [])
      .filter((r: any) => r.body || r.state !== "COMMENTED")
      .map((r: any) => ({
        author: r.author?.login ?? "unknown",
        state: r.state,
        body: r.body ?? "",
        submitted_at: r.submittedAt ?? "",
      }));

    const result: ReviewResult = {
      source: "github",
      id: number,
      title: pr.title,
      author: pr.author?.login ?? "unknown",
      url: pr.url,
      state: pr.state,
      created_at: pr.createdAt,
      updated_at: pr.updatedAt,
      lines: { additions: pr.additions, deletions: pr.deletions },
      files_changed: pr.changedFiles,
      files,
      commits_count: pr.commits?.totalCount ?? 0,
      checks,
      reviews,
      labels: (pr.labels?.nodes ?? []).map((l: any) => l.name),
    };

    this.cache.set(key, result, CacheTTL.METADATA);
    return result;
  }

  /**
   * Fetch team contribution stats for a period.
   * Uses GitHub's search API via GraphQL for PR metrics.
   */
  async getTeamStats(owner: string, repo: string, since: string, until?: string): Promise<TeamStats> {
    this.guard.checkGitHub(owner, repo);

    const untilDate = until ?? new Date().toISOString().split("T")[0];
    const key = cacheKey("github", "team-stats", owner, repo, since, untilDate);
    const cached = this.cache.get<TeamStats>(key);
    if (cached) {
      logger.debug("github_team_stats", "cache hit", key);
      return cached;
    }

    this.limiter.consume();
    logger.info("github_team_stats", "fetching stats", `${owner}/${repo} ${since}..${untilDate}`);

    // Fetch merged PRs in the period
    const query = `
      query TeamStats($searchQuery: String!) {
        search(query: $searchQuery, type: ISSUE, first: 100) {
          nodes {
            ... on PullRequest {
              number
              title
              author { login }
              additions
              deletions
              mergedAt
              createdAt
              reviews(first: 20) {
                nodes {
                  author { login }
                }
              }
            }
          }
        }
      }
    `;

    const searchQuery = `repo:${owner}/${repo} is:pr is:merged merged:${since}..${untilDate}`;
    const response: any = await this.gql(query, { searchQuery });
    const prs = response.search.nodes ?? [];

    // Aggregate per-contributor stats
    const contributorMap = new Map<string, ContributorStats>();

    const getOrCreate = (login: string): ContributorStats => {
      if (!contributorMap.has(login)) {
        contributorMap.set(login, {
          login,
          prs_authored: 0,
          prs_reviewed: 0,
          additions: 0,
          deletions: 0,
          avg_merge_time_hours: 0,
        });
      }
      return contributorMap.get(login)!;
    };

    let totalMergeTime = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;
    const reviewerSet = new Set<string>();

    for (const pr of prs) {
      const authorLogin = pr.author?.login ?? "unknown";
      const author = getOrCreate(authorLogin);
      author.prs_authored += 1;
      author.additions += pr.additions ?? 0;
      author.deletions += pr.deletions ?? 0;
      totalAdditions += pr.additions ?? 0;
      totalDeletions += pr.deletions ?? 0;

      // Merge time
      if (pr.createdAt && pr.mergedAt) {
        const created = new Date(pr.createdAt).getTime();
        const merged = new Date(pr.mergedAt).getTime();
        const hours = (merged - created) / (1000 * 60 * 60);
        totalMergeTime += hours;
        author.avg_merge_time_hours += hours;
      }

      // Reviewers
      for (const review of pr.reviews?.nodes ?? []) {
        const reviewerLogin = review.author?.login;
        if (reviewerLogin && reviewerLogin !== authorLogin) {
          const reviewer = getOrCreate(reviewerLogin);
          reviewer.prs_reviewed += 1;
          reviewerSet.add(reviewerLogin);
        }
      }
    }

    // Calculate averages
    for (const c of contributorMap.values()) {
      if (c.prs_authored > 0) {
        c.avg_merge_time_hours = Math.round((c.avg_merge_time_hours / c.prs_authored) * 10) / 10;
      }
    }

    const contributors = Array.from(contributorMap.values()).sort(
      (a, b) => b.prs_authored - a.prs_authored
    );

    const result: TeamStats = {
      period: `${since}..${untilDate}`,
      repo: `${owner}/${repo}`,
      contributors,
      summary: {
        total_prs: prs.length,
        total_reviews: reviewerSet.size,
        avg_merge_time_hours: prs.length > 0 ? Math.round((totalMergeTime / prs.length) * 10) / 10 : 0,
        total_additions: totalAdditions,
        total_deletions: totalDeletions,
      },
    };

    this.cache.set(key, result, CacheTTL.STATS);
    return result;
  }

  /**
   * Fetch merged PR count for sprint metrics.
   */
  async getMergedPRCount(owner: string, repo: string, since: string): Promise<{ count: number; avg_lines: number }> {
    this.guard.checkGitHub(owner, repo);

    const key = cacheKey("github", "merged-count", owner, repo, since);
    const cached = this.cache.get<{ count: number; avg_lines: number }>(key);
    if (cached) return cached;

    this.limiter.consume();

    const query = `
      query MergedPRs($searchQuery: String!) {
        search(query: $searchQuery, type: ISSUE, first: 100) {
          issueCount
          nodes {
            ... on PullRequest {
              additions
              deletions
            }
          }
        }
      }
    `;

    const searchQuery = `repo:${owner}/${repo} is:pr is:merged merged:>=${since}`;
    const response: any = await this.gql(query, { searchQuery });
    const count = response.search.issueCount ?? 0;
    const nodes = response.search.nodes ?? [];

    let totalLines = 0;
    for (const pr of nodes) {
      totalLines += (pr.additions ?? 0) + (pr.deletions ?? 0);
    }

    const result = {
      count,
      avg_lines: nodes.length > 0 ? Math.round(totalLines / nodes.length) : 0,
    };

    this.cache.set(key, result, CacheTTL.SPRINT);
    return result;
  }
  /**
   * Validate that the token only has access to the allowed repos.
   * Runs at startup — logs a warning if the token can see extra repos.
   */
  async validateTokenScope(): Promise<{ ok: boolean; message: string; visibleRepos: string[] }> {
    try {
      const query = `query { viewer { repositories(first: 100, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) { nodes { nameWithOwner } } } }`;
      const response: any = await this.gql(query);
      const repos: string[] = (response.viewer?.repositories?.nodes ?? []).map(
        (r: any) => (r.nameWithOwner as string).toLowerCase(),
      );

      const allowed = new Set<string>();
      if (this.guard.hasGitHubScope) {
        // Re-read from guard internal state via checkGitHub — we just need the set
        // For validation, compare visible repos against what's expected
        const extraRepos = repos.filter((r) => {
          try {
            const [owner, repo] = r.split("/");
            this.guard.checkGitHub(owner!, repo!);
            return false;
          } catch {
            return true;
          }
        });

        if (extraRepos.length > 0) {
          const msg = `Token has access to ${repos.length} repos but only ${repos.length - extraRepos.length} are in scope. ` +
            `Extra repos: ${extraRepos.slice(0, 5).join(", ")}${extraRepos.length > 5 ? "..." : ""}. ` +
            `Create a Fine-grained PAT scoped to your project repo only.`;
          logger.warn("scope-guard", "token scope warning", msg);
          return { ok: false, message: msg, visibleRepos: repos };
        }
      }

      return { ok: true, message: "Token scope matches configuration", visibleRepos: repos };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Failed to validate token scope: ${msg}`, visibleRepos: [] };
    }
  }
}

/** Parse "owner/repo" string. */
export function parseRepo(repoStr: string): { owner: string; repo: string } {
  const parts = repoStr.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo format: "${repoStr}". Expected "owner/repo".`);
  }
  return { owner: parts[0], repo: parts[1] };
}
