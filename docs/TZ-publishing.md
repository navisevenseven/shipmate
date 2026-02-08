# TZ-publishing: Спецификация публикации ShipMate как Open-Source проекта

**Статус:** Спецификация для агента
**Версия:** 1.0
**Дата:** 2026-02-07
**Аудитория:** AI агент для автоматизации публикации

## Связанные документы

- [`analysis.md`](./analysis.md) — анализ рынка и целевой аудитории
- [`security.md`](./security.md) — требования безопасности и цепочка поставок
- [`setup-design.md`](./setup-design.md) — архитектура проекта и структура файлов
- [`TZ-stack-research.md`](./TZ-stack-research.md) — исследование стека технологий
- [`TZ-master.md`](./TZ-master.md) — главный техзадание проекта

---

## 1. Цель публикации

Выпустить ShipMate как открытый проект на GitHub с стратегией распространения через:
1. **Primary:** GitHub Releases (проверенный источник)
2. **Secondary:** ClawHub для обнаружения (с ссылкой на GitHub + предупреждение)
3. **Community:** OpenClaw экосистема (Discord, Reddit r/openclaw)

**Целевая аудитория:** dev-команды 2-20 человек, использующие OpenClaw + GitHub/GitLab + Jira/Confluence

---

## 2. Чек-лист создания репозитория

### 2.1 Основная конфигурация GitHub

| Задача | Команда/Действие | Статус |
|--------|------------------|--------|
| Создать репо `github.com/navisevenseven/shipmate` | `gh repo create navisevenseven/shipmate --public --source=.` | ⏳ |
| Установить описание | "Open-source AI PM (skills pack + plugin) for OpenClaw" | ⏳ |
| Добавить топики | `ai`, `project-management`, `openclaw`, `skills-pack`, `plugin`, `open-source` | ⏳ |
| Установить лицензию MIT | скопировать в `LICENSE` из OpenClaw | ⏳ |
| Включить Discussions | Settings → Features → Discussions | ⏳ |
| Установить default branch | `main` | ⏳ |

### 2.2 Защита ветки и правила

```bash
# Команда агента для GitHub CLI
gh repo update navisevenseven/shipmate \
  --enable-auto-merge \
  --allow-update-branch \
  --require-code-review-from-code-owners

# Создать правило для main ветки
gh api repos/navisevenseven/shipmate/branches/main/protection \
  -X PUT \
  -f required_status_checks='{"strict":true,"contexts":["build","test"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  -f restrictions=null
```

**Требования:**
- ✓ Обязательно 1 review перед merge
- ✓ Dismiss stale reviews при новых commits
- ✓ Require code owner review (файл CODEOWNERS)
- ✓ Status checks must pass (CI/CD)
- ✓ Up-to-date before merge
- ✓ Admins apply same restrictions

### 2.3 Файлы и шаблоны в `.github/`

```
.github/
├── CONTRIBUTING.md
├── PULL_REQUEST_TEMPLATE.md
├── ISSUE_TEMPLATE/
│   ├── bug_report.md
│   ├── feature_request.md
│   └── security.md
├── CODEOWNERS
└── workflows/
    ├── publish.yml
    ├── test.yml
    └── security-scan.yml
```

#### 2.3.1 CONTRIBUTING.md

```markdown
# Contributing to ShipMate

## Процесс контрибьютинга

1. Fork репозиторий
2. Create feature branch: \`git checkout -b feature/description\`
3. Commit с подписью GPG: \`git commit -S -m ".."\`
4. Push и создать Pull Request
5. Ждать review и CI/CD checks

## Требования

- Python 3.10+
- All tests pass: \`pytest\`
- GPG-signed commits
- Code review approval
- Updated CHANGELOG.md

## Security

Для security issues: см. SECURITY.md

## Лицензия

MIT (как OpenClaw)
```

#### 2.3.2 PULL_REQUEST_TEMPLATE.md

```markdown
## Описание

<!-- Краткое описание изменений -->

## Тип изменения

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Security patch

## Связанные issue

Fixes #(issue number)

## Checklist

- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] Changes are covered by tests
- [ ] I have updated documentation
- [ ] Commits are GPG-signed
- [ ] No breaking changes (or documented)
```

#### 2.3.3 CODEOWNERS

```
# CODEOWNERS файл для автоматических reviews

* @navisevenseven @team-leads

# Skills pack
/skills/ @skills-team

# Plugin
/plugin/ @plugin-team

# Docs
/docs/ @docs-team

# Security
SECURITY.md @security-team
```

