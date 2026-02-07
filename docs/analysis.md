# ShipMate — Анализ архитектуры и план развития

> Контекст для дальнейших итераций. Составлен на основе исследования OpenClaw v2026.2.3.

---

## 1. Исследование OpenClaw

### 1.1 Архитектура платформы

OpenClaw — open-source self-hosted AI assistant gateway (170k+ stars, MIT license).

**Ключевые компоненты:**

| Компонент | Описание |
|-----------|----------|
| **Gateway** | Node.js WebSocket-сервер, контрольная плоскость. Управляет сессиями, каналами, инструментами, событиями |
| **Agent Runtime** | Pi Agent Core (`@mariozechner/pi-agent-core`). LLM + tools + workspace в RPC-режиме |
| **Channels** | 15+ мессенджеров: Telegram (grammY), WhatsApp (Baileys), Slack (Bolt), Discord (discord.js), Teams, Signal, iMessage, Matrix, Google Chat, WebChat и др. |
| **Tools** | Встроенные: `read`, `write`, `edit`, `exec/bash`, `process`, `browser`, `canvas`, `cron`, `nodes`. Кастомные через plugins |
| **Skills** | AgentSkills-compatible SKILL.md файлы. Загружаются из 3 мест (workspace > managed > bundled). Инжектятся в system prompt |
| **Plugins** | TypeScript модули. Формат: `openclaw.plugin.json` + entrypoint. Регистрируют custom tools через `api.registerTool()` |
| **Bootstrap** | Файлы контекста: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `USER.md`, `IDENTITY.md`, `HEARTBEAT.md`. Инжектятся в каждую сессию |

### 1.2 Как работает система Skills

**Формат:**
```markdown
---
name: skill-name
description: When to use this skill
metadata:
  { "openclaw": { "emoji": "🔧", "requires": { "bins": ["gh"], "env": ["GITHUB_TOKEN"] } } }
---

# Skill Instructions

Инструкции для LLM как использовать этот skill...
```

**Загрузка (приоритет):**
1. `<workspace>/skills/` — высший приоритет
2. `~/.openclaw/skills/` — managed/local
3. Bundled skills (npm package) — низший приоритет
4. `skills.load.extraDirs` — дополнительные директории (низший)

**Gating (фильтрация при загрузке):**
- `requires.bins` — проверка наличия бинарников на PATH
- `requires.anyBins` — хотя бы один из списка
- `requires.env` — проверка env-переменных
- `requires.config` — проверка ключей в openclaw.json
- `os` — фильтр по ОС

**Инжекция в prompt:**
- При старте сессии OpenClaw собирает eligible skills
- Формирует XML-список `<available_skills>` с name/description/location
- LLM читает SKILL.md через `read` tool по указанному пути
- ~97 chars + name/desc на каждый skill в system prompt

### 1.3 Как работают Plugins

**Структура:**
```
extension-name/
├── openclaw.plugin.json    # Манифест
├── index.ts                # Entry point
├── tools/                  # Custom tools
└── package.json
```

**Манифест:**
```json
{
  "id": "plugin-name",
  "name": "Plugin Name",
  "version": "0.1.0",
  "description": "What it does",
  "entrypoint": "./index.ts"
}
```

**Регистрация tools:**
```typescript
export default function register(api) {
  api.registerTool({
    name: "tool_name",
    description: "What the tool does",
    parameters: { /* JSON Schema */ },
    handler: async (params, ctx) => {
      // Implementation
      return result;
    },
  });
}
```

**Размещение:**
- Локально: `~/.openclaw/extensions/`
- Railway: `/data/workspace/.openclaw/extensions/`
- В workspace: `.openclaw/extensions/`

### 1.4 System Prompt

OpenClaw собирает system prompt из фиксированных секций:
1. **Tooling** — список tools + описания
2. **Safety** — guardrails
3. **Skills** — XML-список available skills
4. **Workspace** — путь к workspace
5. **Documentation** — путь к docs OpenClaw
6. **Workspace Files** — инжектированные bootstrap файлы
7. **Sandbox** — если включён
8. **Current Date & Time**
9. **Heartbeats** — prompt для heartbeat
10. **Runtime** — host, OS, model, repo root

**Prompt modes:**
- `full` — всё для основной сессии
- `minimal` — для sub-agents (без skills, heartbeats и т.д.)
- `none` — только identity

### 1.5 Существующие Skills (53 bundled)

