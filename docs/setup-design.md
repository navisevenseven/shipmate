# ShipMate — Setup, Onboarding & Service Integration Design

> Техническая спецификация для реализации. Описывает полный flow от установки до работающего бота в чате.
> Контекст проекта: `README.md`, `docs/analysis.md`, `docs/security.md`, `docs/TZ-stack-research.md`.

---

## 1. Обзор процесса

Три фазы, выполняются последовательно:

```
Phase A: Install        Phase B: Configure         Phase C: First Run
─────────────────      ──────────────────────     ─────────────────────
Копирование файлов  →  Токены, CLI tools,      →  LLM проверяет среду,
в OpenClaw workspace    openclaw.json              заполняет team-context,
                                                   проверяет skills
```

**Phase A** — пользователь запускает `setup/install.sh`.
**Phase B** — пользователь заполняет `openclaw.json` (template генерируется скриптом).
**Phase C** — LLM при первом сообщении в чате автоматически запускает onboarding.

---

## 2. Phase A: Installation (`setup/install.sh`)

### 2.1 Что делает скрипт

Bash-скрипт. Без интерактивного ввода. Выводит чеклист с результатами.

**Входные параметры:**
- `--workspace <path>` — путь к целевому проекту (обязательный)
- `--openclaw-dir <path>` — путь к OpenClaw home (по умолчанию `~/.openclaw`)
- `--skip-copy` — не копировать файлы (для повторных проверок)

**Порядок действий:**

```
1. Валидация workspace
   - Проверить что путь существует
   - Проверить что содержит .git
   - Проверить что НЕ является ~ или / или /Users/*
   → FAIL если не прошло (с сообщением что именно не так)

2. Проверка CLI tools (каждый — отдельная строка вывода)
   ┌──────────────┬────────────┬──────────┬─────────────────────────────┐
   │ Tool         │ Check cmd  │ Required │ Used by                     │
   ├──────────────┼────────────┼──────────┼─────────────────────────────┤
   │ git          │ git --ver  │ P0       │ все skills                  │
   │ glab         │ glab --ver │ P0       │ code-review, sprint-analytics│
   │ gh           │ gh --ver   │ P0       │ code-review (GitHub repos)  │
   │ jq           │ jq --ver   │ P0       │ data processing             │
   │ curl         │ curl --ver │ P0       │ Jira/Confluence/Sentry REST │
   │ kubectl      │ kubectl ver│ P1       │ devops skill                │
   │ sentry-cli   │ sentry-cli │ P1       │ incident tracking           │
   └──────────────┴────────────┴──────────┴─────────────────────────────┘

   Формат вывода:
   ✅ git 2.43.0
   ✅ glab 1.46.0
   ❌ kubectl — not found (optional: install for devops skill)

   P0 tools отсутствуют → WARNING (не FAIL — skills gating обработает)
   P1 tools отсутствуют → INFO

3. Проверка авторизации (для установленных CLI)
   - glab auth status → проверить что залогинен, вывести hostname
   - gh auth status → проверить что залогинен
   - kubectl cluster-info → проверить доступ к кластеру

   Не залогинен → WARNING с командой для логина:
   "⚠️ glab: not authenticated. Run: glab auth login --hostname gitlab.yourhost.com"

4. Копирование файлов (если не --skip-copy)
   - cp -r skills/* $OPENCLAW_DIR/skills/
   - cp -r bootstrap/* $OPENCLAW_DIR/workspace/
   - Проверить что файлы на месте после копирования

5. Генерация openclaw.json (если не существует)
   - Создать $OPENCLAW_DIR/openclaw.json из template
   - Подставить --workspace в agents.defaults.workspace
   - Подставить hostname из glab auth status в GITLAB_HOST
   - Остальные env — оставить пустыми с комментариями

6. Вывод итога
   ✅ Workspace: /path/to/project (git repo)
   ✅ Skills: 5 installed (shipmate, code-review, project-planning, sprint-analytics, system-design)
   ✅ Bootstrap: SOUL.md, AGENTS.md, data/team-context.md
   ✅ CLI: 5/7 tools available
   ⚠️ Missing optional: kubectl, sentry-cli
   ⚠️ Auth: glab not authenticated

   Next steps:
   1. Fill tokens in ~/.openclaw/openclaw.json
   2. Run: glab auth login
   3. Start OpenClaw and send a message to ShipMate
```

### 2.2 Чего скрипт НЕ делает

