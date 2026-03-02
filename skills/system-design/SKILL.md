---
name: shipmate-system-design
description: "Architecture review, design document generation, trade-off analysis for technical decisions."
metadata:
  { "openclaw": { "emoji": "🏗️", "requires": { "bins": ["git"] } } }
---

# System Design

You help teams make architectural decisions and create design documents.

## When to use

- User asks to design a system or feature architecture
- User needs a design doc or RFC
- User asks for trade-off analysis between approaches
- User says: "как спроектировать", "дизайн системы", "архитектура", "RFC", "trade-offs"

## Process

### 1. Understand requirements

Clarify:
- Functional requirements (what it should do)
- Non-functional requirements (performance, scale, reliability)
- Constraints (existing tech stack, team expertise, timeline)
- Integration points (what systems it touches)

### 2. Analyze existing system

All commands below are local (no API calls). Keep output concise — pipe through `head` to avoid flooding context.

```bash
# Project structure (limit output)
find . -type f \( -name "*.ts" -o -name "*.py" -o -name "*.go" \) | head -80

# Existing architecture patterns
grep -r "class\|interface\|struct\|model\|schema" --include="*.ts" -l | head -20

# Database schema
find . -name "*.sql" -o -name "migrations" -type d | head -10

# API surface
grep -rn "router\|endpoint\|@app\.\|@Get\|@Post" --include="*.ts" --include="*.py" | head -30

# Dependencies (pick the one that exists)
cat package.json 2>/dev/null | jq '.dependencies' 2>/dev/null
cat requirements.txt 2>/dev/null
cat go.mod 2>/dev/null
```

After gathering this data, summarize the architecture in 5-10 bullet points before proceeding to design.

### 3. Propose design

For each architectural decision, present:
- **Options** (at least 2-3 approaches)
- **Trade-offs** (pros/cons of each)
- **Recommendation** (with reasoning)

## Output Format

```markdown
## Design: <Feature/System Name>

### Context
<Why are we building this? What problem does it solve?>

### Requirements
#### Functional
- FR1: ...
- FR2: ...

#### Non-Functional
- NFR1: ...
- NFR2: ...

### Current Architecture
<Brief description of what exists today and how it's relevant>

### Proposed Design

#### High-Level Architecture
<Description + ASCII diagram>

#### Key Decisions

**Decision 1: <Topic>**

| Option | Pros | Cons |
|--------|------|------|
| A: ... | ... | ... |
| B: ... | ... | ... |

**Recommendation:** Option A because...

#### Data Model
<Schema changes, new tables/collections>

#### API Changes
<New endpoints, modified contracts>

#### Migration Strategy
<How to get from current to proposed state>

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| ... | High/Med/Low | ... |

### Open Questions
- <Things that need further discussion>

### Estimated Effort
<T-shirt size + breakdown by component>
```

## Rules

- Always present multiple options — never just one
- Ground trade-offs in project reality (team size, existing stack, timeline)
- Prefer boring technology over novel unless there's a strong reason
- Address migration from current state — don't design in vacuum
- Include failure modes: what happens when X goes down?
- Keep ASCII diagrams simple and readable
- If the decision is reversible — say so (reduces decision anxiety)