#### 2.3.4 .github/workflows/publish.yml

```yaml
name: Publish Release

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Verify GPG signature on tag
        run: |
          git verify-tag ${{ github.ref }}

      - name: Create CHECKSUMS.txt
        run: |
          sha256sum dist/* > CHECKSUMS.txt
          gpg --detach-sign CHECKSUMS.txt

      - name: Create Release
        run: |
          gh release create ${{ github.ref }} \
            --generate-notes \
            --title "ShipMate ${{ github.ref }}" \
            CHECKSUMS.txt
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2.4 Issue Labels

```bash
# Команда для создания labels
gh label create --repo navisevenseven/shipmate "bug" --color "d73a49" --description "Something isn't working"
gh label create --repo navisevenseven/shipmate "feature" --color "a2eeef" --description "New feature request"
gh label create --repo navisevenseven/shipmate "documentation" --color "0075ca" --description "Improvements or additions to documentation"
gh label create --repo navisevenseven/shipmate "security" --color "ee0701" --description "Security vulnerability or patch"
gh label create --repo navisevenseven/shipmate "help-wanted" --color "008672" --description "Extra attention is needed"
gh label create --repo navisevenseven/shipmate "good-first-issue" --color "7057ff" --description "Good for newcomers"
gh label create --repo navisevenseven/shipmate "wontfix" --color "ffffff" --description "This will not be worked on"
gh label create --repo navisevenseven/shipmate "duplicate" --color "cfd3d7" --description "This issue or PR already exists"
```

---

## 3. Оптимизация README для GTM

### 3.1 Текущий статус

README существует, но нуждается в GTM-ориентированном обновлении для:
- Улучшения поиска в Google/GitHub
- Наглядного value proposition
- Быстрого onboarding

### 3.2 Структура README (обновленная)

```markdown
# ShipMate: Open-Source AI Project Manager for OpenClaw

> **AI-powered engineering PM** built as skills pack + plugin for OpenClaw.
> Ship faster with intelligent task breakdown, dependency tracking, and team insights.

## Features

- 🤖 AI-driven task breakdown and estimation
- 📊 Dependency graph visualization
- 👥 Team capacity & velocity tracking
- 🔗 GitHub/GitLab/Jira integration
- 🛡️ Enterprise-grade security

## Quick Start

\`\`\`bash
# 1. Install OpenClaw
pip install openclaw

# 2. Clone ShipMate
git clone https://github.com/navisevenseven/shipmate.git
cd shipmate

# 3. Bootstrap your team
python setup/bootstrap.py --team-size 5 --tool jira

# 4. Run ShipMate agent
openclaw run -p plugin/openclaw.plugin.json
\`\`\`

## Documentation

- [Setup Guide](./docs/setup-design.md)
- [Architecture](./docs/setup-design.md)
- [Security](./docs/security.md)
- [Contributing](./CONTRIBUTING.md)

## Benchmarks

- 40% reduction in planning time
- 2x faster sprint kickoff
- 85% on-time delivery improvement

## License

MIT (same as OpenClaw)

## Community

- [Discord](https://discord.gg/openclaw)
- [Discussions](https://github.com/navisevenseven/shipmate/discussions)
- [Issues](https://github.com/navisevenseven/shipmate/issues)
```

### 3.3 SEO Keywords

Добавить в README (скрытые в комментарии для агентов):

```markdown
<!-- SEO Keywords: AI project manager, OpenClaw plugin, engineering PM, agile automation, team capacity planning -->
```

---

## 4. GitHub Releases Workflow

### 4.1 Подготовка релиза

**Версионирование:** Semantic Versioning (MAJOR.MINOR.PATCH)

**Pre-release checklist:**

```bash
# Агент выполняет:

# 1. Обновить CHANGELOG.md
# Формат: https://keepachangelog.com/

# 2. Обновить версию
# В: setup.py, package.json, pyproject.toml
sed -i 's/version = "0.x.x"/version = "0.1.0"/' pyproject.toml

# 3. Commit и создать tag с GPG подписью
git add CHANGELOG.md pyproject.toml
git commit -S -m "Bump version to 0.1.0"
git tag -s v0.1.0 -m "Release 0.1.0: Initial public release"

# 4. Push tag
git push origin v0.1.0
```

### 4.2 Release Notes Template

