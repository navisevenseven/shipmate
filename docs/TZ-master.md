# TZ-MASTER: ShipMate — Главная техническая спецификация и дорожная карта

**Статус:** Актуально для Phase 1 MVP
**Целевая аудитория:** AI-агент для выполнения
**Версия:** 1.0
**Дата создания:** 2026-02-07

---

## Содержание

1. [Обзор проекта](#обзор-проекта)
2. [Связанные документы](#связанные-документы)
3. [Архитектура реализации](#архитектура-реализации)
4. [Phase 1: MVP (Skills-only)](#phase-1-mvp-skills-only)
5. [Phase 2: TypeScript Plugin](#phase-2-typescript-plugin)
6. [Phase 3: Distribution & Infrastructure](#phase-3-distribution--infrastructure)
7. [Блоки реализации Phase 1](#блоки-реализации-phase-1)
8. [Детализация Skills](#детализация-skills)
9. [Граф зависимостей](#граф-зависимостей)
10. [Открытые вопросы](#открытые-вопросы)
11. [Definition of Done (MVP)](#definition-of-done-mvp)
12. [Реестр рисков](#реестр-рисков)

---

## Обзор проекта

**ShipMate** — открытый AI PM (инженерный менеджер проектов), встроенный в **OpenClaw** (170k+ звёзд, MIT лицензия) как:
- **Skills Pack** (5 специализированных skills)
- **Bootstrap** (настройка, правила, системный prompt)
- **Plugin** (Phase 2+, TypeScript)

### Цель Phase 1
Реализовать полнофункциональный MVP, **без TypeScript плагина**, используя только **CLI-инструменты**:

| Инструмент | Назначение |
|-----------|-----------|
| `glab` | GitLab (MR review, issue tracking) |
| `gh` | GitHub (PR review, issue tracking) |
| `curl` + `jq` | Jira REST API, Confluence |
| `git` | repo management |
| `kubectl` | K8s monitoring, logs |

### Стек сервисов (Phase 1)
- **GitLab** (самохостинг) + GitHub
- **Jira Cloud** + Confluence
- **Sentry** (error tracking)
- **Kubernetes** (deployment)
- **Grafana/Loki** (monitoring & logs)
- **RabbitMQ** (queue)
- **Telegram** + **Slack** (notifications)

---

## Связанные документы

Этот TZ-master **интегрирует и координирует** следующие документы:

| Документ | Назначение | Статус |
|----------|-----------|--------|
| `README.md` | Публичное описание, Quick Start | ✓ Существует |
| `RULES.md` | Правила проекта | ✓ Существует |
| `docs/analysis.md` | Архитектурный анализ (9 секций) | ✓ Существует |
| `docs/security.md` | 3-layer изоляция, threat model | ✓ Существует |
| `docs/TZ-stack-research.md` | Research 30+ сервисов (P0-P2) | ✓ Существует |
| `docs/setup-design.md` | Setup/install/verify design | ✓ Существует |
| `docs/TZ-publishing.md` | Repo publishing, GTM, ClawHub | ➜ В разработке |
| `bootstrap/SOUL.md` | PM personality, rules, security | ✓ Существует |
| `bootstrap/AGENTS.md` | Capabilities, routing, multi-user | ✓ Существует |
| `bootstrap/data/team-context.md` | Team context template | ✓ Существует |
| `skills/shipmate/SKILL.md` | Master skill, routing | ✓ Существует |
| `skills/code-review/SKILL.md` | PR/MR review (stat-first) | ✓ Существует |
| `skills/project-planning/SKILL.md` | Feature decomposition | ✓ Существует |
| `skills/sprint-analytics/SKILL.md` | Sprint progress, Jira integration | ✓ Существует |
| `skills/system-design/SKILL.md` | Architecture review | ✓ Существует |
| `plugin/index.ts` | Plugin placeholder | ➜ Phase 2 |
| `tests/scenarios.md` | 15+ eval test scenarios | ✓ Существует |

---

## Архитектура реализации

### Трёх-фазовый план

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: MVP (Skills-only, CLI, 7-10 дней)                 │
│ - 5 skills (code-review, sprint-analytics, project-planning,│
│   devops, system-design)                                    │
│ - Bootstrap setup (SOUL, AGENTS, team-context)              │
│ - CLI tools: glab, gh, curl+jq, kubectl, git               │
│ - Testing & publishing                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: TypeScript Plugin (2-3 недели)                     │
│ - Custom tools, caching, rate limiting                      │
│ - GraphQL batch queries                                     │
│ - Tool persistence & context management                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Distribution (1-2 недели)                          │
│ - Docker sandbox image                                      │
│ - Railway deployment template                               │
│ - ClawHub listing & community growth                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MVP (Skills-only)

### Временная оценка
- **Total**: 7–10 рабочих дней
- **Setup & Infrastructure**: 1.5–2 дня
- **Skills Implementation**: 3–5 дней (критический блок)
- **Bootstrap Updates**: 0.5 дня
- **Testing**: 1 день
- **Publishing**: 1 день

### Ключевые характеристики Phase 1
✓ Полностью функциональный AI PM для GitLab/GitHub + Jira
✓ K8s мониторинг (kubectl)
✓ Multi-user поддержка (bash persistence)
✓ Graceful degradation (если сервис недоступен)
✓ Команда до 20 человек

### Ограничения Phase 1
✗ Нет TypeScript плагина (только CLI tools)
✗ Нет встроенного кеширования (relies на cache 3rd-party tools)
✗ Нет rate limiting (приложение должно управлять)
✗ Нет Docker sandbox (используется OpenClaw host)

---

## Phase 2: TypeScript Plugin

**Целевой выпуск:** недели 3–5 Phase 1
**Ответственный:** AI agent (guided by analysis.md)

### Задачи
- [ ] Реализовать `plugin/index.ts` с экспортом custom tools
- [ ] LLM tool calling для GitLab GraphQL (mrList, diffViewer)
- [ ] LLM tool calling для Jira GraphQL (issueSearch, sprintBoard)
- [ ] Встроенное кеширование результатов API
- [ ] Rate limiting на основе quotas
- [ ] Batch GraphQL queries для оптимизации

### Выход
**Plugin package** для распространения в ClawHub & npm

---

## Phase 3: Distribution & Infrastructure

**Целевой выпуск:** недели 6–8

### Задачи
- [ ] Docker sandbox image (базирован на node:20-slim)
- [ ] Railway deployment template (`railway.json`)
- [ ] ClawHub listing (metadata, icons, examples)
- [ ] Community posts (HN, r/MachineLearning, Product Hunt)
- [ ] First release (GPG-signed tag, CHECKSUMS.txt)

---

## Блоки реализации Phase 1

### Блок A: Setup & Infrastructure (1.5–2 дня)

**Зависимости:** Нет
**Выход:** Установка, конфигурация, верификация

#### Задачи

- [ ] **A1** Создать `setup/openclaw.json.template`
  - Team stack configuration (GitLab, Jira, etc.)
  - LLM selection (Claude, GPT-4, etc.)
  - Graceful degradation rules
  - Skills metadata (requires.bins, requires.env)

  ```json
  {
    "name": "shipmate",
    "version": "1.0.0",
    "skills": [
      {
        "name": "code-review",
        "requires": {
          "bins": ["glab", "gh"],
          "env": ["GITLAB_TOKEN", "GITHUB_TOKEN"]
        }
      },
      {
        "name": "sprint-analytics",
        "requires": {
          "bins": ["curl", "jq"],
          "env": ["JIRA_TOKEN"]
        }
      }
    ]
  }
  ```

- [ ] **A2** Создать `setup/install.sh`
  - Check / install bins (glab, gh, curl, jq, kubectl, git)
  - Validate tokens (GITLAB_TOKEN, GITHUB_TOKEN, JIRA_TOKEN, etc.)
  - Copy `openclaw.json.template` → `~/.openclaw/shipmate.json`
  - Init skills metadata
  - Exit status: 0 (success) или код ошибки + graceful message

  ```bash
  #!/bin/bash
  # Pseudo-code
  check_bin() { command -v "$1" >/dev/null 2>&1 || return 1; }

  for bin in glab gh curl jq kubectl git; do
    check_bin "$bin" || { install_$bin || exit 1; }
  done

  # Validate tokens
  for token in GITLAB_TOKEN GITHUB_TOKEN JIRA_TOKEN; do
    [[ -z "${!token}" ]] && echo "⚠️ $token not set (optional)" || echo "✓ $token set"
  done

  echo "✓ ShipMate setup complete"
  ```

- [ ] **A3** Создать `setup/verify.sh`
  - Test каждого интегрированного сервиса
  - Report: ✓ (accessible) или ⚠️ (degraded)
  - Skills self-test (code-review --test, sprint-analytics --test, etc.)

  ```bash
  echo "=== ShipMate Verification ==="

  # Test GitLab
  glab mr list -R test-repo >/dev/null 2>&1 && echo "✓ GitLab" || echo "⚠️ GitLab"

  # Test Jira
  curl -s -H "Authorization: Bearer $JIRA_TOKEN" \
    https://jira.company.com/rest/api/3/projects | jq . >/dev/null && \
    echo "✓ Jira" || echo "⚠️ Jira"

  # Test K8s
  kubectl cluster-info >/dev/null 2>&1 && echo "✓ Kubernetes" || echo "⚠️ Kubernetes"
  ```

- [ ] **A4** Обновить skills metadata в каждом `skills/*/SKILL.md`
  - Добавить `requires.bins` section
  - Добавить `requires.env` section
  - Graceful degradation strategy (что делать если бин/сервис недоступен)

---

### Блок B: Skills Implementation (3–5 дней) **[КРИТИЧЕСКИЙ]**

**Зависимости:** Блок A (частично параллельный)
**Выход:** 5 обновленных skills, готовых к Jira/GitLab/K8s

#### B1: code-review skill (обновление)

**Текущее состояние:** GitHub (gh pr)
**Требуемое:** GitHub + GitLab (glab mr)

**Задачи:**

- [ ] **B1.1** Добавить GitLab MR support
  ```bash
  # Определить источник: GitHub PR или GitLab MR?
  if [[ "$1" == "mr:"* ]]; then
    # GitLab MR
    glab mr view "${1#mr:}" --json --stat | jq .
  elif [[ "$1" == "pr:"* ]]; then
    # GitHub PR
    gh pr view "${1#pr:}" --json --stat | jq .
  fi
  ```

- [ ] **B1.2** Унифицировать review статистику
  - Lines changed (additions + deletions)
  - Files changed
  - Commits
  - Review state (approved, changes requested, commented)
  - Conversations (comments, threads)

- [ ] **B1.3** Обновить skill routing в `skills/code-review/SKILL.md`
  - Детектировать платформу автоматически
  - Fallback на GitHub если GitLab недоступен
  - Error handling для auth failures

#### B2: sprint-analytics skill (обновление)

**Текущее состояние:** Шаблон с Jira references
**Требуемое:** Jira REST API (curl+jq) + GitLab + GitHub integration

**Задачи:**

- [ ] **B2.1** Реализовать Jira REST API client (curl+jq)
  ```bash
  # Get current sprint
  curl -s -H "Authorization: Bearer $JIRA_TOKEN" \
    "https://jira.company.com/rest/api/3/board/$BOARD_ID/sprint?state=active" | \
    jq '.values[0] | {id, name, startDate, endDate}'

  # Get sprint issues
  curl -s -H "Authorization: Bearer $JIRA_TOKEN" \
    "https://jira.company.com/rest/api/3/search?jql=sprint=$SPRINT_ID" | \
    jq '.issues[] | {key, summary, status: .fields.status.name, assignee: .fields.assignee.displayName}'
  ```

- [ ] **B2.2** Добавить GitLab issue tracking
  ```bash
  # List issues in project
  glab issue list --project-id $PROJECT_ID --json | jq .

  # Get issue details
  glab issue view $ISSUE_ID --json | jq .
  ```

- [ ] **B2.3** Добавить GitHub issue tracking
  ```bash
  gh issue list --repo $OWNER/$REPO --json assignees,labels,state,updatedAt
  ```

- [ ] **B2.4** Реализовать sprint progress metrics
  - Total points (story points estimate)
  - Completed points
  - In Progress points
  - Remaining points
  - Burn-down calculation
  - Velocity (completed points / sprint days)
  - Risk indicators (overdue issues, blockers)

- [ ] **B2.5** Persistence (сохранение состояния между вызовами)
  - Используя bash файловую систему (`~/.shipmate/cache/`)
  - TTL для cached данных (1 час)
  - Multi-user safe (user-scoped directories)

#### B3: project-planning skill (обновление)

**Текущее состояние:** Шаблон
**Требуемое:** Feature decomposition с Jira/GitLab integration

**Задачи:**

- [ ] **B3.1** Интеграция с Jira
  ```bash
  # Create epic in Jira
  curl -X POST -H "Authorization: Bearer $JIRA_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "fields": {
        "project": {"key": "SHIP"},
        "summary": "Feature: User onboarding",
        "issuetype": {"name": "Epic"}
      }
    }' \
    "https://jira.company.com/rest/api/3/issue"

  # Create story under epic
  curl -X POST -H "Authorization: Bearer $JIRA_TOKEN" \
    -d '{
      "fields": {
        "project": {"key": "SHIP"},
        "summary": "Task: Implement login form",
        "issuetype": {"name": "Story"},
        "parent": {"key": "EPIC-KEY"}
      }
    }' \
    "https://jira.company.com/rest/api/3/issue"
  ```

- [ ] **B3.2** GitLab issues as stories
  ```bash
  # Create issue
  glab issue create --project-id $PROJECT_ID \
    --title "Task: Implement login form" \
    --description "..." \
    --labels "story"
  ```

- [ ] **B3.3** Feature decomposition algorithm
  - Input: Feature description (text)
  - Output: Epic + Stories + Tasks hierarchy
  - Estimation (story points)
  - Dependencies (blocked by, blocks)
  - Acceptance criteria

#### B4: devops skill (новый)

**Статус:** Нет (требует создания)
**Назначение:** K8s monitoring, logs, rollouts

**Задачи:**

- [ ] **B4.1** Создать `skills/devops/SKILL.md`
  ```markdown
  # DevOps Skill

  ## Overview
  K8s cluster monitoring, debugging, deployment management.

  ## Commands
  - `devops pods`: List pods
  - `devops logs POD_NAME`: Get pod logs
  - `devops restart DEPLOYMENT`: Rollout restart
  - `devops status`: Cluster health
  ```

- [ ] **B4.2** Реализовать kubectl commands
  ```bash
  # devops pods
  kubectl get pods -o json | jq '.items[] | {name: .metadata.name, status: .status.phase}'

  # devops logs POD_NAME
  kubectl logs $POD_NAME --tail 100 --timestamps

  # devops restart DEPLOYMENT
  kubectl rollout restart deployment/$DEPLOYMENT
  kubectl rollout status deployment/$DEPLOYMENT

  # devops status
  kubectl cluster-info
  kubectl get nodes -o wide
  ```

- [ ] **B4.3** Graceful degradation (если K8s недоступен)
  - Return: "K8s cluster not accessible (KUBECONFIG not set?)"
  - Suggestion: "Set KUBECONFIG env or run 'kubectl config set-context'"

#### B5: system-design skill (проверка)

**Текущее состояние:** Реализован
**Требуемое:** Проверить совместимость с architecture review scope (no changes needed for MVP)

- [ ] **B5.1** Verify skill documentation matches MVP requirements
- [ ] **B5.2** Test error handling for missing architecture docs

---

### Блок C: Bootstrap Updates (0.5 дня)

**Зависимости:** Блок A (setup metadata)
**Выход:** Обновленные SOUL.md, AGENTS.md, team-context.md

#### C1: SOUL.md updates

- [ ] **C1.1** Добавить GitLab/Jira/K8s personality rules
  ```markdown
  ## Platform-Specific Personality

  ### For GitLab reviews
  - Be thorough with diffs
  - Suggest refactoring if patterns emerge
  - Respect GitLab-specific conventions (!merge, ~labels)

  ### For Jira sprint management
  - Track burndown carefully
  - Alert on blockers immediately
  - Respect velocity trends

  ### For K8s operations
  - Always verify cluster state before suggesting changes
  - Report pod health explicitly
  - Suggest resource limits if needed
  ```

- [ ] **C1.2** Обновить group chat rules (if multiple tools active)
  - Tool selection logic (when to use code-review vs sprint-analytics?)
  - Context sharing between skills
  - Error escalation (who to ping if tool fails?)

#### C2: AGENTS.md updates

- [ ] **C2.1** Добавить GitLab, Jira, K8s to capabilities table
  ```markdown
  | Capability | Tools | Details |
  |-----------|-------|---------|
  | Code Review | glab (MR), gh (PR) | Lines, files, conversations |
  | Sprint Analytics | curl+jq (Jira) | Burndown, velocity, blockers |
  | Project Planning | glab issues, Jira epics | Hierarchy, estimation |
  | DevOps | kubectl | Pods, logs, rollouts |
  | System Design | (analysis only) | No external tools needed |
  ```

- [ ] **C2.2** Обновить routing table
  ```markdown
  ## Skill Routing

  - User input contains "review" → `code-review` skill
  - User input contains "sprint" or "velocity" → `sprint-analytics` skill
  - User input contains "epic" or "task" → `project-planning` skill
  - User input contains "pod", "log", or "restart" → `devops` skill
  - User input contains "architecture" → `system-design` skill
  ```

- [ ] **C2.3** Добавить multi-user rules
  - User context (in AGENTS.md)
  - Team size limits (up to 20 users for Phase 1)
  - Context isolation (user A cannot see user B's data)

#### C3: team-context.md updates

- [ ] **C3.1** Добавить поля для новых сервисов
  ```markdown
  # Team Context Template

  ## Infrastructure
  - **GitLab Project IDs**: [list]
  - **GitHub Repos**: [owner/repo list]
  - **Jira Board ID**: [board-id]
  - **Jira Project Key**: [KEY]
  - **K8s Cluster**: [cluster-name]
  - **K8s Namespaces**: [list]
  ```

- [ ] **C3.2** Добавить примеры для каждого сервиса

---

### Блок D: Testing (1 день)

**Зависимости:** Блок B (skills ready)
**Выход:** Test scenarios passing, test workspace configured

#### D1: Unit & Integration tests

- [ ] **D1.1** Обновить `tests/scenarios.md` с GitLab MR test scenarios
  ```markdown
  ## Test: code-review / GitLab MR

  **Trigger:** "Review MR !123 in projects/shipmate"
  **Expected Output:**
  - Lines changed: X
  - Files changed: Y
  - Suggestions: [...]
  - Approval status: [...]
  ```

- [ ] **D1.2** Добавить Jira integration test scenarios
  ```markdown
  ## Test: sprint-analytics / Jira

  **Trigger:** "What's our sprint progress?"
  **Expected Output:**
  - Sprint name
  - Total points
  - Completed points
  - Burndown chart
  - Blockers (if any)
  ```

- [ ] **D1.3** Добавить K8s/DevOps test scenarios
  ```markdown
  ## Test: devops / K8s

  **Trigger:** "Show me pod status"
  **Expected Output:**
  - Pod list (name, status, ready replicas)
  - Any warnings (crashed pods, pending)
  - Suggested actions
  ```

#### D2: Integration test workspace

- [ ] **D2.1** Создать test GitLab project (self-hosted)
  - Sample MR with code changes
  - Conversations/comments
  - Labels, milestones

- [ ] **D2.2** Создать test GitHub repo
  - Sample PR
  - Conversations

- [ ] **D2.3** Создать test Jira board
  - Sample epic + stories
  - Current sprint with issues
  - Velocity history

- [ ] **D2.4** Создать test K8s namespace
  - Sample deployment (nginx)
  - Sample service
  - Rolling updates

#### D3: Execution

- [ ] **D3.1** Run `setup/verify.sh` against test workspace
- [ ] **D3.2** Execute each skill test scenario from `tests/scenarios.md`
- [ ] **D3.3** Document results (pass/fail/known issues)

---

### Блок E: Publishing (1 день)

**Зависимости:** Все блоки (A–D) complete
**Выход:** Public GitHub repo, first release, ClawHub listing

#### E1: Repository setup

- [ ] **E1.1** Инициализировать GitHub repo
  ```bash
  git init
  git add .
  git config user.signingkey $GPG_KEY
  git commit -S -m "Initial commit: ShipMate MVP Phase 1"
  ```

- [ ] **E1.2** Создать standard GitHub files
  - `LICENSE` (MIT)
  - `CONTRIBUTING.md`
  - `.github/ISSUE_TEMPLATE/bug.md`
  - `.github/ISSUE_TEMPLATE/feature.md`
  - `.github/workflows/ci.yml` (if needed)

- [ ] **E1.3** Обновить `README.md`
  - Quick start section
  - Feature overview
  - Links to docs
  - Contributing instructions

#### E2: First release

- [ ] **E2.1** Создать GPG-signed tag
  ```bash
  git tag -s v1.0.0 -m "ShipMate MVP Phase 1"
  git push origin v1.0.0
  ```

- [ ] **E2.2** Создать CHECKSUMS.txt
  ```
  sha256sum shipmate-1.0.0.tar.gz > CHECKSUMS.txt
  gpg --armor --detach-sign CHECKSUMS.txt
  ```

- [ ] **E2.3** Create GitHub Release
  - Changelog
  - Installation instructions
  - Known limitations
  - Attach CHECKSUMS.txt.asc

#### E3: ClawHub listing (TZ-publishing.md reference)

- [ ] **E3.1** Подготовить metadata для ClawHub
  - Project name, description
  - Category (DevOps, PM, Code Review)
  - Screenshots/demo GIF
  - Installation command

- [ ] **E3.2** Submit to ClawHub registry

#### E4: Community posts

- [ ] **E4.1** Post на Hacker News (Show HN)
- [ ] **E4.2** Post на r/MachineLearning, r/devops
- [ ] **E4.3** Post на Product Hunt (if applicable)

---

## Детализация Skills

### Таблица: Skills Mapping для Phase 1

| Skill | Status | GitLab | GitHub | Jira | K8s | Graceful Degradation |
|-------|--------|--------|--------|------|-----|----------------------|
| code-review | ✓ Существует | ➜ Обновить | ✓ Готово | ✗ N/A | ✗ N/A | Fallback на GitHub |
| sprint-analytics | ✓ Шаблон | ➜ Обновить | ➜ Обновить | ➜ Реализовать | ✗ N/A | Skip если Jira down |
| project-planning | ✓ Шаблон | ➜ Обновить | ✓ Готово | ➜ Обновить | ✗ N/A | Local decomposition |
| devops | ✗ Новый | ✗ N/A | ✗ N/A | ✗ N/A | ➜ Создать | Skip если K8s down |
| system-design | ✓ Готово | ✗ N/A | ✗ N/A | ✗ N/A | ✗ N/A | N/A (no external) |

### Skill: code-review

**Файл:** `skills/code-review/SKILL.md`

**Входные данные:**
- PR/MR identifier (e.g., "pr:123" или "mr:456")
- Optional: focus areas (security, performance, style)

**Выходные данные:**
```json
{
  "source": "github|gitlab",
  "id": "123",
  "title": "Add user authentication",
  "author": "john.doe",
  "lines_changed": 234,
  "files_changed": 5,
  "commits": 8,
  "review": {
    "summary": "Good changes, consider refactoring...",
    "suggestions": [
      {"file": "auth.js", "line": 42, "comment": "..."}
    ],
    "risk_level": "low|medium|high",
    "approval": "approved|changes_requested|pending"
  }
}
```

**CLI вызов:**
```bash
# Generic entry point
shipmate code-review "mr:projects/shipmate/merge_requests/123"
shipmate code-review "pr:owner/repo/123"

# Optional parameters
shipmate code-review "pr:owner/repo/123" --focus security
shipmate code-review "mr:..." --focus performance
```

---

### Skill: sprint-analytics

**Файл:** `skills/sprint-analytics/SKILL.md`

**Входные данные:**
- Sprint identifier (current, by name, or by ID)
- Optional: metrics focus (velocity, burndown, blockers)

**Выходные данные:**
```json
{
  "sprint": {
    "name": "Sprint 15",
    "start_date": "2026-02-07",
    "end_date": "2026-02-21",
    "days_remaining": 10
  },
  "progress": {
    "total_points": 40,
    "completed_points": 15,
    "in_progress_points": 15,
    "remaining_points": 10,
    "completion_percent": 37.5
  },
  "metrics": {
    "velocity": 13.5,
    "burndown": [13, 12, 15, 14, 15],
    "trend": "on_track|at_risk|behind"
  },
  "issues": {
    "blockers": [
      {"key": "SHIP-42", "title": "...", "blocked_by": "SHIP-41"}
    ],
    "overdue": [
      {"key": "SHIP-50", "due": "2026-02-06"}
    ]
  }
}
```

**CLI вызов:**
```bash
shipmate sprint-analytics --sprint current
shipmate sprint-analytics --sprint "Sprint 15"
shipmate sprint-analytics --metrics burndown
shipmate sprint-analytics --metrics blockers
```

---

### Skill: project-planning

**Файл:** `skills/project-planning/SKILL.md`

**Входные данные:**
- Feature description (text)
- Optional: epic name, team context

**Выходные данные:**
```json
{
  "epic": {
    "key": "SHIP-100",
    "title": "User Onboarding",
    "description": "...",
    "estimated_points": 34
  },
  "stories": [
    {
      "key": "SHIP-101",
      "title": "Implement login form",
      "points": 8,
      "tasks": [
        {"title": "Design UI", "points": 3},
        {"title": "Implement backend", "points": 5}
      ],
      "acceptance_criteria": ["...", "..."],
      "dependencies": []
    }
  ],
  "timeline": {
    "estimated_sprints": 2,
    "critical_path": ["SHIP-101", "SHIP-102"]
  }
}
```

**CLI вызов:**
```bash
shipmate project-planning "Add 2FA authentication"
shipmate project-planning "Mobile app redesign" --epic "Frontend Phase 2"
```

---

### Skill: devops

**Файл:** `skills/devops/SKILL.md`

**Входные данные:**
- Command (pods, logs, restart, status)
- Optional: namespace, pod name, deployment name

**Выходные данные (для `pods`):**
```json
{
  "namespace": "production",
  "pods": [
    {
      "name": "shipmate-api-0",
      "status": "Running",
      "ready_replicas": 1,
      "total_replicas": 1,
      "age": "5d",
      "restarts": 0
    }
  ],
  "warnings": []
}
```

**CLI вызов:**
```bash
shipmate devops pods
shipmate devops pods --namespace staging
shipmate devops logs shipmate-api-0
shipmate devops logs shipmate-api-0 --tail 50
shipmate devops restart shipmate-api
shipmate devops status
```

---

### Skill: system-design

**Файл:** `skills/system-design/SKILL.md`

**Статус:** Полностью готово, no changes needed for Phase 1

**Входные данные:**
- Architecture description or existing architecture docs

**Выходные данные:**
- Review with suggestions, risk assessment, scalability notes

---

## Граф зависимостей

```
┌─────────────────────────────────────────────────────────────┐
│ Блок A: Setup & Infrastructure (1.5–2 дня)                 │
│ - openclaw.json.template                                     │
│ - install.sh, verify.sh                                      │
│ - Skills metadata (requires.bins, requires.env)              │
└─────────────────────────────────────────────────────────────┘
         ↓
         ├─→ Блок B: Skills Implementation (3–5 дней, параллельно)
         │   ├─ B1: code-review (GitHub + GitLab)
         │   ├─ B2: sprint-analytics (Jira + GitLab + GitHub)
         │   ├─ B3: project-planning (Jira + GitLab)
         │   ├─ B4: devops (kubectl)
         │   └─ B5: system-design (verify)
         │
         ├─→ Блок C: Bootstrap Updates (0.5 дня)
         │   ├─ C1: SOUL.md
         │   ├─ C2: AGENTS.md
         │   └─ C3: team-context.md
         │
         └─→ Блок D: Testing (1 день, после B)
             ├─ D1: Update test scenarios
             ├─ D2: Setup test workspace
             └─ D3: Execute tests

         ↓

┌─────────────────────────────────────────────────────────────┐
│ Блок E: Publishing (1 день, после D)                        │
│ - GitHub repo setup                                          │
│ - First release (GPG-signed)                                 │
│ - ClawHub listing                                            │
│ - Community posts                                            │
└─────────────────────────────────────────────────────────────┘
```

**Параллелизм:**
- Блоки B и C могут выполняться параллельно (зависят от A)
- Блок D зависит от B
- Блок E зависит от D

**Critical path:**
A → B2 (sprint-analytics, самый сложный) → D → E
**Total: 7–10 дней**

---

## Открытые вопросы

Из `docs/analysis.md` и other docs:

### 1. Организация репозитория

**Вопрос:** Mono-repo или multi-repo?

**Опции:**
- **Mono-repo** (recommended):
  - Single `shipmate/` repo
  - Subdirs: `skills/`, `bootstrap/`, `plugin/`, `tests/`, `docs/`, `setup/`
  - Единая версиoнность
  - Проще управлять dependencies

- **Multi-repo:**
  - `shipmate-skills/`, `shipmate-plugin/`, `shipmate-bootstrap/`
  - Independent versions
  - Сложнее для скоординированных updates

**Decision for Phase 1:** Mono-repo (simpler for initial release)

### 2. Лицензирование

**Вопрос:** Финализирована ли MIT лицензия?

**Статус:** ✓ Предусмотрено в RULES.md

**Требуемо для E1.2:**
- `LICENSE` file (MIT text)
- SPDX headers in code files (if any)

### 3. Многоязычность

**Вопрос:** Нужна ли поддержка языков кроме английского?

**Phase 1:** English only (docs, error messages)
**Phase 2:** Consider i18n if demand

### 4. Версиoнирование skills

**Вопрос:** Как версионировать отдельные skills?

**Ответ:** SemVer для shipmate package, skills versioned together
Пример: `shipmate@1.0.0` включает все skills v1.0.0

### 5. Plugin vs. Skills trade-offs

**Вопрос:** Зачем Phase 2 plugin если Phase 1 skills достаточно?

**Ответ:**
- Phase 1 skills = максимальная совместимость (только CLI)
- Phase 2 plugin = оптимизация (caching, rate limiting, GraphQL)
- Plugin опциональный (для high-load сценариев)

---

## Definition of Done (MVP)

### Критерии завершения Phase 1

#### Функциональность
- [ ] **Code Review**
  - ✓ GitHub PR review (с stat'ями)
  - ✓ GitLab MR review (с stat'ями)
  - ✓ Suggestions, risk levels

- [ ] **Sprint Analytics**
  - ✓ Jira sprint progress (points, burndown)
  - ✓ Velocity metrics
  - ✓ Blocker detection
  - ✓ GitLab issues tracking
  - ✓ GitHub issues tracking

- [ ] **Project Planning**
  - ✓ Feature decomposition (epic → stories → tasks)
  - ✓ Jira epic/story creation
  - ✓ Estimation
  - ✓ Dependencies

- [ ] **DevOps**
  - ✓ Pod listing
  - ✓ Log retrieval
  - ✓ Deployment restart
  - ✓ Cluster status

- [ ] **System Design**
  - ✓ Architecture review
  - ✓ Scalability analysis

#### Infrastructure
- [ ] **Setup & Install**
  - ✓ `openclaw.json.template` complete
  - ✓ `install.sh` installs all bins
  - ✓ `verify.sh` tests all integrations
  - ✓ Graceful degradation works

- [ ] **Bootstrap**
  - ✓ `SOUL.md` updated (GitLab, Jira, K8s rules)
  - ✓ `AGENTS.md` updated (routing, capabilities)
  - ✓ `team-context.md` updated (new service fields)

#### Quality
- [ ] **Testing**
  - ✓ All 15+ test scenarios passing
  - ✓ Integration tests (real GitLab, Jira, K8s)
  - ✓ Error handling verified
  - ✓ Graceful degradation tested

- [ ] **Documentation**
  - ✓ README.md (quick start, features, setup)
  - ✓ All docs updated (analysis, security, setup)
  - ✓ Skills inline documentation (CLI help)
  - ✓ Examples in `tests/scenarios.md`

#### Publishing
- [ ] **Release**
  - ✓ GitHub repo public
  - ✓ v1.0.0 tag (GPG-signed)
  - ✓ CHECKSUMS.txt.asc
  - ✓ License file (MIT)

- [ ] **Community**
  - ✓ ClawHub listing
  - ✓ Community posts (HN, Reddit, etc.)
  - ✓ CONTRIBUTING.md
  - ✓ Issue templates

#### Performance & Security (baseline)
- [ ] **Performance**
  - ✓ code-review < 5 sec per PR/MR (with API limits)
  - ✓ sprint-analytics < 10 sec (caching if possible)
  - ✓ devops pods < 3 sec

- [ ] **Security**
  - ✓ No hardcoded tokens (use env vars)
  - ✓ HTTPS for API calls
  - ✓ Multi-user context isolation
  - ✓ Token validation on install

---

## Реестр рисков

| ID | Риск | Вероятность | Воздействие | Стратегия митигации |
|----|------|------------|-------------|-------------------|
| R1 | GitLab/Jira API rate limiting | Medium | High | Implement caching (Phase 2 plugin) |
| R2 | Unstable test K8s cluster | Medium | Medium | Use kind/minikube as fallback |
| R3 | Multi-language support pressure | Low | Low | Defer to Phase 2 |
| R4 | Community adoption slow | Medium | Medium | Active marketing, HN, Reddit posts |
| R5 | Security vulnerabilities in deps | Low | High | Regular audits, pin versions, CONTRIBUTING.md |
| R6 | Integration bugs (GitLab-Jira) | High | Medium | Extensive testing block (D1) |
| R7 | Token expiration during setup | Medium | Medium | Validate tokens in install.sh, clear instructions |
| R8 | Plugin Phase 2 slips | Medium | Medium | Timeline buffer, async development |

### Mitigation Actions

**Для R1 (Rate Limiting):**
- [ ] Документировать API limits в `docs/` (каждого сервиса)
- [ ] Фаза 1: Manual queuing (дождаться между запросами)
- [ ] Фаза 2: Plugin с встроенным caching

**Для R6 (Integration Bugs):**
- [ ] Block D (Testing) очень тщательно
- [ ] Real test workspace с real данными
- [ ] Каждый skill должен пройти >3 test scenarios

**Для R4 (Adoption):**
- [ ] Post в HN (Show HN: ShipMate — AI PM built on OpenClaw)
- [ ] r/devops, r/MachineLearning
- [ ] Product Hunt (если suitable)
- [ ] Twitter/LinkedIn announcement

---

## Чеклист выполнения

### Phase 1 Progress

```
BLOCK A: Setup & Infrastructure
├─ [ ] A1: openclaw.json.template
├─ [ ] A2: install.sh
├─ [ ] A3: verify.sh
└─ [ ] A4: Skills metadata (requires.bins, requires.env)

BLOCK B: Skills Implementation
├─ [ ] B1: code-review (GitLab + GitHub)
├─ [ ] B2: sprint-analytics (Jira + GitLab + GitHub)
├─ [ ] B3: project-planning (Jira + GitLab)
├─ [ ] B4: devops (kubectl)
└─ [ ] B5: system-design (verify)

BLOCK C: Bootstrap Updates
├─ [ ] C1: SOUL.md (GitLab, Jira, K8s rules)
├─ [ ] C2: AGENTS.md (routing, capabilities)
└─ [ ] C3: team-context.md (new fields)

BLOCK D: Testing
├─ [ ] D1: Update test scenarios
├─ [ ] D2: Setup test workspace
└─ [ ] D3: Execute & document results

BLOCK E: Publishing
├─ [ ] E1: GitHub repo + standard files
├─ [ ] E2: v1.0.0 release (GPG-signed)
├─ [ ] E3: ClawHub listing
└─ [ ] E4: Community posts

DEFINITION OF DONE
├─ [ ] All functionality complete
├─ [ ] All tests passing
├─ [ ] Documentation complete
├─ [ ] Security baseline met
└─ [ ] Published & discoverable
```

---

## Ссылки на связанные документы

**Setup & Design:**
- [docs/setup-design.md](../setup-design.md)

**Architecture & Analysis:**
- [docs/analysis.md](../analysis.md)
- [docs/security.md](../security.md)
- [docs/TZ-stack-research.md](../TZ-stack-research.md)

**Publishing & Distribution:**
- [docs/TZ-publishing.md](../TZ-publishing.md)

**Bootstrap & Skills:**
- [bootstrap/SOUL.md](../../bootstrap/SOUL.md)
- [bootstrap/AGENTS.md](../../bootstrap/AGENTS.md)
- [bootstrap/data/team-context.md](../../bootstrap/data/team-context.md)
- [skills/shipmate/SKILL.md](../../skills/shipmate/SKILL.md)
- [skills/code-review/SKILL.md](../../skills/code-review/SKILL.md)
- [skills/sprint-analytics/SKILL.md](../../skills/sprint-analytics/SKILL.md)
- [skills/project-planning/SKILL.md](../../skills/project-planning/SKILL.md)
- [skills/system-design/SKILL.md](../../skills/system-design/SKILL.md)

**Testing & Scenarios:**
- [tests/scenarios.md](../../tests/scenarios.md)

**Project Rules & README:**
- [README.md](../../README.md)
- [RULES.md](../../RULES.md)

---

## Version History

| Версия | Дата | Автор | Изменения |
|--------|------|-------|-----------|
| 1.0 | 2026-02-07 | AI Agent | Initial TZ-master for Phase 1 MVP |

---

## Contacts & Escalation

**For questions on this document:**
- Review `docs/TZ-publishing.md` for process
- Check `docs/analysis.md` for architecture decisions
- Consult `RULES.md` for project governance

---

**Status: READY FOR PHASE 1 EXECUTION**

Last updated: 2026-02-07
