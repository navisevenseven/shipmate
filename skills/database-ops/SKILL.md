---
name: shipmate-database-ops
description: "Database schema review, migration safety analysis, query diagnostics, and DB health checks for PM context."
metadata:
  { "openclaw": { "emoji": "🗄️", "requires": { "bins": ["git"] } } }
---

# Database Operations

You help development teams review database migrations, analyze schema changes, and diagnose query performance issues. This skill operates in two modes: file-based (no DB connection needed) and connected (with DB access).

## When to use

- User asks about database migrations, schema changes, or query performance
- User says: "database", "migration", "schema", "slow query", "БД", "миграция", "индексы", "explain", "таблица", "DB review"
- A PR includes migration files or schema changes
- Before a release that includes database changes
- User wants to check database health or performance

**Related skills:** For architecture/schema design → `../system-design/SKILL.md`. For migration planning in feature decomposition → `../project-planning/SKILL.md`. For pre-release DB checks → `../release-management/SKILL.md`.

## team-context.md Fields

Check `data/team-context.md` for:

```
## Database Config
- db_type: postgres | mysql | sqlite
- connection_string_env: DATABASE_URL  # env var name, NOT the value
- migration_tool: alembic | prisma | typeorm | knex | django | raw-sql
- schema_path: prisma/schema.prisma | src/models/ | migrations/
```

## Context Management

Database output (especially EXPLAIN plans) can be large. Follow these rules:

1. **Mode A first.** Always try file-based analysis before connecting to DB
2. **Limit query results.** Always add `LIMIT` to diagnostic queries
3. **Summarize EXPLAIN output.** Extract key info (scan type, cost, rows) — don't dump full plans
4. **Safety first.** Read-only queries only. See Safety Rules section.

**Target: 3-5 commands per request**

## Mode A — File-Based Analysis (no DB connection)

This mode works with zero dependencies beyond `git`. Analyzes migration files, schema definitions, and ORM configs.

### Find Migration Files

```bash
# Common migration paths
find . -path '*/migrations/*.sql' -o -path '*/migrations/*.py' -o -path '*/migrations/*.ts' -o -path '*/migrations/*.js' 2>/dev/null | sort | tail -20

# Prisma
ls prisma/migrations/*/migration.sql 2>/dev/null | tail -10

# Alembic
ls alembic/versions/*.py 2>/dev/null | tail -10

# Django
find . -path '*/migrations/0*.py' 2>/dev/null | tail -10

# Raw SQL
ls migrations/*.sql db/migrate/*.rb 2>/dev/null | tail -10
```

### Read Latest Migration

```bash
# Get the most recent migration file
LATEST=$(find . -path '*/migrations/*' \( -name '*.sql' -o -name '*.py' -o -name '*.ts' \) 2>/dev/null | sort | tail -1)
cat "$LATEST" 2>/dev/null | head -80
```

### Migration Safety Checklist

For every migration, evaluate against this checklist:

| Check | Safe | Dangerous | Notes |
|-------|------|-----------|-------|
| **Backward-compatible** | ADD COLUMN with DEFAULT | DROP COLUMN, RENAME COLUMN | Old code must work with new schema |
| **Reversible** | Has down/rollback migration | No rollback path | Always provide a way back |
| **Data-preserving** | ALTER, ADD | DROP TABLE, TRUNCATE, DELETE | Data loss is irreversible |
| **Lock-safe** | CREATE INDEX CONCURRENTLY | CREATE INDEX (blocks writes) | Long locks = downtime |
| **Non-blocking** | Small batches, async data migration | UPDATE all rows in one transaction | Large transactions lock tables |
| **Tested** | Run on staging with production-like data | Only tested on empty DB | Real data reveals edge cases |

### Schema Review Patterns

Common migration patterns and their risk level:

| Pattern | Risk | Notes |
|---------|------|-------|
| `ADD COLUMN ... DEFAULT value` | Low | Safe, non-blocking in modern Postgres |
| `ADD COLUMN ... NOT NULL` (no default) | High | Fails on existing rows, requires data backfill |
| `DROP COLUMN` | High | Breaking change — old code reads this column |
| `RENAME COLUMN` | High | Breaking change — all code must update simultaneously |
| `CREATE INDEX` | Medium | Blocks writes. Use `CONCURRENTLY` in Postgres |
| `CREATE INDEX CONCURRENTLY` | Low | Non-blocking but slower, Postgres-specific |
| `ALTER COLUMN TYPE` | Medium | May require table rewrite depending on type change |
| `ADD FOREIGN KEY` | Medium | Validates all existing rows — slow on large tables |
| `DROP TABLE` | Critical | Irreversible data loss |
| `Data migration (UPDATE/INSERT)` | Medium | Must be idempotent, handle partial failures |

## Mode B — Connected Analysis (requires DB access)

**Runtime check:** Before running Mode B commands, verify DB client is available:

```bash
# Check for PostgreSQL client
psql --version 2>/dev/null || echo "psql not available"

# Check for MySQL client  
mysql --version 2>/dev/null || echo "mysql not available"
```

If no DB client is available, inform the user and offer Mode A analysis only.

### PostgreSQL Diagnostics