Все existing skills — general-purpose:
- Медиа: `peekaboo` (камера), `sag` (TTS), `openai-whisper` (STT), `openai-image-gen`, `gemini`
- Продуктивность: `obsidian`, `notion`, `bear-notes`, `apple-notes`, `apple-reminders`, `things-mac`, `trello`
- Развлечения: `spotify-player`, `gifgrep`
- Умный дом: `openhue`, `sonoscli`
- DevOps: `github` (только gh CLI wrapper), `coding-agent` (bash wrapper для Codex/Claude Code)
- Утилиты: `weather`, `local-places`, `summarize`, `model-usage`, `healthcheck`, `session-logs`
- Система: `tmux`, `skill-creator`, `clawhub`, `mcporter`

**Ключевой вывод:** Нет ни одного skill pack для project management / software engineering workflow. `coding-agent` — просто обёртка для запуска внешних coding agents. `github` — обёртка для `gh` CLI. Ниша полностью свободна.

---

## 2. Концепция ShipMate

### 2.1 Позиционирование

**Что:** Open-source AI PM для команд разработки
**Как:** Skills pack + plugin для OpenClaw
**Для кого:** Dev teams (2-20 человек) которые уже используют GitHub, Jira/Linear, CI/CD
**Где живёт:** В командном чате (Telegram/Slack/Discord) как участник команды

### 2.2 Ключевое отличие от general-purpose ассистента

General-purpose LLM (включая OpenClaw из коробки) умеет "помогать с кодом". Но не умеет:
- **Думать в терминах спринтов** — понимать velocity, scope creep, blocker chains
- **Анализировать команду** — кто перегружен, кто эксперт в чём, кто давно не делал ревью
- **Трекать прогресс** — не просто "сколько задач закрыто", а "успеваем ли к дедлайну с текущей velocity"
- **Принимать PM-решения** — предлагать перераспределение, эскалировать риски, предлагать scope cut
- **Создавать артефакты PM** — design docs с trade-off analysis, sprint reports, retro summaries

ShipMate заполняет этот gap через специализированные skills (domain knowledge) + plugin (data integrations).

### 2.3 Архитектура

```
┌─────────────────────────────────────────┐
│              OpenClaw Gateway            │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         ShipMate Skills          │   │
│  │                                  │   │
│  │  project-planning    code-review │   │
│  │  system-design    test-strategy  │   │
│  │  sprint-analytics      devops    │   │
│  │  task-assignment  team-insights  │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         ShipMate Plugin          │   │
│  │                                  │   │
│  │  GitHub Analytics  Sprint Metrics│   │
│  │  Task Router    Code Quality     │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │       Bootstrap (SOUL/AGENTS)    │   │
│  │   PM Personality + Team Rules    │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
          │            │           │
    ┌─────┘    ┌───────┘    ┌──────┘
    ▼          ▼            ▼
  GitHub    Jira/Linear    CI/CD
```

**Три слоя:**

1. **Skills (мозг)** — SKILL.md файлы, которые учат LLM *как думать* о PM-задачах. Чистый markdown, zero code, работает с любым OpenClaw
2. **Plugin (руки)** — TypeScript tools, которые дают LLM доступ к *данным*. GitHub API, Jira API, git analytics
3. **Bootstrap (личность)** — SOUL.md/AGENTS.md шаблоны, которые задают *поведение*. "Ты не generic ассистент, ты engineering PM"

---

## 3. MVP Plan

### 3.1 Фаза 1: Skills Only — MVP (определено)

SKILL.md файлы + bootstrap, работающие **без plugin**. LLM использует встроенные OpenClaw tools (`bash`, `read`, `write`) и CLI (`gh`, `git`, `jq`).

**Core Skills (4 штуки):**

| Skill | Что делает | Инструменты | Приоритет |
|-------|-----------|-------------|-----------|
| `code-review` | PR review: архитектура, безопасность, тесты. Multi-step для больших PR (stat-first, file-by-file) | `gh pr view/diff/checks` | P0 |
| `project-planning` | Декомпозиция фичи в задачи + оценка | `gh issue list`, `git log`, file read | P0 |
| `sprint-analytics` | Прогресс: PRs merged, issues closed, velocity. Persistence через memory/ | `gh pr list`, `gh issue list`, `git shortlog` | P1 |
| `system-design` | Design doc, architecture review | file read/write, `git log` | P1 |