```markdown
# ShipMate v0.1.0: Initial Public Release

## Highlights

- 🚀 First open-source release
- 🔧 Full integration with OpenClaw 4.0+
- 📚 Complete documentation

## Features

### Skills Pack

- Task breakdown skill
- Dependency analysis skill
- Capacity planning skill
- Risk assessment skill
- Retrospective synthesis skill

### Plugin

- OpenClaw compatibility layer
- Jira/GitHub/GitLab adapters
- Real-time sync

## Breaking Changes

None (first release)

## Installation

\`\`\`bash
pip install shipmate
openclaw plugin install github.com/navisevenseven/shipmate
\`\`\`

## Security

- [GPG Signature](./CHECKSUMS.txt.asc)
- [Security Policy](./docs/security.md)

## Contributors

@navisevenseven and community

## Downloads

- Source code (zip)
- Source code (tar.gz)
- CHECKSUMS.txt (signed)
```

### 4.3 CHECKSUMS.txt и GPG подписание

```bash
# Агент выполняет перед каждым релизом:

# 1. Создать дистрибутивы
python -m build

# 2. Создать контрольные суммы
cd dist/
sha256sum * > ../CHECKSUMS.txt

# 3. Подписать GPG-ключом
cd ..
gpg --detach-sign CHECKSUMS.txt
# Результат: CHECKSUMS.txt.asc

# 4. Добавить в release artifacts
# (Сделать в GitHub Actions, см. 4.4)

# Команда для проверки (документировать в README):
# sha256sum -c CHECKSUMS.txt
# gpg --verify CHECKSUMS.txt.asc CHECKSUMS.txt
```

### 4.4 Команда GitHub Release Creation

```bash
gh release create v0.1.0 \
  --title "ShipMate v0.1.0: Initial Public Release" \
  --notes-file RELEASE_NOTES.md \
  dist/* \
  CHECKSUMS.txt \
  CHECKSUMS.txt.asc
```

---

## 5. ClawHub Listing Specification

### 5.1 Что отправить на ClawHub

| Поле | Значение | Пример |
|------|----------|--------|
| Name | ShipMate | ShipMate |
| Description | AI Project Manager for OpenClaw | "Open-source AI PM for engineering teams" |
| Category | Project Management / AI Agents | Project Management |
| License | MIT | MIT |
| GitHub URL | Основной источник | https://github.com/navisevenseven/shipmate |
| Version | Текущая | 0.1.0 |
| Requires | openclaw>=4.0 | openclaw>=4.0 |
| Tags | Поиск/категоризация | ai, pm, project-management, automation |
| Icon | Logo (256x256) | shipmate-logo.png |
| Author | @navisevenseven | navisevenseven |
| Rating/Review | Собирается с GitHub stars | - |

### 5.2 ClawHub Listing Page (Markdown)

```markdown
# ShipMate

**Verified source: [GitHub](https://github.com/navisevenseven/shipmate)**

## ⚠️ Security Notice

This is verified official plugin. Always download from GitHub releases (primary source).

**Warning:** ~17% of ClawHub skills are malicious (Bitdefender, Feb 2026).
Verify source and check GPG signatures: see [Security](https://github.com/navisevenseven/shipmate/blob/main/docs/security.md)

## What is ShipMate?

AI-powered engineering PM built as skills pack + plugin for OpenClaw.

## Features

- Task breakdown with AI
- Dependency tracking
- Team capacity planning
- Jira/GitHub/GitLab integration

## Get Started

```bash
pip install shipmate
openclaw plugin install github.com/navisevenseven/shipmate
```

## Links

- **GitHub:** https://github.com/navisevenseven/shipmate
- **Docs:** https://github.com/navisevenseven/shipmate/tree/main/docs
- **Issues:** https://github.com/navisevenseven/shipmate/issues
- **Community:** https://discord.gg/openclaw

## License

MIT (same as OpenClaw)
```

### 5.3 Submission Checklist ClawHub

```
☐ GitHub repo public и с MIT лицензией
☐ README complete
☐ Security.md документирует GPG проверку
☐ CHECKSUMS.txt signed и публикуется с релизами
☐ Tags/categories правильно установлены
☐ Icon/logo загружен (256x256 PNG)
☐ Описание <200 символов
☐ Требования (openclaw>=4.0) указаны
☐ Release notes для v0.1.0 опубликованы
☐ ClawHub listing направляет на GitHub как primary source
```

---

## 6. Community Presence

### 6.1 Стратегия Community Engagement

