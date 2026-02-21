# ShipMate — Project Rules

## Что это

Open-source AI-ассистент для проектного менеджмента в разработке. Построен как skills pack + plugin для OpenClaw.

## Структура проекта

```
shipmate/
├── RULES.md              # Этот файл — правила проекта
├── README.md             # Публичное описание (для GitHub)
├── docs/                 # Документация (quick-start, security, config reference)
├── skills/               # OpenClaw skills pack (SKILL.md файлы)
├── plugin/               # OpenClaw plugin (TypeScript, custom tools)
├── bootstrap/            # Bootstrap шаблоны (SOUL.md, AGENTS.md)
├── setup/                # Скрипты установки и настройки
└── tests/                # Тестовые сценарии
```

## Стек

- **Runtime**: OpenClaw Gateway (Node.js)
- **Skills**: AgentSkills-compatible SKILL.md файлы
- **Plugin**: TypeScript (OpenClaw plugin format)
- **LLM**: Anthropic Claude (primary), OpenAI (secondary)
- **Каналы**: Telegram, Slack, Discord (через OpenClaw)

## Правила разработки

### Код
- TypeScript strict mode для plugin
- Skills — Markdown с YAML frontmatter (AgentSkills spec)
- Без хардкода секретов — всё через env / OpenClaw config

### Skills
- Каждый skill — отдельная папка с `SKILL.md`
- Описание должно чётко указывать когда использовать skill
- Metadata с gating (requires.bins / requires.env) где нужно
- Инструкции для LLM — конкретные, с примерами, без воды

### Plugin
- Каждый tool — отдельный файл в `plugin/tools/`
- Все tools с параметрами валидации и error handling
- Rate limits где нужно
- Audit logging для write-операций

### Git
- Основная ветка: `main`
- Feature branches: `feat/<name>`
- Коммиты: conventional commits (feat/fix/docs/refactor)

## Безопасность

Подробная модель: `docs/security.md`

**Принцип:** One Instance = One Project. Каждый ShipMate привязан к одному репозиторию. Нет personal mode — всегда scoped.

**Четыре уровня изоляции (все обязательные):**
1. **ScopeGuard (plugin)** — allowlist для GitHub repos, GitLab projects, Jira projects/boards. Fail-closed: нет scope = tools не регистрируются
2. **Token Scoping** — Fine-grained PAT (GitHub), Project Access Token (GitLab). Валидируется при setup
3. **Tool Policy** — `group:fs` в deny, `elevated: false`
4. **Sandbox** — Docker для bash, только workspace + scoped env vars

**Setup enforcement:** ShipMate отказывается регистрировать tools при отсутствии scope конфигурации.

## Запрещено

- Хардкод API ключей / токенов
- Push напрямую в production без review
- Удаление файлов без разрешения — только archive
- Доступ к файлам/проектам за пределами workspace

## Связанные проекты

| Проект | Связь |
|--------|-------|
| OpenClaw (`openclaw/openclaw`) | Base platform — runtime, gateway, channels |

## Для AI-агентов

При работе с ShipMate:
1. Прочитай этот `RULES.md` перед началом
2. Документация — в `docs/`
3. Skills — в `skills/`
4. Не создавай файлы за пределами `projects/shipmate/`