**Master skill:** `shipmate` — routing, context management rules, API efficiency guidelines.

**Bootstrap (2 файла):**
- `SOUL.md` — PM personality + security mindset + group chat behavior + memory rules
- `AGENTS.md` — capabilities, restrictions, multi-user rules, memory/persistence, project isolation

**Integrations (Phase 1 = GitHub only):**
- **GitHub CLI (`gh`)** — единственная обязательная зависимость
- **Git** — для commit analytics и file churn
- Jira/Linear/Notion — отложено на Phase 2

**Не входит в MVP:**
- Plugin (custom tools) — Phase 2
- Jira/Linear интеграции — Phase 2
- Task assignment / team insights — Phase 2
- Docker sandbox image — Phase 3
- Railway template — Phase 3
- ClawHub публикация — Phase 3

**Почему skills-first:**
- Zero deployment — просто копируешь файлы в workspace
- Быстрая итерация — правишь markdown, перезапускаешь сессию
- Сразу тестируется на любом OpenClaw инстансе
- Можно проверить все архитектурные гипотезы до написания кода

### 3.2 Фаза 2: Plugin (custom tools)

Когда skills-only упираются в ограничения CLI (скорость, rate limits, rich data), создаём plugin:

**Planned tools:**
- `github_pr_review(pr_number)` — полный контекст PR через GraphQL (1 call = 3-5 REST calls)
- `github_team_stats(period)` — contribution patterns, review load, PR throughput
- `sprint_metrics(sprint_id?)` — aggregated metrics из GitHub/Jira

**Caching layer:**
- In-memory cache с TTL (PR metadata: 5 min, diffs: 15 min, stats: 30 min)
- Rate limiter: 30 tool calls/min per session
- GraphQL batch requests для снижения API usage

### 3.3 Фаза 3: Distribution + Infrastructure

- Docker sandbox image с `gh`, `git`, `jq`
- Railway template для one-click deploy
- GitHub releases (primary) + ClawHub (secondary, для discoverability)
- GPG-signed tags + CHECKSUMS.txt

---

## 4. Target Integrations

### Must Have (Фаза 1-2)
- **GitHub** — PRs, Issues, Actions, git history, code search
- **Git** — commit analytics, file churn, branch management

### Should Have (Фаза 2-3)
- **Jira** — sprints, boards, backlogs, estimation
- **Linear** — alternative to Jira
- **Slack/Telegram/Discord** — уже через OpenClaw channels

### Nice to Have (Фаза 3+)
- **Notion** — documentation, wikis
- **Figma** — design handoff
- **Sentry** — error tracking, production issues
- **Datadog/Grafana** — observability
- **SonarQube** — code quality metrics
- **Confluence** — wiki/docs

---

## 5. Конкурентный ландшафт

| Продукт | Тип | Отличие от ShipMate |
|---------|-----|---------------------|
| **GitHub Copilot** | Code completion | Только код, не PM |
| **Cursor / Windsurf** | AI IDE | Локальный, не team-wide |
| **Linear AI** | Built-in AI | Vendor lock-in, только Linear |
| **Jira AI** | Built-in AI | Vendor lock-in, только Jira |
| **Sweep AI** | PR bot | Только code, нет PM workflow |
| **CodeRabbit** | PR review bot | Только review, нет PM |

**ShipMate unique:**
- Open-source, self-hosted
- Platform-agnostic (GitHub + Jira + Linear + ...)
- Работает в team chat (не отдельный UI)
- Full PM scope (не только code review)
- Extensible через skills (zero code для кастомизации)
- Базируется на mature platform (OpenClaw 170k+ stars)

---

## 6. Naming & Branding

**Выбрано: ShipMate**

- "Ship" — ключевой глагол для разработчиков ("ship it", "ship a feature")
- "Mate" — помощник, товарищ по команде
- npm package: `shipmate` / `@shipmate/skills`
- CLI: `shipmate` (если потребуется)
- ClawHub slug: `shipmate`

---

## 7. Security & Project Isolation

Подробная модель безопасности описана в [security.md](security.md).

### Ключевые принципы

1. **One Instance = One Project** — каждый ShipMate привязан к одному репозиторию, физически не может видеть соседние проекты
2. **Setup-time enforcement** — изоляция проверяется при запуске, а не доверяется LLM
3. **Three layers** — workspace isolation + tool policy + Docker sandbox
4. **Refuse to run** — небезопасная конфигурация блокирует запуск