- Не устанавливает CLI tools (только проверяет). Инструкции по установке — в README.
- Не запрашивает токены интерактивно. Пользователь заполняет openclaw.json вручную.
- Не запускает OpenClaw.
- Не создаёт Docker-образы.

---

## 3. Phase B: Configuration (`openclaw.json`)

### 3.1 Template файл: `setup/openclaw.json.template`

Создать файл. Это JSON5 (OpenClaw поддерживает). Комментарии — часть файла.

```json5
{
  // === AGENT SETTINGS ===
  agents: {
    defaults: {
      workspace: "{{WORKSPACE_PATH}}",  // setup/install.sh подставит
      // Для team chat: включить sandbox
      // sandbox: {
      //   mode: "all",
      //   docker: {
      //     image: "shipmate/sandbox:latest",
      //     mountWorkspace: true,
      //     workspaceAccess: "rw",
      //   },
      // },
    },
  },

  // === TOOL POLICY ===
  // Для team chat: раскомментировать deny group:fs
  tools: {
    // deny: ["group:fs", "group:ui", "group:nodes", "group:automation"],
    // allow: ["bash", "shipmate_*"],
    // elevated: { enabled: false },
  },

  // === SKILLS ===
  skills: {
    entries: {
      shipmate: {
        enabled: true,
        env: {
          // --- P0: обязательные ---

          // GitLab (self-hosted)
          // Создать: GitLab → Settings → Access Tokens → Project Access Token
          // Scopes: read_api, read_repository, read_merge_request
          GITLAB_TOKEN: "",
          GITLAB_HOST: "{{GITLAB_HOST}}",  // e.g., gitlab.company.com

          // GitHub
          // Создать: github.com/settings/tokens → Fine-grained → Select repo
          // Permissions: Contents(R), PRs(RW), Issues(RW), Actions(R)
          GITHUB_TOKEN: "",

          // Jira Cloud
          // Создать: id.atlassian.com/manage-profile/security/api-tokens
          JIRA_BASE_URL: "",      // e.g., https://yourorg.atlassian.net
          JIRA_API_TOKEN: "",
          JIRA_USER_EMAIL: "",    // email аккаунта Atlassian

          // --- P1: рекомендуемые ---

          // Confluence (тот же Atlassian token что и Jira)
          // CONFLUENCE_BASE_URL совпадает с JIRA_BASE_URL

          // Sentry (self-hosted)
          // Создать: Sentry → Settings → API Keys → Auth Token
          // Scopes: project:read, event:read, issue:read
          SENTRY_URL: "",         // e.g., https://sentry.company.com
          SENTRY_AUTH_TOKEN: "",
          SENTRY_ORG: "",
          SENTRY_PROJECT: "",

          // Kubernetes
          // kubectl использует ~/.kube/config — отдельный токен не нужен
          // Убедиться что kubeconfig доступен в среде OpenClaw

          // --- P2: опциональные ---

          // Grafana
          // Создать: Grafana → Administration → Service Accounts → Token
          // Role: Viewer (только чтение)
          GRAFANA_URL: "",        // e.g., https://grafana.company.com
          GRAFANA_TOKEN: "",
        },
      },
    },
  },
}
```

### 3.2 Env-переменные: полная таблица

Для каждой переменной указать: какой skill использует, как проверить, что будет если не задана.

```
┌──────────────────┬──────────┬──────────────────────────────────┬────────────────────────┐
│ Variable         │ Priority │ Verification command             │ If missing             │
├──────────────────┼──────────┼──────────────────────────────────┼────────────────────────┤
│ GITLAB_TOKEN     │ P0       │ glab auth status                 │ code-review (GL) off   │
│ GITLAB_HOST      │ P0       │ glab auth status                 │ code-review (GL) off   │
│ GITHUB_TOKEN     │ P0       │ gh auth status                   │ code-review (GH) off   │
│ JIRA_BASE_URL    │ P0       │ curl -s $URL/rest/api/3/myself   │ sprint-analytics off   │
│ JIRA_API_TOKEN   │ P0       │ (вместе с JIRA_BASE_URL)         │ sprint-analytics off   │
│ JIRA_USER_EMAIL  │ P0       │ (вместе с JIRA_BASE_URL)         │ sprint-analytics off   │
│ SENTRY_URL       │ P1       │ sentry-cli info                  │ incident skill off     │
│ SENTRY_AUTH_TOKEN│ P1       │ sentry-cli info                  │ incident skill off     │
│ SENTRY_ORG       │ P1       │ sentry-cli info                  │ incident skill off     │
│ SENTRY_PROJECT   │ P1       │ sentry-cli info                  │ incident skill off     │
│ GRAFANA_URL      │ P2       │ curl -s $URL/api/health          │ grafana queries off    │
│ GRAFANA_TOKEN    │ P2       │ curl -H "Auth: Bearer $T" .../api│ grafana queries off    │
└──────────────────┴──────────┴──────────────────────────────────┴────────────────────────┘
```