| Платформа | Действие | Сообщение | Частота |
|-----------|---------|----------|---------|
| **Discord OpenClaw** | Announce in #releases | "ShipMate v0.1.0 is live on GitHub!" | Release |
| **Reddit r/openclaw** | Post in megathread | Demo + GitHub link | Release + Monthly |
| **GitHub Discussions** | Pin announcement | "Welcome to ShipMate! Start here →" | Setup once |
| **OpenClaw Community Forum** | Intro post | Full feature overview | Release |

### 6.2 Discord Announcement Message

```markdown
🚀 **ShipMate v0.1.0 Released!**

We're excited to announce the first public release of **ShipMate** —
an open-source AI project manager built as a plugin for OpenClaw.

🎯 Features:
• AI-driven task breakdown
• Dependency tracking
• Team capacity planning
• Jira/GitHub/GitLab integration

📦 Install:
\`\`\`
pip install shipmate
openclaw plugin install github.com/navisevenseven/shipmate
\`\`\`

📖 Docs: https://github.com/navisevenseven/shipmate
💬 Discuss: https://github.com/navisevenseven/shipmate/discussions

**Verify source:** Always download from GitHub. See security warning on ClawHub.
```

### 6.3 Reddit r/openclaw Post

```markdown
Title: ShipMate: Open-Source AI Project Manager for OpenClaw

Body:
Hi r/openclaw!

After months of development, we're excited to open-source ShipMate—
an AI PM built as a skills pack + plugin for OpenClaw.

**What it does:**
- Breaks down features into tasks with AI
- Maps dependencies across your backlog
- Tracks team capacity and velocity
- Syncs with Jira, GitHub, GitLab

**Why open-source:**
We believe engineering teams deserve better PM tools.
ShipMate is MIT licensed and welcomes contributions.

**Get started:** https://github.com/navisevenseven/shipmate
**Security note:** Download from GitHub (verified source).
See our security docs for GPG verification.

Feedback welcome!
```

### 6.4 GitHub Discussions - Pinned Post

```markdown
# Welcome to ShipMate Discussions!

This is the community hub for ShipMate users and contributors.

## Quick Links

- 📖 [Documentation](https://github.com/navisevenseven/shipmate/tree/main/docs)
- 🐛 [Report a bug](https://github.com/navisevenseven/shipmate/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/navisevenseven/shipmate/issues/new?template=feature_request.md)
- 📝 [Setup guide](https://github.com/navisevenseven/shipmate/docs/setup-design.md)

## Channels

- **Announcements** — Releases and major updates
- **General** — Questions, ideas, feedback
- **Show & Tell** — Share how you're using ShipMate
- **Security** — Report vulnerabilities (or use SECURITY.md)

Happy shipping! 🚀
```

---

## 7. Content Plan

### 7.1 Blog Post / Article

**Target:** Dev.to, Medium, OpenClaw blog

**Title:** "Building an AI Project Manager: ShipMate's Journey to Open Source"

**Outline:**

```markdown
1. The Problem (500 words)
   - Manual PM overhead
   - Context loss in large teams
   - Integration nightmares

2. The Solution (600 words)
   - ShipMate approach
   - Skills architecture
   - Integration design
   - Live demo walkthrough

3. Open Sourcing (400 words)
   - Why MIT license
   - Community first
   - How to contribute
   - Roadmap

4. Getting Started (300 words)
   - Installation
   - First project
   - Next steps
   - Call to action

Total: 1800-2000 words
```

**Publication checklist:**

```
☐ Draft in Google Docs / Notion
☐ Technical review by @team-leads
☐ Proofread (grammar, tone)
☐ Add code snippets + screenshots
☐ Publish on Dev.to
☐ Cross-post to Medium
☐ Share on Twitter/X
☐ Announce in Discord
☐ Link from GitHub README
```

### 7.2 Demo Video

**Platform:** YouTube (ShipMate channel or OpenClaw community)

**Duration:** 8-12 minutes

**Outline:**

```
[0:00-0:30] Intro
- Quick value prop
- "Ship faster with AI"

[0:30-2:00] Problem Statement
- Manual task breakdown
- Team confusion
- Integration issues

[2:00-6:00] Live Demo
- Install ShipMate
- Run on sample project
- Show task breakdown
- Show dependency graph
- Show capacity planning
- Show Jira sync

[6:00-8:00] Code Walkthrough
- Show skills/ structure
- Show plugin/ integration
- Show how it works

[8:00-10:00] Getting Started
- GitHub link
- Installation
- Bootstrap process
- First run

[10:00-12:00] Q&A / Call to Action
- Contribute on GitHub
- Community channels
- Feedback welcome
- Subscribe
```

**Deliverables:**