### Почему это критично

ShipMate работает в **командном чате**. Каждый участник группы может задать любой вопрос. Без изоляции:
- Разработчик может случайно увидеть файлы/секреты другого проекта
- Prompt injection может заставить агента выполнить опасную команду
- GitHub token с broad scope даёт доступ ко всем репозиториям организации

### Deployment modes

| Mode | Изоляция | Sandbox | Для кого |
|------|----------|---------|----------|
| **Local Dev** | Workspace only | Не нужен | Один разработчик, свой ноутбук |
| **Team Chat** | Workspace + Tool Policy + Sandbox | Docker (рекомендуется) | Команда разработки |
| **Cloud (Railway)** | Workspace + Tool Policy + Container | По умолчанию | Команда, production-ready |

---

## 8. Архитектурные решения (findings)

> Результат исследования по 7 критическим пробелам, выявленным в первой итерации.

### 8.1 Context Window Strategy

**Проблема:** PR diffs 50-200k chars, sprint analytics требует 5-10 API вызовов — контекстное окно переполняется.

**Решение OpenClaw (нативное):**
- **Session pruning** — soft-trim при >50k chars (head 1500 + tail 1500), hard-clear для старых результатов
- **Auto-compaction** — суммаризация старой истории при приближении к лимиту
- **Subagents** — изолированные sub-sessions для параллельной обработки

**Решение ShipMate (поверх нативного):**
- Skills проектируются с учётом pruning — используют `--stat` перед `--diff`, `--json` + `--jq`, `--limit`
- Паттерн "stat-first, file-by-file" для code review (группы по 5 файлов)
- Паттерн "collect-summarize-proceed" для sprint analytics (2 фазы, summary после каждой)
- Лимит: 3-5 API calls per user request (max 10 для complex)

### 8.2 Multi-User в групповом чате

**Проблема:** несколько человек пишут в одну группу — как различать контекст?

**Решение OpenClaw (нативное):**
- Одна shared session на группу (session key: `agent:<agentId>:<channel>:group:<id>`)
- Каждое сообщение помечается `[from: Sender Name]`
- Pending messages (до 50) инжектятся как контекст
- Message queue обеспечивает последовательную обработку

**Решение ShipMate:**
- Это **не проблема ShipMate** — shared session корректна для PM (все видят один проект)
- SOUL.md: правила адресации ответов по имени из `[from:]`
- AGENTS.md: инструкция обрабатывать запросы каждого пользователя независимо
- PM-данные (PRs, issues, velocity) общие для команды, не per-user

### 8.3 Persistence / Memory Layer

**Проблема:** ShipMate анализирует velocity, тренды — нужны исторические данные между сессиями.

**Решение OpenClaw (нативное):**
- `MEMORY.md` — curated long-term memory (не инжектится в bootstrap group sessions, но `memory_search` по нему ищет и в group sessions)
- `memory/YYYY-MM-DD.md` — daily append-only log
- `memory-core` plugin — `memory_search` + `memory_get` tools входят в `group:memory` (не `group:fs`), работают в group sessions без ограничений
- Auto memory flush перед compaction

**Важное уточнение (верифицировано в коде OpenClaw):**
- `MEMORY.md` не загружается в bootstrap group sessions — это только bootstrap filtering, не ограничение search
- `memory_search` / `memory_get` доступны в group sessions — они в `group:memory`, не в `group:fs`
- Memory-core plugin не имеет session-type restrictions — tools регистрируются безусловно

**Конфликт group:fs и persistence (решён):**
- `write` tool входит в `group:fs` и запрещён в team deployments
- Решение: persistence через `bash` (`cat >> memory/YYYY-MM-DD.md`) — bash в `group:runtime`, не блокируется deny `group:fs`
- `workspaceAccess: "rw"` обязателен для записи (если `"ro"` — bash тоже не сможет писать)
- Это не обход security policy — архитектурное решение, задокументированное в [security.md](security.md)

**Решение ShipMate:**
- После sprint report → запись ключевых метрик через `bash` в `memory/YYYY-MM-DD.md`
- Для сравнения спринтов → `memory_search` по предыдущим записям (работает в group sessions)
- Для долгосрочного контекста команды → `data/team-context.md` в workspace (шаблон создан)
- Формат persistence: structured markdown (velocity, status, blockers)

### 8.4 Тестирование Skills

**Проблема:** нет unit-test framework для SKILL.md. Как обеспечить regression testing?

