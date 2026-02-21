---
name: shipmate-code-review
description: "Deep PR review with multi-dimensional analysis: architecture, security, performance, testing, and maintainability."
metadata:
  { "openclaw": { "emoji": "🔍", "requires": { "anyBins": ["glab", "gh"] } } }
---

# Code Review

You perform thorough, multi-dimensional code reviews on pull requests (GitHub) and merge requests (GitLab).

## When to use

- User asks to review a PR or MR (by number, URL, or `!` prefix)
- User says: "ревью", "review", "посмотри PR", "проверь MR", "проверь код"
- User shares a PR/MR link

## Plugin Tools (preferred)

If the ShipMate plugin is installed, **prefer plugin tools over CLI** — they are faster (single GraphQL call), cached, and rate-limited:

- **GitHub PRs:** use `github_pr_review` tool instead of `gh pr view` + `gh pr diff`
- **GitLab MRs:** use `gitlab_mr_review` tool instead of `glab mr view` + `glab mr diff`

Check if these tools are available in your tool list. If they are, use them directly and skip the CLI commands below. The plugin returns the same structured data but in a single cached API call.

If plugin tools are NOT available, fall back to CLI commands as described below.

## Platform Detection

Detect the platform automatically based on user input:

| Input pattern | Platform | Example |
|---------------|----------|---------|
| `PR #123`, `pr:123`, GitHub URL | GitHub | "Review PR #42" |
| `MR !123`, `mr:123`, `!123`, GitLab URL | GitLab | "Review MR !15" |
| Just a number | Check both | Try `gh` first, then `glab` |

**Auto-detection logic:**
1. If input contains `!` or `mr:` or `gitlab` URL → GitLab
2. If input contains `#` or `pr:` or `github` URL → GitHub
3. If ambiguous → check `data/team-context.md` for default platform
4. If still unclear → ask the user

## Context Management

PR/MR diffs can be 50-200k+ characters. Never fetch the full diff blindly.

**Strategy: stat-first, then file-by-file**

1. Start with `--stat` to get the overview (file list + line counts)
2. For small PRs/MRs (<10 files, <500 lines total): fetch full diff
3. For medium PRs/MRs (10-20 files): fetch diff file-by-file
4. For large PRs/MRs (>20 files or >1000 lines): group files by directory/module (5 files per group), analyze each group separately, then write a combined summary

**Never do:** fetch full diff on a PR/MR with 50+ changed files — this will flood the context.

## Process

### 1. Gather context

#### GitHub PRs (via `gh`)

```bash
# Step 1: PR metadata (1 API call)
gh pr view <number> --json title,body,additions,deletions,changedFiles,files,reviewDecision,closingIssuesReferences,checks

# Step 2: Diff stats — ALWAYS start here (1 API call)
gh pr diff <number> --stat

# Step 3: Based on size, choose strategy:
# Small PR (<10 files, <500 lines): full diff
gh pr diff <number>

# Medium/Large PR: file-by-file or group-by-group
gh pr diff <number> -- src/api/routes.ts src/api/middleware.ts
```

#### GitLab MRs (via `glab`)

```bash
# Step 1: MR metadata (1 API call)
glab mr view <number> --json title,description,changes_count,diff_stats,state,merge_status

# Step 2: Diff stats — ALWAYS start here
glab mr diff <number> --stat

# Step 3: Based on size, choose strategy:
# Small MR: full diff
glab mr diff <number>

# Medium/Large MR: file-by-file
glab mr diff <number> -- src/api/routes.ts

# Step 4: MR discussions/comments
glab mr note list <number>
```

Total: 2-3 API calls for small PRs/MRs, 4-8 for large ones.

### 2. Analyze across dimensions

Review each dimension and score (✅ Good / ⚠️ Needs Attention / ❌ Problem):

#### Architecture
- Does the change fit the existing architecture?
- Are abstractions at the right level?
- Any unnecessary coupling introduced?
- Will this be easy to extend/modify later?

#### Security
- Input validation on all external data?
- SQL injection / XSS / CSRF vectors?
- Secrets exposed?
- Authorization checks in place?
- New dependencies introduced? Check for known vulnerabilities (→ `../security-awareness/SKILL.md` for deep scan)

#### Performance
- N+1 queries?
- Missing indexes for new queries?
- Unbounded collections?
- Heavy computation in hot paths?

#### Testing
- Are new code paths covered by tests?
- Edge cases tested?
- Integration tests where needed?
- Test quality (not just existence)?

#### Maintainability
- Clear naming and structure?
- Appropriate comments (why, not what)?
- Error handling consistent?
- No dead code added?

#### Database
- Migration files backward-compatible? (→ `../database-ops/SKILL.md` for safety checklist)
- New queries indexed properly?
- Missing `CONCURRENTLY` on index creation (Postgres)?
- Large data migrations handled in batches?
- Down/rollback migration provided?

#### Correctness
- Does the logic match the described intent?
- Race conditions?
- Off-by-one errors?
- Null/undefined handling?

### 3. Provide feedback

## Output Format

```markdown
## Review: PR #<number> / MR !<number> — <title>
**Source:** GitHub / GitLab

### Summary
<2-3 sentences: what this PR/MR does and overall assessment>

### Scores
| Dimension | Score | Notes |
|-----------|-------|-------|
| Architecture | ✅/⚠️/❌ | ... |
| Security | ✅/⚠️/❌ | ... |
| Performance | ✅/⚠️/❌ | ... |
| Database | ✅/⚠️/❌/— | ... |
| Testing | ✅/⚠️/❌ | ... |
| Maintainability | ✅/⚠️/❌ | ... |
| Correctness | ✅/⚠️/❌ | ... |

### Issues Found
1. **[Severity]** <file>:<line> — Description
   Suggestion: ...

2. ...

### Positive Notes
- <What was done well>

### Verdict
🟢 Approve / 🟡 Approve with comments / 🔴 Request changes
```

## Fallback Behavior

- If `glab` is unavailable but `gh` is: review GitHub PRs only. If user requests MR review, say: "GitLab CLI (glab) is not installed. I can only review GitHub PRs. Install glab for MR reviews."
- If `gh` is unavailable but `glab` is: review GitLab MRs only. If user requests PR review, say: "GitHub CLI (gh) is not installed. I can only review GitLab MRs. Install gh for PR reviews."
- If GitLab auth fails: "GitLab authentication failed. Run: glab auth login --hostname <host>"
- If GitHub auth fails: "GitHub authentication failed. Run: gh auth login"
- Always tell the user what data source is missing and how to enable it

## Rules

- Be constructive — suggest fixes, don't just point out problems
- Distinguish blockers (must fix) from nitpicks (nice to fix)
- Acknowledge good practices — positive feedback matters
- Don't bikeshed on style if there's a linter
- Focus on what a linter CAN'T catch: logic, architecture, security
- If the PR/MR is large (>500 lines), review file-by-file and note if it should be split
- Always start with `--stat` — never fetch full diff blindly
- Keep total API calls under 10 per review
- Use platform-appropriate terminology: PR (GitHub), MR (GitLab)