```bash
# Table sizes (top 10)
psql "$DATABASE_URL" -c "SELECT schemaname || '.' || tablename AS table,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS data_size
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC LIMIT 10;"

# Missing indexes (tables with high sequential scan ratio)
psql "$DATABASE_URL" -c "SELECT relname AS table, seq_scan, idx_scan,
  CASE WHEN seq_scan + idx_scan > 0 
    THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 1) 
    ELSE 0 END AS seq_scan_pct
FROM pg_stat_user_tables 
WHERE seq_scan + idx_scan > 100
ORDER BY seq_scan_pct DESC LIMIT 10;"

# Slow query candidates (from pg_stat_statements if available)
psql "$DATABASE_URL" -c "SELECT query, calls, mean_exec_time::int AS avg_ms, total_exec_time::int AS total_ms
FROM pg_stat_statements 
WHERE mean_exec_time > 100
ORDER BY total_exec_time DESC LIMIT 10;" 2>/dev/null || echo "pg_stat_statements not available"

# Active connections
psql "$DATABASE_URL" -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"

# Table row counts (approximate)
psql "$DATABASE_URL" -c "SELECT relname AS table, n_live_tup AS approx_rows
FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;"
```

### Query Analysis

**CRITICAL SAFETY RULE:**
- `EXPLAIN` (without ANALYZE) — safe for ANY query. Shows plan without executing.
- `EXPLAIN ANALYZE` — EXECUTES the query. Use ONLY for SELECT queries. NEVER for INSERT/UPDATE/DELETE.

```bash
# Safe: EXPLAIN for any query (shows plan, doesn't execute)
psql "$DATABASE_URL" -c "EXPLAIN <query>;"

# Safe: EXPLAIN ANALYZE for SELECT only
psql "$DATABASE_URL" -c "EXPLAIN ANALYZE SELECT ... LIMIT 100;"

# DANGEROUS — NEVER do this:
# psql "$DATABASE_URL" -c "EXPLAIN ANALYZE DELETE FROM users WHERE ...;"
```

### MySQL Diagnostics

```bash
# Table sizes
mysql -e "SELECT table_name, 
  ROUND(data_length/1024/1024, 2) AS data_mb,
  ROUND(index_length/1024/1024, 2) AS index_mb,
  table_rows AS approx_rows
FROM information_schema.tables 
WHERE table_schema = DATABASE()
ORDER BY data_length DESC LIMIT 10;"

# Slow queries (if slow query log enabled)
mysql -e "SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;" 2>/dev/null || echo "Slow query log not available"
```

## Output Format

### Migration Review

```markdown
## Database Review

### Migration: <filename>
**Tool:** <alembic/prisma/django/raw-sql>
**Type:** Schema change | Data migration | Mixed

### Safety Checklist
| Check | Status | Notes |
|-------|--------|-------|
| Backward-compatible | ✅ | ADD COLUMN with DEFAULT |
| Reversible | ⚠️ | No down migration found |
| Data-preserving | ✅ | No data deletion |
| Lock-safe | ✅ | CONCURRENTLY used for index |
| Non-blocking | ✅ | No large UPDATE/DELETE |
| Tested on staging | ❓ | Cannot verify — ask team |

### Changes
- `ALTER TABLE users ADD COLUMN role varchar(50) DEFAULT 'user'`
- `CREATE INDEX CONCURRENTLY idx_users_role ON users(role)`

### Recommendations
1. Add down migration (DROP COLUMN role, DROP INDEX) for rollback safety
2. Migration looks safe for zero-downtime deploy
```

### DB Health Report (Mode B)

```markdown
## Database Health: <database>

### Tables (top 10 by size)
| Table | Rows | Data Size | Index Size |
|-------|------|-----------|------------|
| events | 2.1M | 450MB | 180MB |
| users | 50K | 12MB | 8MB |

### Performance Flags
| Issue | Table | Details |
|-------|-------|---------|
| ⚠️ High seq scan ratio | events | 89% seq scans — consider adding index |
| ⚠️ Slow query | — | SELECT * FROM events WHERE ... (avg 340ms) |

### Connections
- Active: 12 | Idle: 45 | Total: 57

### Recommendations
1. Add index on events(user_id, created_at) — 89% sequential scans
2. Optimize slow query: add WHERE clause or pagination
3. Consider connection pooling — 45 idle connections
```

## Persistence

After generating a DB review, persist key findings:

```bash
cat >> memory/$(date +%Y-%m-%d).md << 'DB_EOF'
## Database Review (<date>)
- Migration: <filename> — <safe/warning/dangerous>
- Top issues: <list>
- Largest tables: <list with sizes>
DB_EOF
```

## Fallback Behavior

- If no migration files found: "No migration files found. What migration tool does the project use? I can look in custom paths."
- If no DB client available (Mode B requested): "No database client (psql/mysql) available. I can analyze migration files (Mode A) without a DB connection. Install psql/mysql for live database diagnostics."
- If `DATABASE_URL` not set: "Database connection string not configured. Set `connection_string_env` in `data/team-context.md` or provide the env var name."
- If `pg_stat_statements` not available: "pg_stat_statements extension not enabled. Slow query analysis limited. Enable it for query performance tracking."
- If schema tool not recognized: "I don't recognize this migration format. Can you point me to the migration files?"

## Safety Rules

- **SELECT ONLY for connected queries.** Never run UPDATE, DELETE, INSERT, DROP, ALTER, TRUNCATE
- **EXPLAIN vs EXPLAIN ANALYZE:** EXPLAIN is always safe. EXPLAIN ANALYZE executes the query — use ONLY for SELECT
- **Never display connection strings.** Reference by env var name only (e.g., `$DATABASE_URL`)
- **Limit all queries.** Always include `LIMIT` clause in diagnostic queries
- **No schema modifications.** This skill observes and reports — it does not make changes
- **Staging preference.** If both staging and production connections are available, default to staging
- **Credential awareness.** Never log, display, or store database credentials
