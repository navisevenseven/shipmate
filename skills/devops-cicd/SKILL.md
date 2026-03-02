---
name: shipmate-devops-cicd
description: "CI/CD pipeline monitoring, build failure triage, flaky test detection, DORA metrics, and workflow health analysis."
metadata:
  { "openclaw": { "emoji": "⚙️", "requires": { "anyBins": ["gh", "glab"] } } }
---

# DevOps — CI/CD Pipeline Operations

You help development teams monitor CI/CD pipelines, diagnose build failures, detect flaky tests, and track deployment health metrics.

## When to use

- User asks about CI/CD status, build failures, or pipeline health
- User says: "CI упал", "build failed", "pipeline status", "flaky tests", "workflow runs", "почему не собирается", "статус пайплайна", "DORA metrics", "deploy frequency"
- User shares a failed build link or asks why a workflow is red
- User wants pipeline health report or deployment metrics

**Related skills:** For K8s pod/deployment issues → `../devops-k8s/SKILL.md`. For Docker build issues → `../devops-docker/SKILL.md`. For production incidents triggered by CI failure → `../incident-response/SKILL.md`.

## team-context.md Fields

Check `data/team-context.md` for:

```
## CI/CD Config
- default_branch: main
- ci_platform: github | gitlab
- deploy_workflow_name: <workflow name for production deploys>
```

## Plugin Tools (preferred)

If the ShipMate plugin is installed, **prefer plugin tools over CLI**:

- **GitHub:** use `github_team_stats` tool for workflow run data
- **Sprint context:** use `sprint_metrics` for correlating CI health with sprint progress

If plugin tools are NOT available, fall back to CLI commands below.

## Platform Detection

Detect the CI platform automatically:

| Signal | Platform |
|--------|----------|
| `.github/workflows/` exists | GitHub Actions |
| `.gitlab-ci.yml` exists | GitLab CI |
| `data/team-context.md` has `ci_platform` | Use configured value |

If both exist, check `data/team-context.md` for preference or ask the user.

## Context Management

CI/CD logs can be extremely large (10k+ lines per run). Follow these rules:

1. **Never fetch full logs.** Use `--log-failed` (GitHub) to get only failing job output
2. **Start with status overview.** List recent runs before diving into specific failures
3. **Summarize after each phase.** Don't keep raw log output in context
4. **Limit results.** Always use `--limit` with list commands (default: 10)

**Target: 3-5 API calls per request** (max 8 for complex debugging)

## Commands

### GitHub Actions

```bash
# Recent workflow runs (overview)
gh run list --limit 10 --json status,conclusion,name,headBranch,createdAt,databaseId --jq '.[] | {id: .databaseId, name, branch: .headBranch, status, conclusion, created: .createdAt}'

# Specific run details
gh run view <run-id> --json status,conclusion,jobs --jq '{status, conclusion, jobs: [.jobs[] | {name, status, conclusion, steps: [.steps[] | select(.conclusion == "failure") | {name, conclusion}]}]}'

# Failed job logs (ONLY failed output — critical for context management)
gh run view <run-id> --log-failed 2>&1 | tail -100

# Workflow runs for specific workflow
gh run list --workflow <workflow-name> --limit 10 --json status,conclusion,createdAt

# Re-run failed jobs (requires user confirmation)
# gh run rerun <run-id> --failed
```

### GitLab CI

```bash
# Recent pipelines
glab ci list --per-page 10

# Pipeline details
glab ci view <pipeline-id>

# Job logs (trace)
glab ci trace <job-id> 2>&1 | tail -100

# Pipeline status for specific branch
glab ci list --branch main --per-page 5
```

### Local Git Analytics (no API calls)

```bash
# Recent merges to main (correlate with CI failures)
git log --oneline --merges --since="3 days ago" -- | head -10

# Who merged last (for failure attribution)
git log --format="%h %an %s" --merges -5
```

## Analysis Patterns

### Build Failure Classification

When a build fails, classify the root cause:

| Category | Signals | Typical Fix |
|----------|---------|-------------|
| **Dependency error** | "npm install failed", "pip: No matching distribution", "Could not resolve dependencies" | Update lockfile, check registry availability |
| **Compilation error** | "TypeScript error", "SyntaxError", "cannot find module" | Code fix needed — check latest commit |
| **Test failure** | "FAIL", "AssertionError", "expected X but got Y" | Investigate test or code logic |
| **Infra/environment** | "No space left on device", "connection refused", "timeout" | CI runner issue — retry or check resources |
| **Timeout** | "Job exceeded maximum time limit" | Optimize tests or increase timeout |
| **Flaky test** | Same test green/red across runs with no code change | Mark test as flaky, investigate non-determinism |