**Исследование:** ClawHub registry пуст (0 highlighted skills). Bundled skills (53) — все general-purpose. Dev/PM skills в экосистеме не существуют — greenfield.

**Решение:**
- Reference skills: bundled `github/SKILL.md` и `coding-agent/SKILL.md` как примеры структуры
- Eval-based testing: `tests/scenarios.md` с парами (prompt → expected behavior)
- Headless режим: `openclaw agent --message "<prompt>"` на тестовом workspace
- Regression: после изменения skill — прогон через сценарии
- Тест-сценарии покрывают: happy path, edge cases, security (out-of-scope access, prompt injection)

### 8.5 Rate Limits и Caching

**Проблема:** GitHub API 5000 req/hr. Sprint analytics + code review могут быстро исчерпать лимит.

**Исследование:** OpenClaw не имеет built-in rate limiting для tool calls. Есть retry на 429 и model failover.

**Решение Phase 1 (skills-only):**
- Skills содержат инструкцию "3-5 API calls per request"
- `--json` + `--jq` для минимизации запросов
- `git log` / `git shortlog` (local, free) вместо `gh` где возможно
- `gh` CLI сам обрабатывает 429 retry

**Решение Phase 2 (plugin):**
- In-memory cache с TTL (PR metadata: 5 min, diffs: 15 min, stats: 30 min)
- Rate limiter: 30 tool calls/min per session
- GraphQL batch requests (1 call = 3-5 REST calls)

### 8.6 Supply Chain Security

**Проблема:** ~17% skills на ClawHub вредоносные (Bitdefender, Feb 2026). Нет code signing.

**Решение:**
- Primary distribution: **GitHub releases** (verified source)
- Secondary: ClawHub для discoverability с предупреждением "verify source"
- GPG-signed tags для releases
- `CHECKSUMS.txt` с SHA256 для каждого файла
- Skills = статический markdown (легко аудитируемы)
- Plugin = TypeScript (читаемый код, no dynamic loading)

Подробнее: [security.md — Supply Chain Security](security.md#supply-chain-security)

### 8.7 MVP Scope

Определён в секции 3.1. Ключевые решения:
- **4 core skills** (code-review, project-planning, sprint-analytics, system-design) + master skill
- **GitHub only** — единственная внешняя интеграция для Phase 1
- **Bootstrap** — SOUL.md + AGENTS.md с правилами group chat, memory, security
- **Без plugin** — Phase 1 работает на bash + gh CLI
- **Без Jira/Linear** — Phase 2

### 8.8 Critical Fixes (вторая итерация)

Дополнительные архитектурные проблемы, выявленные при ревью:

**{baseDir} удалён из OpenClaw.** CHANGELOG: "Removed `{baseDir}` placeholder in favor of relative paths." При загрузке skill OpenClaw инжектит `References are relative to <absolutePath>.` — LLM резолвит пути сам. Master skill исправлен: `{baseDir}/../X/SKILL.md` → `../X/SKILL.md`.

**Конфликт group:fs и persistence.** `write` tool в `group:fs` (deny в team deployments), но persistence нужен. Решение: запись через `bash` (`cat >> memory/...`), чтение через `memory_search` (`group:memory`). Задокументировано в security.md.

**Error handling.** Добавлена стратегия обработки ошибок в master skill: empty results, 403 auth, 404 not found, 429 rate limit, timeout. Принцип: никогда не галлюцинировать данные при ошибке.

**Onboarding flow.** Добавлен в master skill: проверка `data/team-context.md`, graceful degradation при пустом контексте, fallback на date-based анализ при отсутствии milestones.

**Hard assertions в тестах.** Test scenarios дополнены верифицируемыми критериями: подсчёт API calls в логах, проверка наличия `--stat` перед `--diff`, проверка persistence в session log.

---

## 9. Открытые вопросы

1. **GitHub repo organization** — `shipmate-ai/shipmate` или под нашим org?
2. **License** — MIT (как OpenClaw) или Apache 2.0?
3. **Монорепо или отдельные пакеты** — skills отдельно от plugin или вместе?
4. ~~**ClawHub vs npm** — основной канал дистрибуции?~~ → Решено: GitHub releases (primary), ClawHub (secondary)
5. ~~**Тестирование** — как тестировать skills?~~ → Решено: eval-based testing (tests/scenarios.md)
6. **Multi-language** — skills на русском, английском, или оба?