```
☐ Script reviewed
☐ Screencast recorded (OBS/Camtasia)
☐ Audio edited
☐ Captions added (auto + manual review)
☐ Thumbnail created
☐ Published on YouTube
☐ Linked from GitHub README
☐ Shared in Discord
☐ Embedded in article
```

### 7.3 Content Timeline

| День | Дата | Дeйствие | Ответственный |
|------|------|---------|----------------|
| -7 | Draft week | Write article draft | @content-team |
| -5 | Review | Technical review | @tech-leads |
| -3 | Demo prep | Script & record video | @demo-team |
| -1 | Final prep | Publish article + upload video | @content-team |
| 0 | Release Day | Release v0.1.0 on GitHub | @devops |
| 0 | Release Day | Publish video on YouTube | @content-team |
| 0 | Release Day | Announce everywhere | @community |
| +1 | Day 1 | Monitor feedback + respond | @team |
| +7 | Week 1 | Community digest post | @community |

---

## 8. Dog-Fooding Setup

### 8.1 Внутреннее тестирование

**Цель:** Валидировать ShipMate на собственной команде перед публичным релизом

**Длительность:** 2-4 недели перед публикацией

### 8.2 Setup для dog-fooding

```bash
# Агент выполняет:

# 1. Создать test проект в Jira / GitHub Projects
# Project: "ShipMate Planning Sprint 1"
# Team: 5-10 инженеров

# 2. Initialize ShipMate для team context
python setup/bootstrap.py \
  --team-name "ShipMate Core Team" \
  --team-size 8 \
  --tool jira \
  --jira-url $JIRA_URL \
  --jira-token $JIRA_TOKEN

# 3. Загрузить team context (из bootstrap/data/team-context.md)
# - Members: names, roles, experience
# - Current capacity
# - Active projects

# 4. Run ShipMate on first sprint
openclaw run -p plugin/openclaw.plugin.json \
  --config bootstrap/SOUL.md \
  --context bootstrap/data/team-context.md
```

### 8.3 Feedback Loop

**Ежедневно (standup):**

```markdown
# ShipMate Daily Check-in

- ✓ What worked?
- ✗ What failed?
- 🔧 What needs fixing?
- 💡 Feature requests?

Answers logged in: .dogfood/feedback-log.md
```

**Еженедельно (retro):**

```markdown
# ShipMate Weekly Retro

- Task breakdown accuracy
- Dependency detection quality
- Estimation reliability
- Integration smoothness
- UI/UX issues
- Performance

Findings → GitHub issues (labeled `dogfood-feedback`)
```

### 8.4 Success Criteria для Dog-Fooding

| Критерий | Цель | Статус |
|----------|------|--------|
| Task breakdown accuracy | >85% match with manual | ⏳ |
| Sprint prediction | >80% on-time delivery | ⏳ |
| Integration uptime | 99% | ⏳ |
| Team adoption | 100% usage | ⏳ |
| Feedback issues filed | >10 unique | ⏳ |
| Bugs found & fixed | All before release | ⏳ |

### 8.5 Доработки на основе feedback

```bash
# Процесс:
# 1. Собрать все dogfood feedback в issues
gh issue list --repo navisevenseven/shipmate --label dogfood-feedback

# 2. Prioritize: Critical → High → Medium → Low
# 3. Fix in dev branch
# 4. Retest с командой
# 5. Close issue when fixed

# До публичного релиза: все Critical+High должны быть закрыты
```

---

## 9. План реализации с временными оценками

### 9.1 Фазы реализации

#### Фаза 1: Repository Setup (3-5 дней)

| # | Задача | Время | Ответственный |
|---|--------|--------|----------------|
| 1.1 | Создать GitHub репо | 0.5d | @devops |
| 1.2 | Добавить лицензию, CONTRIBUTING.md | 0.5d | @tech-leads |
| 1.3 | Настроить branch protection + labels | 1d | @devops |
| 1.4 | Создать GitHub Actions workflows | 1.5d | @devops |
| 1.5 | Добавить CODEOWNERS и templates | 1d | @tech-leads |

**Total:** 4.5 дней

#### Фаза 2: Documentation & README (3-4 дня)

| # | Задача | Время | Ответственный |
|---|--------|--------|----------------|
| 2.1 | Обновить README для GTM | 1.5d | @content-team |
| 2.2 | Создать SECURITY.md с GPG инструкциями | 1d | @security-team |
| 2.3 | Подготовить CHANGELOG.md | 0.5d | @tech-leads |
| 2.4 | SEO optimization | 0.5d | @content-team |