### Flaky Test Detection

To identify flaky tests:

```bash
# GitHub: check if same workflow succeeded and failed recently on same branch
gh run list --workflow <name> --branch main --limit 20 --json conclusion --jq '[.[] | .conclusion] | {total: length, success: (map(select(. == "success")) | length), failure: (map(select(. == "failure")) | length)}'
```

If success rate is 70-95% with no code changes between runs — likely flaky tests.

### Pipeline Health Metrics

```bash
# GitHub: success rate for last 20 runs
gh run list --limit 20 --json conclusion --jq '{total: length, success: ([.[] | select(.conclusion == "success")] | length), failure: ([.[] | select(.conclusion == "failure")] | length)} | . + {success_rate: (.success * 100 / .total | tostring + "%")}'
```

## DORA Metrics

CI/CD data maps directly to DORA metrics — the industry standard for engineering team performance.

### Metric Definitions

| Metric | How to Calculate | Data Source |
|--------|-----------------|-------------|
| **Deployment Frequency** | Successful runs on main per day/week | `gh run list --workflow <deploy> --branch main` |
| **Lead Time for Changes** | Time from commit to successful deploy | git log timestamp → workflow completion time |
| **Change Failure Rate** | Failed runs / total runs on main | `gh run list --branch main` success vs failure |
| **MTTR** | Time from failed run to next successful run | Timestamps of consecutive failed→success runs |

### DORA Benchmarks

| Level | Deploy Frequency | Lead Time | Change Failure Rate | MTTR |
|-------|-----------------|-----------|-------------------|------|
| **Elite** | On-demand (multiple/day) | < 1 hour | < 15% | < 1 hour |
| **High** | Daily to weekly | 1 day – 1 week | 16–30% | < 1 day |
| **Medium** | Weekly to monthly | 1 week – 1 month | 31–45% | < 1 week |
| **Low** | Monthly+ | > 6 months | > 45% | > 6 months |

Always include the team's DORA level when reporting pipeline health.

## Output Format

### Pipeline Status Report

```markdown
## CI/CD Status: <repository>

### Recent Runs (last 10)
| # | Workflow | Branch | Status | Duration | When |
|---|----------|--------|--------|----------|------|
| 123 | CI | main | ✅ success | 4m | 2h ago |
| 122 | CI | main | ❌ failure | 6m | 5h ago |

### Pipeline Health
- **Success rate (last 20 runs):** 85%
- **Avg duration:** 5m 30s
- **Current status:** ✅ Green

### DORA Summary
| Metric | Value | Level |
|--------|-------|-------|
| Deploy Frequency | 3/week | High |
| Lead Time | ~2 hours | Elite |
| Change Failure Rate | 15% | Elite |
| MTTR | ~30 minutes | Elite |

### Failing Jobs (if any)
**Run #122 — CI on main (5h ago):**
- Job: `test` → FAILED
- Error: `AssertionError: expected 200 but got 500 in api.test.ts:42`
- Category: Test failure
- Latest commit: `abc1234` by @developer — "refactor auth middleware"

### Recommendations
- Investigate test failure in api.test.ts (likely caused by auth refactor)
- Success rate 85% is below Elite threshold (>85%) — monitor for flaky tests
```

## Fallback Behavior

- If `gh` unavailable but `glab` is: "GitHub CLI not installed. I can monitor GitLab CI only."
- If `glab` unavailable but `gh` is: "GitLab CLI not installed. I can monitor GitHub Actions only."
- If neither available: "No CI/CD CLI tools found. Install `gh` (GitHub) or `glab` (GitLab) for pipeline monitoring."
- If workflow name unknown: list available workflows and ask user to specify
- If no runs found: "No CI/CD runs found. Is the repository configured with GitHub Actions / GitLab CI?"
- DORA metrics require at least 10 runs for meaningful calculation — note if insufficient data

## Safety Rules

- **Read-only by default.** Only `list`, `view`, `trace` commands are safe to run freely
- **Never re-run pipelines** without explicit user confirmation
- **Never cancel running pipelines** without explicit user confirmation
- **Log filtering:** CI logs may contain secrets (env vars, tokens). If detected, warn the user
- **API budget:** Keep total API calls under 8 per request. Use `--limit` and `--jq` to minimize data transfer
- **Context budget:** Never keep more than 100 lines of log output in context. Summarize and discard
