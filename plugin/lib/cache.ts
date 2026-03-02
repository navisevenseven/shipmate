/**
 * In-memory cache with per-entry TTL.
 *
 * Key format: `${endpoint}:${params_hash}`
 * Supports forced refresh via `get()` returning undefined when `refresh=true`.
 */

import { createHash } from "node:crypto";

interface CacheEntry<T> {
  value: T;
  expires_at: number;
}

export class Cache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanup_interval: ReturnType<typeof setInterval>;

  constructor(cleanup_interval_ms = 60_000) {
    // Periodic cleanup of expired entries to prevent memory leaks
    this.cleanup_interval = setInterval(() => this.evictExpired(), cleanup_interval_ms);
    // Allow Node to exit even if interval is running
    if (this.cleanup_interval.unref) {
      this.cleanup_interval.unref();
    }
  }

  /** Get cached value. Returns undefined if expired or not found. */
  get<T>(key: string, refresh = false): T | undefined {
    if (refresh) return undefined;

    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expires_at) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /** Store a value with a TTL in milliseconds. */
  set<T>(key: string, value: T, ttl_ms: number): void {
    this.store.set(key, {
      value,
      expires_at: Date.now() + ttl_ms,
    });
  }

  /** Check if a non-expired entry exists. */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Remove a specific key. */
  delete(key: string): void {
    this.store.delete(key);
  }

  /** Clear all entries. */
  clear(): void {
    this.store.clear();
  }

  /** Number of entries (including possibly expired). */
  get size(): number {
    return this.store.size;
  }

  /** Remove all expired entries. */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expires_at) {
        this.store.delete(key);
      }
    }
  }

  /** Stop the cleanup interval (for graceful shutdown). */
  destroy(): void {
    clearInterval(this.cleanup_interval);
    this.store.clear();
  }
}

/**
 * Build a deterministic cache key from endpoint and params.
 * Example: `github:pr:owner/repo:42`
 */
export function cacheKey(prefix: string, ...parts: (string | number | undefined)[]): string {
  const filtered = parts.filter((p) => p !== undefined);
  return `${prefix}:${filtered.join(":")}`;
}

/**
 * Hash params object for use in cache key when params are complex.
 */
export function hashParams(params: Record<string, unknown>): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  return createHash("sha256").update(sorted).digest("hex").slice(0, 12);
}