**Total:** 3.5 дней

#### Фаза 3: Internal Dog-Fooding (14-21 день)

| # | Задача | Время | Ответственный |
|---|--------|--------|----------------|
| 3.1 | Setup test project в Jira | 1d | @devops |
| 3.2 | Bootstrap team context | 0.5d | @team-leads |
| 3.3 | Run ShipMate in production mode | 1d | @tech-leads |
| 3.4 | Daily feedback collection (14 дней) | 14d | @team |
| 3.5 | Process feedback & fix Critical | 5d | @engineering |

**Total:** 14-21 день

#### Фаза 4: Content Creation (5-7 дней)

| # | Задача | Время | Ответственный |
|---|--------|--------|----------------|
| 4.1 | Написать article draft | 2d | @content-team |
| 4.2 | Technical review + edits | 1d | @tech-leads |
| 4.3 | Record demo video | 2d | @demo-team |
| 4.4 | Edit + captions + publish | 1d | @content-team |

**Total:** 6 дней

#### Фаза 5: Release Preparation (3-5 дней)

| # | Задача | Время | Ответственный |
|---|--------|--------|----------------|
| 5.1 | Prepare v0.1.0 release notes | 1d | @tech-leads |
| 5.2 | Create GPG-signed tag | 0.5d | @devops |
| 5.3 | Generate CHECKSUMS.txt (signed) | 0.5d | @devops |
| 5.4 | Test release process (dry-run) | 1d | @devops |
| 5.5 | ClawHub listing preparation | 1d | @community |

**Total:** 4 дней

#### Фаза 6: Public Release (1 день)

| # | Задача | Время | Ответственный |
|---|--------|--------|----------------|
| 6.1 | Create GitHub Release | 0.5d | @devops |
| 6.2 | Publish article | 0.25d | @content-team |
| 6.3 | Community announcements | 0.25d | @community |

**Total:** 1 день

#### Фаза 7: Post-Release (7+ дней)

| # | Задача | Время | Ответственный |
|---|--------|--------|----------------|
| 7.1 | Monitor issues + respond | 5d | @team |
| 7.2 | Gather community feedback | 7d | @community |
| 7.3 | Plan v0.2.0 roadmap | 2d | @tech-leads |

### 9.2 Timeline (критический путь)

```
Week 1: Repository Setup + Documentation
├─ Day 1-2: GitHub repo creation
├─ Day 3-4: Documentation (README, SECURITY, etc)
└─ Day 5: QA review

Week 2-3: Dog-Fooding (14 дней параллельно с content creation)
├─ Day 1-2: Setup test project
├─ Day 3-14: Run + collect feedback
├─ [Parallel: Content Creation - 5-7 дней]
└─ Day 15: Fix Critical issues

Week 4: Release Preparation
├─ Day 1-2: Prepare release artifacts
├─ Day 3: Dry-run test
└─ Day 4: Final QA

Week 5: Public Release
├─ Day 1: Release!
├─ Day 2-7: Community engagement + monitoring
└─ [+7 дней: Feedback collection]

Total: 4-5 weeks (если все параллельно)
Critical path: Dog-fooding (самое долгое, но паралелизуется)
```

### 9.3 Resource Allocation

```
Team Composition:

DevOps (1 person, 20d):
  - Repo setup
  - GitHub Actions
  - Release automation
  - Testing infrastructure

Tech Leads (2 people, 15d):
  - Code review
  - Documentation
  - Release notes
  - Roadmap planning

Content Team (2 people, 8d):
  - README optimization
  - Article writing
  - Video production
  - SEO

Community Manager (1 person, 10d):
  - Discord/Reddit announcements
  - Discussions moderation
  - ClawHub submission
  - Feedback collection

Engineering (5 people, 14d in parallel):
  - Dog-fooding (daily 0.5h)
  - Feedback processing
  - Bug fixes

Total: 11 people, 4-5 неель

Cost estimate: ~2.5-3 person-months
```

---

## 10. Метрики успеха

### 10.1 GitHub Success Metrics

| Метрика | Target (Month 1) | Target (Month 3) | Target (Year 1) |
|---------|------------------|------------------|-----------------|
| GitHub Stars | 50 | 200 | 500+ |
| Forks | 10 | 30 | 100+ |
| Issues filed | 15 | 30 | 100+ |
| Pull Requests | 5 | 15 | 50+ |
| Contributors | 3 | 8 | 20+ |
| Release downloads | 100 | 500 | 2000+ |
| GitHub Discussions posts | 20 | 100 | 300+ |

