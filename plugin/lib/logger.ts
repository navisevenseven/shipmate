/**
 * Audit logger for ShipMate plugin.
 *
 * Format: [ShipMate] <tool_name>: <action> <details>
 * Write operations are always logged; reads are logged at debug level.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(tool: string, action: string, details?: string): string {
  const base = `[ShipMate] ${tool}: ${action}`;
  return details ? `${base} — ${details}` : base;
}

export const logger = {
  debug(tool: string, action: string, details?: string): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage(tool, action, details));
    }
  },

  info(tool: string, action: string, details?: string): void {
    if (shouldLog("info")) {
      console.log(formatMessage(tool, action, details));
    }
  },

  warn(tool: string, action: string, details?: string): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage(tool, action, details));
    }
  },

  error(tool: string, action: string, details?: string): void {
    if (shouldLog("error")) {
      console.error(formatMessage(tool, action, details));
    }
  },

  /** Audit log for write/mutation operations — always logged regardless of level. */
  audit(tool: string, action: string, details?: string): void {
    console.log(`[ShipMate:AUDIT] ${tool}: ${action}${details ? ` — ${details}` : ""}`);
  },
};
