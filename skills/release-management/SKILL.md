---
name: shipmate-release-management
description: "Release readiness checks, changelog generation, version bumping, and release workflow guidance."
metadata:
  { "openclaw": { "emoji": "🏷️" } }
---

# Release Management

You help the team prepare, validate, and execute software releases with confidence.

## When to use

- User asks about releasing, tagging, or versioning
- User says: "release", "changelog", "tag", "релиз", "что готово к релизу", "release notes", "generate changelog", "version bump", "сделай релиз"
- User wants to check if the codebase is ready for a release

## Plugin Tools (preferred)

If the ShipMate plugin is installed, **prefer plugin tools over CLI**:

- **GitHub PRs:** use `github_pr_review` and `github_team_stats` for merged PR data
- **Jira:** use `jira_search` to check for open blockers
- **Sentry:** use `sentry_issues` to verify no critical unresolved errors before release

If tools are unavailable, fall back to CLI commands below.

## Process

### 1. Determine release scope

Identify what's included in the release:

```bash
# Find the last release tag
git describe --tags --abbrev=0

# If no tags exist
git log --oneline --reverse | head -1
```

```bash
# PRs merged since last tag (GitHub)
gh pr list --state merged --search "merged:>=$(git log -1 --format=%ai $(git describe --tags --abbrev=0) | cut -d' ' -f1)" --json number,title,labels,author --limit 100

# Or via git log between tags
git log $(git describe --tags --abbrev=0)..HEAD --oneline --merges
```

```bash
# MRs merged since last tag (GitLab)
glab mr list --state merged --merged-after="$(git log -1 --format=%ai $(git describe --tags --abbrev=0) | cut -d' ' -f1)" --output-format=json
```

With plugin tools:
- `github_team_stats` with `since` = last tag date gives PR counts and contributors

### 2. Classify changes (semver)

Analyze merged PRs/MRs to determine version bump:

| Change Type | Version Bump | Signals |
|-------------|-------------|---------|
| **Breaking** | MAJOR | PR title/label contains `breaking`, `BREAKING CHANGE`, API removal |
| **Feature** | MINOR | PR title/label contains `feat`, `feature`, `enhancement`, new endpoints |
| **Fix** | PATCH | PR title/label contains `fix`, `bugfix`, `patch`, `hotfix` |

**Detection order:**
1. Check PR labels first (most reliable)
2. Check PR title prefixes (conventional commits: `feat:`, `fix:`, `chore:`)
3. Check commit messages if PR metadata unavailable

If any PR is MAJOR → bump major. Else if any MINOR → bump minor. Else → bump patch.

### 3. Generate changelog

Build a changelog in [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [<version>] - <YYYY-MM-DD>

### Added
- <feat PRs — new functionality>

### Changed
- <enhancement PRs — modified behavior>

### Fixed
- <fix PRs — bug fixes>

### Removed
- <removal PRs — deprecated features removed>

### Security
- <security PRs — vulnerability fixes>
```

**Rules for changelog entries:**
- One line per PR, format: `<PR title> (#<number>)` or `<PR title> (!<number>)` for MR
- Group by type (Added/Changed/Fixed/etc.)
- Include contributor: `<title> (#<number>) — @<author>` for external contributors
- Don't include chore/ci/docs PRs unless they're user-facing
- Keep entries concise — one sentence max

### 4. Pre-release checklist

Run these checks and report status:

#### Code checks

```bash
# Open PRs targeting main/master (should be 0 for clean release)
gh pr list --state open --base main --json number,title --limit 10

# CI status on latest main commit
gh pr checks $(gh pr list --state merged --base main --limit 1 --json number --jq '.[0].number')
```

#### Blocker check (Jira)

```bash
# Open blockers in current sprint
jira_search query="type = Bug AND priority in (Highest, High) AND status != Done AND sprint in openSprints()"
```

Or via curl:
```bash
curl -s -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/search?jql=type=Bug+AND+priority+in+(Highest,High)+AND+status!=Done+AND+sprint+in+openSprints()&maxResults=10" | \
  jq '.issues[] | {key, summary: .fields.summary, status: .fields.status.name, priority: .fields.priority.name}'
```

#### Security check

Run a dependency vulnerability scan before release (→ `../security-awareness/SKILL.md`):
- No critical vulnerabilities in dependencies (`npm audit` / `pip-audit`)
- No secrets detected in recent commits
- If security-awareness skill is unavailable, note the skip in the report

#### Database check

Verify database migration safety (→ `../database-ops/SKILL.md`):
- All pending migrations reviewed and tested on staging
- Migrations are backward-compatible (rollback-safe)
- No destructive operations (DROP TABLE, TRUNCATE) without explicit approval
- If database-ops skill is unavailable, check migration files manually

#### Error check (Sentry)

If Sentry is configured:
- `sentry_issues` with `level=fatal` — should be 0
- `sentry_issues` with `level=error` and `time_range=24h` — check for new error types introduced since last tag

### 5. Present release readiness

## Output Format

```markdown
## Release Readiness: v<current> → v<proposed>

### Summary
- **PRs included:** <count>
- **Contributors:** <count>
- **Version bump:** <MAJOR/MINOR/PATCH> (<current> → <proposed>)
- **Period:** <last tag date> — <today>

### Checklist
| Check | Status | Details |
|-------|--------|---------|
| All PRs merged | ✅/❌ | <N open PRs targeting main> |
| CI green on main | ✅/❌ | <check names and status> |
| No P1/P2 blockers | ✅/❌ | <blocker tickets if any> |
| Security scan clean | ✅/⚠️/❌ | <critical vuln count> |
| DB migrations safe | ✅/⚠️/❌/— | <migration issues if any> |
| No fatal Sentry errors | ✅/⚠️/❌ | <fatal count> |
| No new error types (24h) | ✅/⚠️ | <new error count> |

### Changelog Draft

<generated changelog>

### Release Commands

```bash
# Tag the release
git tag -a v<version> -m "Release v<version>"
git push origin v<version>

# GitHub release (with changelog)
gh release create v<version> --title "v<version>" --notes "<changelog>"

# Or GitLab release
glab release create v<version> --notes "<changelog>"
```

### Post-Release
- [ ] Verify deployment (check pods/CI)
- [ ] Monitor Sentry for new errors (30 min)
- [ ] Update Jira: close resolved tickets
- [ ] Notify team in chat
```

## Version Formats

Support these version formats:
- Semantic: `v1.2.3`, `1.2.3`
- CalVer: `2026.02.20`, `v2026.02`
- Auto-detect from existing tags

If no tags exist, suggest starting with `v0.1.0` or ask the user.

## Fallback Behavior

- If `gh` unavailable: use `git log` for PR data (less structured but works)
- If `glab` unavailable: use `git log` for MR data
- If Jira unavailable: skip blocker check, note it in the report
- If Sentry unavailable: skip error check, note it in the report
- If no tags exist: use first commit as baseline, suggest initial version
- Always tell the user what checks were skipped and why

## Rules

- Never create tags or releases without explicit user approval
- Always show the changelog draft before finalizing
- Include ALL merged PRs — don't silently skip any
- Warn if the period since last release is unusually long (>30 days for active repos)
- Warn if version bump seems inconsistent (e.g., only fixes but suggesting MINOR)
- For monorepos: ask which package/service is being released
- Keep total API calls under 10 per release check
- If CI is red on main, strongly recommend fixing before release
