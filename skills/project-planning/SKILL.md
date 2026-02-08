---
name: shipmate-project-planning
description: "Decompose features into tasks, estimate complexity, identify dependencies, and create actionable project plans."
metadata:
  { "openclaw": { "emoji": "📋", "requires": { "bins": ["git"], "anyBins": ["glab", "gh"] } } }
---

# Project Planning

You help teams break down features into implementable tasks.

## When to use

- User asks to plan a feature, epic, or project
- User needs task decomposition or estimation
- User wants to identify dependencies or risks
- User says: "спланируй", "разбей на задачи", "декомпозиция", "оцени сложность"

## Process

### 1. Understand the scope

Ask clarifying questions if needed:
- What is the desired outcome?
- What systems/services are affected?
- Any hard deadlines or constraints?
- Team size and available expertise?

### 2. Analyze the codebase

Before planning, understand what exists. Keep API calls minimal (3-5 total):

```bash
# Repository structure (local, free)
find . -type f \( -name "*.ts" -o -name "*.py" -o -name "*.go" \) | head -50

# Recent activity in affected areas (local, free)
git log --oneline --since="2 weeks ago" -- <affected-paths>

# Open issues/PRs related to the feature
# GitHub:
gh issue list --search "<feature keywords>" --limit 10 --json number,title,state,assignees
gh pr list --search "<feature keywords>" --limit 10 --json number,title,state,author

# GitLab:
glab issue list --search "<feature keywords>" --per-page 10
glab mr list --search "<feature keywords>" --per-page 10

# Jira (if configured):
curl -s -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/search?jql=text~\"<keywords>\"&maxResults=10" | \
  jq '.issues[] | {key, summary: .fields.summary, status: .fields.status.name}'
```

### 3. Decompose into tasks

For each task provide:

| Field | Description |
|-------|-------------|
| **Title** | Clear, actionable (starts with verb) |
| **Type** | feature / bugfix / refactor / infra / docs |
| **Estimate** | S (< 2h) / M (2-8h) / L (1-3d) / XL (3-5d) |
| **Dependencies** | Which tasks must be done first |
| **Affected files** | Key files/modules that will change |
| **Risks** | What could go wrong or take longer |

### 4. Suggest order of execution

- Group tasks into logical phases
- Identify the critical path
- Highlight parallelizable work
- Flag tasks that need early technical decisions

## Output Format

```markdown
## Plan: <Feature Name>

### Overview
<1-2 sentences about what we're building>

### Phase 1: <Phase Name>
| # | Task | Type | Est. | Deps | Risk |
|---|------|------|------|------|------|
| 1 | ... | feature | M | — | Low |
| 2 | ... | feature | L | #1 | Medium |

### Phase 2: <Phase Name>
...

### Critical Path
<Which tasks are on the critical path and why>

### Risks & Mitigations
<Top 3 risks and how to handle them>

### Open Questions
<Decisions that need to be made before starting>
```

## Rules

- Estimates are rough — say so explicitly
- Don't create tasks smaller than S (2h) — they're overhead
- Don't create tasks larger than XL (5d) — they need further decomposition
- Always include a "testing" task for non-trivial features
- Always include a "documentation" task if the feature changes API/behavior
- Always confirm with user before creating tasks in external systems
- Get JIRA_PROJECT_KEY from `data/team-context.md` or ask the user

## Task Creation (Optional)

After the user approves the plan, offer to create tasks in their project tracker.

### Jira (if configured)```bash
# Create epic
curl -s -X POST -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"project":{"key":"<PROJECT_KEY>"},"summary":"<Title>","issuetype":{"name":"Epic"}}}' \
  "$JIRA_BASE_URL/rest/api/3/issue" | jq '.key'# Create story under epic
curl -s -X POST -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"project":{"key":"<PROJECT_KEY>"},"summary":"<Title>","issuetype":{"name":"Story"},"parent":{"key":"<EPIC_KEY>"}}}' \
  "$JIRA_BASE_URL/rest/api/3/issue" | jq '.key'
```

### GitLab (via `glab`)

```bash
glab issue create --title "<Title>" --description "<Description>" --label "story"
glab issue create --title "<Title>" --milestone "<Sprint Name>"
```

### GitHub (via `gh`)

```bash
gh issue create --title "<Title>" --body "<Description>" --label "feature"
gh issue edit <number> --milestone "<Sprint Name>"
```

**Important:** Always ask the user for confirmation before creating tasks. Show the full list first.

## Fallback Behavior

- If Jira is not configured: output plan as markdown. Offer to create GitLab/GitHub issues instead.
- If `glab` is unavailable: skip GitLab, use GitHub or markdown only.
- If `gh` is unavailable: skip GitHub, use GitLab or markdown only.
- If no tracker is available: output a well-formatted markdown plan for manual copy-paste.
- Always tell the user what is available and how to enable missing integrations.