Kubernetes: токен не в env. Проверка: `kubectl cluster-info` — если работает, kubectl skill доступен.

### 3.3 Jira REST API через curl (без jira-cli)

`jira-cli` — это дополнительный binary. Для MVP лучше использовать `curl` напрямую — меньше зависимостей. Jira Cloud REST API v3:

```bash
# Проверка авторизации
curl -s -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/myself" | jq '.displayName'

# Список спринтов (нужен board ID)
curl -s -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/agile/1.0/board/{boardId}/sprint?state=active" | jq '.values'

# Issues в спринте
curl -s -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/agile/1.0/sprint/{sprintId}/issue?maxResults=50" | jq '.issues'
```

Все Jira-вызовы в skills делать через `curl + jq` (вместо отдельного CLI). Confluence API — аналогично (тот же Atlassian token).

---

## 4. Phase C: First Run (LLM Onboarding)

### 4.1 Триггер

Любое первое сообщение пользователя в чате. LLM выполняет onboarding до ответа на вопрос пользователя.

### 4.2 Алгоритм (реализуется в `skills/shipmate/SKILL.md`)

```
STEP 1: Проверить data/team-context.md
   - Файл существует И содержит не-placeholder данные?
     YES → прочитать, запомнить, перейти к Step 2
     NO  → запустить onboarding dialog (Step 1b)

STEP 1b: Onboarding dialog
   Сказать: "Я новый в этом проекте. Давай настроимся:"
   Спросить:
   - "Какой основной репозиторий? (GitLab URL)"
   - "Вы используете Jira sprints? Какой board? Длина спринта?"
   - "Конвенции веток? (feat/*, fix/*, ...)"
   - "Кто в команде? (можно потом заполнить team-context.md)"
   После ответов → предложить записать в data/team-context.md через bash

STEP 2: Проверить доступные skills
   Вызвать: ls skills/ (или проверить какие skills загружены)
   Результат: список загруженных skills → вывести пользователю:
   "Доступные capabilities:
    ✅ code-review (GitLab + GitHub)
    ✅ project-planning (Jira + GitLab)
    ✅ sprint-analytics (Jira + GitLab)
    ✅ system-design
    ❌ devops (kubectl not found — install for K8s visibility)
    ❌ incident tracking (sentry-cli not configured)"

STEP 3: Проверить подключение к сервисам
   Выполнить (молча, без вывода пользователю):
   - glab auth status 2>&1       → GitLab ok/fail
   - gh auth status 2>&1         → GitHub ok/fail
   - curl Jira /myself           → Jira ok/fail
   - kubectl cluster-info 2>&1   → K8s ok/fail (если kubectl есть)

   Если есть failures → сообщить:
   "⚠️ GitLab: не авторизован. Выполни: glab auth login --hostname ..."
   "⚠️ Jira: токен не задан в конфиге. Заполни JIRA_API_TOKEN в openclaw.json"

STEP 4: Ответить на исходный вопрос пользователя
   Onboarding не должен блокировать. Даже если часть сервисов недоступна —
   ответить на вопрос тем что есть, с пометкой что недоступно.
```

### 4.3 Повторные запуски

Onboarding выполняется ОДИН раз за сессию. При повторных сообщениях — не выполнять. Как определить что onboarding уже прошёл: проверить наличие в текущей сессии ответа с "Доступные capabilities" или аналогичного маркера.

Если пользователь явно просит пере-проверку ("проверь подключение", "что доступно?") — выполнить Steps 2-3 повторно.

---

## 5. Skills Gating (metadata)

OpenClaw нативно поддерживает gating: если в metadata указан `requires.bins` или `requires.env`, skill не загружается при отсутствии.

### 5.1 Обновить metadata каждого skill

