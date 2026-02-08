/**
 * Shared types for ShipMate plugin.
 */

/** TTL presets for different data types (milliseconds) */
export const CacheTTL = {
  /** PR/MR metadata — changes rarely during review */
  METADATA: 5 * 60 * 1000,
  /** Issue lists */
  ISSUE_LIST: 5 * 60 * 1000,
  /** PR/MR diffs — immutable until new commits */
  DIFF: 15 * 60 * 1000,
  /** Contributor / team stats — expensive, changes slowly */
  STATS: 30 * 60 * 1000,
  /** Sprint metrics */
  SPRINT: 5 * 60 * 1000,
} as const;

/** OpenClaw plugin API (minimal typing for what we use) */
export interface PluginAPI {
  registerTool(tool: ToolDefinition): void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  sessionId?: string;
  userId?: string;
  [key: string]: unknown;
}

/** Standardized review output (shared between GitHub PR and GitLab MR) */
export interface ReviewResult {
  source: "github" | "gitlab";
  id: number;
  title: string;
  author: string;
  url: string;
  state: string;
  created_at: string;
  updated_at: string;
  lines: {
    additions: number;
    deletions: number;
  };
  files_changed: number;
  files: FileChange[];
  commits_count: number;
  checks: CheckResult[];
  reviews: ReviewComment[];
  labels: string[];
}

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  status: string;
}

export interface CheckResult {
  name: string;
  status: string;
  conclusion: string | null;
}

export interface ReviewComment {
  author: string;
  state: string;
  body: string;
  submitted_at: string;
}

/** Sprint metrics output */
export interface SprintMetrics {
  sprint: {
    id: number | null;
    name: string;
    start_date: string;
    end_date: string;
    days_remaining: number;
    goal: string | null;
  };
  progress: {
    total_issues: number;
    completed: number;
    in_progress: number;
    todo: number;
    blocked: number;
    completion_percent: number;
  };
  story_points: {
    total: number;
    completed: number;
    remaining: number;
  } | null;
  velocity: {
    prs_merged: number;
    avg_lines_per_pr: number;
    commits: number;
    contributors_active: number;
  };
  blockers: BlockerItem[];
  risks: string[];
}

export interface BlockerItem {
  key: string;
  title: string;
  assignee: string | null;
  stuck_days: number;
  reason: string;
}

/** Team stats output */
export interface TeamStats {
  period: string;
  repo: string;
  contributors: ContributorStats[];
  summary: {
    total_prs: number;
    total_reviews: number;
    avg_merge_time_hours: number;
    total_additions: number;
    total_deletions: number;
  };
}

export interface ContributorStats {
  login: string;
  prs_authored: number;
  prs_reviewed: number;
  additions: number;
  deletions: number;
  avg_merge_time_hours: number;
}

/** Jira search result */
export interface JiraSearchResult {
  total: number;
  issues: JiraIssue[];
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  priority: string;
  issue_type: string;
  story_points: number | null;
  created: string;
  updated: string;
  labels: string[];
}
