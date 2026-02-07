/**
 * ShipMate — OpenClaw Plugin
 *
 * Custom tools for engineering project management.
 * Phase 2: implements data-rich integrations that go beyond CLI.
 *
 * ## Rate Limiting & Caching Strategy (Phase 2)
 *
 * GitHub API limits: 5000 req/hr (authenticated), 60/hr (unauthenticated).
 * ShipMate target: <100 req/hr per team (typical usage).
 *
 * ### Caching layer
 * - In-memory cache with TTL per endpoint:
 *   - PR metadata: 5 min TTL (changes rarely during review)
 *   - Issue list: 5 min TTL
 *   - PR diff: 15 min TTL (immutable until new commits)
 *   - Contributor stats: 30 min TTL (expensive, changes slowly)
 * - Cache key: `${endpoint}:${params_hash}`
 * - Cache invalidation: on explicit user request ("refresh") or TTL expiry
 *
 * ### Rate limiter
 * - Token bucket: 30 tool calls / min per group session
 * - Burst: up to 10 calls in 1 second (for parallel data collection)
 * - On limit hit: return cached data if available, otherwise error with retry hint
 *
 * ### Batch API (GitHub GraphQL)
 * - Use GraphQL for multi-entity queries (e.g., fetch PR + issues + checks in one call)
 * - REST fallback for simple single-entity lookups
 * - Target: 1 GraphQL call replaces 3-5 REST calls
 *
 * TODO: Implement after skills-only validation (Phase 1)
 */

// import { registerGithubTools } from "./tools/github";
// import { registerSprintTools } from "./tools/sprint";
// import { registerTaskTools } from "./tools/task";

export default function register(api: any) {
  // Phase 2: uncomment and implement
  // registerGithubTools(api);
  // registerSprintTools(api);
  // registerTaskTools(api);

  console.log("[ShipMate] Plugin loaded (Phase 2 — not yet implemented)");
}