```yaml
# skills/shipmate/SKILL.md (master — всегда загружен)
metadata:
  { "openclaw": { "emoji": "🚢", "always": true } }

# skills/code-review/SKILL.md
# Нужен хотя бы один из glab/gh
metadata:
  { "openclaw": { "emoji": "🔍", "requires": { "anyBins": ["glab", "gh"] } } }

# skills/project-planning/SKILL.md
# Git обязателен, glab или gh — хотя бы один
metadata:
  { "openclaw": { "emoji": "📋", "requires": { "bins": ["git"], "anyBins": ["glab", "gh"] } } }

# skills/sprint-analytics/SKILL.md
# Git + (glab или gh). Jira проверяется runtime (env), не gating
metadata:
  { "openclaw": { "emoji": "📊", "requires": { "bins": ["git"], "anyBins": ["glab", "gh"] } } }

# skills/system-design/SKILL.md
# Только git
metadata:
  { "openclaw": { "emoji": "🏗️", "requires": { "bins": ["git"] } } }

# skills/devops/SKILL.md (НОВЫЙ — создать)
# kubectl обязателен
metadata:
  { "openclaw": { "emoji": "🚀", "requires": { "bins": ["kubectl"] } } }
```

### 5.2 Почему Jira не в gating

`requires.env` проверяет env-переменные при загрузке skill. Но Jira credentials — 3 переменные (`JIRA_BASE_URL`, `JIRA_API_TOKEN`, `JIRA_USER_EMAIL`), и их отсутствие не должно блокировать загрузку sprint-analytics (skill может работать только с GitLab/GitHub данными). Поэтому Jira проверяется runtime в skill instructions: "Если `JIRA_BASE_URL` не задан — использовать только glab/gh для sprint data."

### 5.3 Master skill: отображение недоступных skills

В `skills/shipmate/SKILL.md` добавить инструкцию:

```
Если пользователь просит функцию, для которой skill не загружен:
- "Для мониторинга K8s нужен kubectl. Установите его и перезапустите OpenClaw."
- "Для анализа ошибок нужен доступ к Sentry. Заполните SENTRY_* в openclaw.json."
Не отказывать молча — объяснить что нужно для включения.
```

---

## 6. Graceful Degradation

Не все сервисы будут настроены. Каждый skill должен работать с тем что есть.

### 6.1 Матрица деградации

```
┌────────────────────┬────────────────────────────────────────────┐
│ Что отсутствует    │ Что происходит                             │
├────────────────────┼────────────────────────────────────────────┤
│ GitLab token       │ code-review работает только с GitHub PRs   │
│ GitHub token       │ code-review работает только с GitLab MRs   │
│ Оба (GL + GH)     │ code-review skill не загружается (gating)  │
│ Jira credentials   │ sprint-analytics: только git + glab/gh     │
│                    │ (commits, MRs, нет задач/спринтов)         │
│ kubectl            │ devops skill не загружается (gating)       │
│ Sentry credentials │ нет incident tracking, сообщить юзеру      │
│ Grafana credentials│ нет доступа к метрикам, сообщить юзеру     │
│ team-context.md    │ onboarding dialog, работа с доступными     │
│                    │ данными                                    │
│ memory/ пусто      │ "нет исторических данных, начну собирать"  │
└────────────────────┴────────────────────────────────────────────┘
```

### 6.2 Правило для skills

Каждый skill содержит секцию "Fallback Behavior" (добавить при реализации):

```markdown
## Fallback Behavior
- If Jira is not configured: skip Jira queries, use glab/gh issue data only
- If no milestones/sprints found: fall back to date-based analysis (last 2 weeks)
- If kubectl is unavailable: skip deployment status, note "K8s status unavailable"
- If memory/ is empty: generate report normally, save for future comparisons
- Always tell the user what data source is missing and how to enable it
```

---

## 7. Verification Script (`setup/verify.sh`)

Отдельный скрипт для проверки что всё работает. Может вызываться повторно.

```
Входные параметры: нет (читает openclaw.json из стандартного пути)

Проверки:
1. OpenClaw running     → curl localhost:18789/health (или аналог)
2. Workspace valid      → .git exists, not ~ or /
3. Skills loaded        → ls ~/.openclaw/skills/shipmate/ (5 skills)
4. Bootstrap present    → ls ~/.openclaw/workspace/SOUL.md AGENTS.md
5. GitLab auth          → glab auth status
6. GitHub auth          → gh auth status
7. Jira connectivity    → curl $JIRA_BASE_URL/rest/api/3/myself
8. K8s access           → kubectl cluster-info (optional)
9. Sentry access        → curl $SENTRY_URL/api/0/ (optional)
10. Security policy     → parse openclaw.json: group:fs in deny, elevated false

Формат вывода:
=== ShipMate Health Check ===
✅ OpenClaw: running (port 18789)
✅ Workspace: /home/dev/myproject (git repo)
✅ Skills: 5/5 loaded (shipmate, code-review, project-planning, sprint-analytics, system-design)
⚠️ Skills not loaded: devops (kubectl not found)
✅ GitLab: authenticated (gitlab.company.com, @username)
✅ GitHub: authenticated (@username)
✅ Jira: connected (yourorg.atlassian.net, John Doe)
❌ Kubernetes: not configured
❌ Sentry: SENTRY_URL not set
⚠️ Security: group:fs NOT in deny list (ok for local dev, required for team chat)
```

