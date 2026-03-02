# ShipMate — Project Rules

## Что это

Open-source AI-ассистент для проектного менеджмента в разработке. Построен как skills pack + plugin для OpenClaw.

## Структура проекта

```
projects/shipmate/
├── RULES.md              # Этот файл — правила проекта
├── README.md             # Публичное описание (для GitHub)
├── docs/                 # Документация и аналитика
│   └── analysis.md       # Анализ архитектуры OpenClaw и план развития
├── skills/               # OpenClaw skills pack (SKILL.md файлы)
├── plugin/               # OpenClaw plugin (TypeScript, custom tools)
└── bootstrap/            # Bootstrap шаблоны (SOUL.md, AGENTS.md)
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

**Принцип:** One Instance = One Project. Каждый ShipMate привязан к одному репозиторию.

**Три уровня изоляции:**
1. **Workspace** — `agents.defaults.workspace` указывает на корень проекта
2. **Tool Policy** — `group:fs` в deny, `elevated: false`
3. **Sandbox** — Docker для bash (рекомендуется для team deployments)

**Setup enforcement:** ShipMate отказывается запускаться при небезопасной конфигурации.

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