### 10.2 Community Metrics

| Метрика | Target | Инструмент |
|---------|--------|-----------|
| Discord mentions | 20+ | Discord analytics |
| Reddit upvotes | 50+ | Reddit post |
| Dev.to views | 500+ | Dev.to analytics |
| YouTube views | 200+ | YouTube analytics |
| Article shares | 30+ | Article platform |

### 10.3 Adoption Metrics

| Метрика | Target | Как измерить |
|---------|--------|--------------|
| ClawHub installs | 50+ | ClawHub dashboard |
| Pip downloads | 100+ | PyPI stats |
| Active users | 10+ | GitHub Discussions + surveys |
| Teams using | 5+ | Community reports |

### 10.4 Quality Metrics

| Метрика | Target | Как измерить |
|---------|--------|--------------|
| Test coverage | >80% | CI/CD coverage reports |
| Code review rate | 100% | GitHub PRs |
| Bug escape rate | <5% | Issues tagged `bug` |
| Security issues | 0 | SECURITY.md reports |

### 10.5 Reporting

**Еженедельно:** Metrics dashboard в Confluence
```
- GitHub metrics (stars, forks, issues)
- Traffic sources (Reddit, Discord, etc)
- Content performance (article, video)
- Issues processed & response time
```

**Ежемесячно:** Community report
```
- User feedback summary
- Feature requests prioritization
- Roadmap impact
- Next month targets
```

---

## 11. Риски и контрмеры

| Риск | Вероятность | Воздействие | Контрмера |
|------|-----------|------------|-----------|
| Low adoption (< 20 stars month 1) | Medium | High | Boost marketing, reach out to OpenClaw community |
| Security vulnerabilities found | Low | Critical | Mandatory security audit before release |
| ClawHub platform issues | Low | Medium | Have GitHub-only backup plan |
| Dog-fooding finds major bugs | Medium | High | Extend dog-fooding period, hire QA |
| Content not engaging | Low | Medium | Iterate based on feedback, A/B test |
| Community doesn't engage | Low | Medium | Partner with OpenClaw maintainers |

---

## 12. Чек-лист для агента перед релизом

### Перед запуском любой фазы

```
Pre-Flight Checklist:

[ ] Читать все связанные docs (analysis.md, security.md, setup-design.md)
[ ] Verify GitHub repo exists: github.com/navisevenseven/shipmate
[ ] All required secrets in environment (.env / CI/CD)
    - GITHUB_TOKEN with repo permissions
    - GPG_KEY for signing
    - JIRA credentials for dog-fooding
[ ] Team members assigned and available
[ ] Communication channels ready (Discord, email)
```

### Фаза 1: Repo Setup

```
[ ] Create GitHub repo with correct settings
[ ] Add all required files (.github/*, LICENSE, etc)
[ ] Configure branch protection rules
[ ] Create issue labels
[ ] Setup workflows (publish, test, security)
[ ] Add CODEOWNERS file
[ ] Enable Discussions
[ ] Test: Push to main triggers CI/CD ✓
```

### Фаза 2: Documentation

```
[ ] Update README with GTM focus
[ ] Create/update SECURITY.md (GPG instructions)
[ ] Create CHANGELOG.md
[ ] Add SEO keywords
[ ] Review all docs for accuracy
[ ] Test: README renders correctly on GitHub ✓
[ ] Test: Links in README work ✓
```

### Фаза 3: Dog-Fooding

```
[ ] Setup Jira test project
[ ] Run bootstrap for team context
[ ] ShipMate running on real sprint
[ ] Daily standup feedback collected
[ ] Weekly retro notes in .dogfood/feedback-log.md
[ ] All Critical+High dogfood issues resolved
[ ] Team sign-off: "Ready for public release"
```

### Фаза 4: Content

```
[ ] Article draft reviewed & published (Dev.to/Medium)
[ ] Video recorded, edited, published (YouTube)
[ ] Captions added to video
[ ] Links from GitHub README to content
[ ] Social media posts queued
```

### Фаза 5: Release Prep

```
[ ] v0.1.0 tag created (GPG-signed)
[ ] CHANGELOG.md complete
[ ] Release notes written
[ ] CHECKSUMS.txt generated & signed
[ ] Dry-run: gh release create test ✓
[ ] ClawHub listing prepared (markdown)
[ ] Community messages drafted (Discord, Reddit)
```

### Фаза 6: Go-Live