---

## 8. Файловая структура (что создать)

```
projects/shipmate/
├── setup/
│   ├── install.sh                 # СОЗДАТЬ — Phase A скрипт
│   ├── verify.sh                  # СОЗДАТЬ — Health check скрипт
│   └── openclaw.json.template     # СОЗДАТЬ — Template конфига
├── skills/
│   ├── shipmate/SKILL.md          # ОБНОВИТЬ — onboarding flow (Phase C)
│   ├── code-review/SKILL.md       # ОБНОВИТЬ — metadata (glab + fallback)
│   ├── project-planning/SKILL.md  # ОБНОВИТЬ — metadata + Jira fallback
│   ├── sprint-analytics/SKILL.md  # ОБНОВИТЬ — metadata + Jira integration
│   ├── system-design/SKILL.md     # БЕЗ ИЗМЕНЕНИЙ
│   └── devops/SKILL.md            # СОЗДАТЬ — kubectl skill
├── bootstrap/
│   ├── SOUL.md                    # ОБНОВИТЬ — onboarding rules
│   ├── AGENTS.md                  # ОБНОВИТЬ — service availability rules
│   └── data/team-context.md       # БЕЗ ИЗМЕНЕНИЙ (template)
├── tests/
│   └── scenarios.md               # ОБНОВИТЬ — добавить setup/onboarding scenarios
└── docs/
    └── setup-design.md            # ЭТОТ ФАЙЛ
```

---

## 9. Test Scenarios (добавить в tests/scenarios.md)

### SETUP-01: Fresh install onboarding

**Setup:** Пустой workspace. team-context.md — template с placeholders. Все CLI tools установлены. Все токены заданы.
**Prompt:** "Как дела со спринтом?"
**Expected:**
- Обнаруживает пустой team-context.md
- Задаёт вопросы про спринт (milestone vs date-based, длина)
- Проверяет подключение к сервисам
- Выводит доступные capabilities
- Отвечает на вопрос про спринт с доступными данными

**Hard Assertions:**
- Output содержит вопрос про спринты
- Output содержит список capabilities (✅/❌)
- Output содержит sprint данные (не пустой ответ)

### SETUP-02: Missing Jira credentials

**Setup:** JIRA_BASE_URL не задан. GitLab и GitHub настроены.
**Prompt:** "Sprint status"
**Expected:**
- Sprint-analytics работает только с glab/gh данными (MRs, commits)
- Сообщает: "Jira не настроена — sprint данные из GitLab only"
- Предлагает настроить Jira для полной аналитики

**Hard Assertions:**
- Output содержит "Jira" и "not configured" (или аналог)
- Output содержит MR/commit данные (skill не упал полностью)

### SETUP-03: Missing kubectl

**Setup:** kubectl не установлен. Пользователь спрашивает про deployment.
**Prompt:** "Что сейчас задеплоено в production?"
**Expected:**
- Объясняет что devops skill недоступен
- Предлагает установить kubectl
- Не пытается выполнить kubectl команды

**Hard Assertions:**
- Output содержит "kubectl" и "install" (или аналог)
- Session log НЕ содержит вызов kubectl

### SETUP-04: verify.sh check

**Setup:** Полностью настроенная среда.
**Prompt:** Запуск `setup/verify.sh`
**Expected:**
- Все проверки проходят
- Exit code 0
- Вывод содержит ✅ для каждого настроенного сервиса

---

## 10. Порядок реализации

```
1. setup/openclaw.json.template     (30 мин) — template с комментариями
2. setup/install.sh                 (2-3 часа) — чеклист + копирование + генерация конфига
3. setup/verify.sh                  (1-2 часа) — health check
4. skills metadata update           (30 мин) — обновить requires.bins/env
5. skills/devops/SKILL.md           (1-2 часа) — новый skill для kubectl
6. skills/shipmate/SKILL.md update  (1 час) — onboarding flow + capabilities check
7. sprint-analytics Jira integration(2-3 часа) — curl + jq для Jira REST API
8. tests/scenarios.md update        (30 мин) — setup/onboarding scenarios
```

Итого: ~1.5-2 дня работы.