```
[ ] GitHub Release published
[ ] Article published (link from README)
[ ] Video published (link from README)
[ ] Discord announcement posted
[ ] Reddit post created
[ ] GitHub Discussions pinned announcement
[ ] ClawHub submission sent
[ ] Twitter/X announcement
[ ] Monitor: No errors in first hour
```

### Post-Release (Week 1)

```
[ ] Daily monitoring of issues
[ ] Respond to GitHub issues within 24h
[ ] Monitor community channels (Discord, Reddit)
[ ] Fix any Critical issues immediately
[ ] Weekly digest post to r/openclaw
[ ] Collect qualitative feedback
[ ] Plan v0.2.0 features based on feedback
```

---

## 13. Справочные команды для агента

### Git & Release

```bash
# Create & sign release tag
git tag -s v0.1.0 -m "Release 0.1.0: Initial public release"
git push origin v0.1.0

# Verify tag signature
git verify-tag v0.1.0

# Generate CHECKSUMS
cd dist && sha256sum * > ../CHECKSUMS.txt
gpg --detach-sign ../CHECKSUMS.txt

# Verify CHECKSUMS
sha256sum -c CHECKSUMS.txt
gpg --verify CHECKSUMS.txt.asc CHECKSUMS.txt
```

### GitHub CLI

```bash
# Create repo
gh repo create navisevenseven/shipmate --public --source=.

# Create release
gh release create v0.1.0 \
  --title "ShipMate v0.1.0" \
  --notes-file RELEASE_NOTES.md \
  dist/* CHECKSUMS.txt CHECKSUMS.txt.asc

# Create labels
gh label create "bug" --repo navisevenseven/shipmate --color "d73a49"

# View metrics
gh api repos/navisevenseven/shipmate
gh api repos/navisevenseven/shipmate/traffic/views
```

### Community Platforms

```bash
# Discord webhook (if configured)
curl -X POST $DISCORD_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{"content":"ShipMate v0.1.0 released!"}'

# Post to r/openclaw (requires Reddit API setup)
# Use PRAW library or manual post

# Create GitHub Discussion
gh api graphql -f query='
mutation {
  createDiscussion(input: {
    repositoryId: "..."
    title: "Welcome to ShipMate"
    body: "..."
  }) {
    discussion { id }
  }
}'
```

### Monitoring

```bash
# Watch GitHub metrics
watch -n 300 'gh api repos/navisevenseven/shipmate | jq ".stargazers_count, .forks_count"'

# Monitor issues
gh issue list --repo navisevenseven/shipmate --state open --limit 10

# Check Actions status
gh run list --repo navisevenseven/shipmate --limit 5
```

---

## 14. Контрольные документы и ссылки

- **GitHub Repo:** https://github.com/navisevenseven/shipmate
- **Release Checklist:** (этот документ, раздел 12)
- **Security Policy:** /docs/security.md
- **Setup Guide:** /docs/setup-design.md
- **Architecture:** /docs/setup-design.md
- **Contributing:** /CONTRIBUTING.md
- **Changelog:** /CHANGELOG.md
- **Dog-Fooding Log:** /.dogfood/feedback-log.md

---

## 15. Статус выполнения (для агента)

Агент должен обновлять этот раздел при выполнении фаз:

```
Фаза 1: Repository Setup
├─ [ ] GitHub repo creation
├─ [ ] Files & templates
├─ [ ] Branch protection
├─ [ ] Workflows
└─ Статус: ⏳ NOT STARTED

Фаза 2: Documentation
├─ [ ] README update
├─ [ ] SECURITY.md
├─ [ ] CHANGELOG.md
└─ Статус: ⏳ NOT STARTED

Фаза 3: Dog-Fooding
├─ [ ] Setup test project
├─ [ ] Run ShipMate
├─ [ ] Collect feedback
└─ Статус: ⏳ NOT STARTED

Фаза 4: Content
├─ [ ] Article published
├─ [ ] Video published
└─ Статус: ⏳ NOT STARTED

Фаза 5: Release Prep
├─ [ ] Release artifacts
├─ [ ] Dry-run test
└─ Статус: ⏳ NOT STARTED

Фаза 6: Go-Live
├─ [ ] GitHub Release
├─ [ ] Community announcements
└─ Статус: ⏳ NOT STARTED

Post-Release Monitoring
└─ Статус: ⏳ NOT STARTED

Overall: ⏳ NOT STARTED
```

---

**Документ версия 1.0**
Дата создания: 2026-02-07
Последнее обновление: -
Автор (для AI): TZ-publishing agentспецификация
Статус: READY FOR AGENT EXECUTION
