# ТЗ: Ресерч стека команды для ShipMate MVP

## Контекст

**ShipMate** — open-source AI PM для команд разработки. Skills pack + plugin для OpenClaw. Живёт в командном чате, анализирует MR/PR, трекает спринты, помогает планировать фичи, ревьюит архитектуру.

MVP = набор skills (SKILL.md), которые работают через CLI-инструменты (`glab`, `gh`, `jira-cli`, `git` и т.д.) без кастомного кода.

## Цель

Составить **полный список сервисов** команды, которые ShipMate будет интегрировать в MVP. Для каждого сервиса определить: что именно ShipMate из него берёт, каким CLI/API это достигается, и какой приоритет для MVP.

---

## Результаты ресерча (07.02.2026)

**Источник данных:** Jira (проект `CD` — "CHC - DevOps", 560+ задач), задачи проектов CPAYMENT, CHCSER2, VOCXOD, CADM2, CPLA, BETRUN.

### Ответы на ключевые вопросы

1. **CI/CD** — **GitLab CI/CD** (единственный). Jenkins не используется. Есть свои CI runners (CD-209). Claude Code интеграция в CI планируется (CD-560). AI MR Review уже работает (CD-519).
2. **GitLab** — **self-hosted** (не SaaS). Мигрировали с Bitbucket (CD-198). Есть группа репозиториев `infra` (CD-553). GitLab интегрирован с Jira (CD-503).
3. **Jira** — **Cloud** (`chcspace.atlassian.net`). Проекты: CD (DevOps), CPAYMENT, CADM2, CHCSER2, VOCXOD, CPLA, BETRUN.
4. **Docker Registry** — скорее всего **GitLab Container Registry** (не упоминается отдельный). Docker образы собираются в pipeline (CD-543).
5. **НЕ найдены** — Vault, Nexus, SonarQube, ArgoCD, Terraform. Команда их не использует.
6. **Elasticsearch** — НЕ подтверждён в Jira. Возможно, не используется или заменён Loki.

---

## Полный список сервисов

### Code Hosting & VCS

| Сервис | Детали | Источник Jira | Статус |
|--------|--------|---------------|--------|
| **GitLab** (self-hosted) | Основной. MRs, pipelines, runners, Container Registry. Мигрировали с Bitbucket | CD-198, CD-391, CD-503, CD-544, CD-553 | Подтверждён |
| **GitHub** | Для open-source проектов | — | Подтверждён (для ShipMate OSS) |
| **Bitbucket** | Legacy, мигрировали. Могут быть остатки | CD-198, CD-540 | Deprecated |

### CI/CD

| Сервис | Детали | Источник Jira | Статус |
|--------|--------|---------------|--------|
| **GitLab CI/CD** | Единственный CI/CD. Pipelines, runners, переменные | CD-544, CD-545, CD-560, CD-507, CD-489, CD-294 | Подтверждён |
| **AI MR Review** | review-gitlab-mr, ищут замену поосновательнее | CD-519, CD-541 | Подтверждён |

### Infrastructure & Hosting

| Сервис | Детали | Источник Jira | Статус |
|--------|--------|---------------|--------|
| **Scaleway** | Основной cloud. Kubernetes (Kapsule), RDB, Cockpit. Org: `a1d23a62-...`, регион `fr-par` | CD-332, CD-559, CD-431, CD-552 | Подтверждён |
| **Zomro** | Legacy VPS. Мигрируют | CD-257, CD-426, CD-4 | Deprecated |
| **AWS CloudFront** | Планируется для фронта + RUM | CD-509 | Backlog |
| **Reg.ru** | Прокси в РУ зоне для витрины и платежной страницы | CD-510, CD-530 | Подтверждён |

### Containers & Orchestration

| Сервис | Детали | Источник Jira | Статус |
|--------|--------|---------------|--------|
| **Docker** | Сборка образов, деплой | CD-543, CD-540 | Подтверждён |
| **Kubernetes** (Scaleway Kapsule) | Продакшен оркестрация. Доступ через kubeconfig | CD-332, CD-552, CD-486, CD-359 | Подтверждён |
| **Helm** | Чарты для деплоя, хранятся в GitLab | CD-369 | Подтверждён |

### Databases

| Сервис                        | Детали                                        | Источник Jira                  | Статус      |
| ----------------------------- | --------------------------------------------- | ------------------------------ | ----------- |
| **PostgreSQL** (Scaleway RDB) | Основная БД. Read-only реплики, ACL настройка | CD-559, CD-469, CD-467, CD-513 | Подтверждён |
| **MongoDB**                   | Планируется миграция на Scaleway              | CD-259                         | Backlog     |
| **ClickHouse**                | Для gamelogs                                  | CD-160                         | Подтверждён |

### Message Queue

| Сервис | Детали | Источник Jira | Статус |
|--------|--------|---------------|--------|
| **RabbitMQ** | В Kubernetes. Управление доступами, admin UI | CD-261, CD-518, CD-551, CD-511 | Подтверждён |

### Monitoring & Logging

| Сервис | Детали | Источник Jira | Статус |
|--------|--------|---------------|--------|
| **Grafana** | Дашборды (infra + php-fpm). Instance: `test-grafana.chcadmin.net` | CD-69, CD-459, CD-497, CD-456 | Подтверждён |
| **Prometheus** | Сбор метрик | CD-69 | Подтверждён |
| **InfluxDB** | Time-series данные, Telegraf agent | CD-69 | Подтверждён |
| **Loki** | Агрегация логов | CD-185, CD-497, CPAYMENT-490 | Подтверждён |
| **Promtail / Grafana Alloy** | Отправка логов в Loki. Alloy — замена Promtail | CD-438, CD-359, CD-456 | Подтверждён |
| **Scaleway Cockpit** | Метрики php-fpm | CD-431 | Подтверждён |
| **Sentry** (self-hosted) | Ошибки. TG Bot для уведомлений. Прокси трафик | CD-527, CD-373, CPAYMENT-983, CADM2-376 | Подтверждён |

### Networking & Security

| Сервис | Детали | Источник Jira | Статус |
|--------|--------|---------------|--------|
| **NGINX** | Reverse proxy в k8s | CD-468, CD-495 | Подтверждён |
| **CloudFlare** | CDN/proxy на доменах | CD-443 | Подтверждён |
| **SSL** (auto-renewal) | Автообновление сертификатов | CD-550 | Подтверждён |

### Communication

| Сервис | Детали | Источник Jira | Статус |
|--------|--------|---------------|--------|
| **Telegram** | Боты: Sentry events, уведомления, кассир | CD-373, CD-520, CD-330 | Подтверждён |
| **Slack** | — | — | Подтверждён (через OpenClaw) |

### Project Management & Docs

| Сервис         | Детали                                                                                | Источник Jira | Статус       |
| -------------- | ------------------------------------------------------------------------------------- | ------------- | ------------ |
| **Jira Cloud** | `chcspace.atlassian.net`. Проекты: CD, CPAYMENT, CADM2, CHCSER2, VOCXOD, CPLA, BETRUN | —             | Подтверждён  |
| **Confluence** | Wiki, документация                                                                    | —             | Подтверждён  |
| **Docusaurus** | Hub-документация                                                                      | CD-557        | В разработке |

---

## Формат результата — ShipMate MVP

| Сервис | Что ShipMate берёт | CLI/API | Приоритет MVP |
|--------|--------------------|---------|---------------|
| **GitLab** | MRs (diff, статус, ревьюеры), branches, Container Registry | `glab` CLI | **P0** |
| **GitLab CI/CD** | Pipeline status, jobs, logs, переменные окружения | `glab ci` CLI | **P0** |
| **GitHub** | PRs, issues, actions | `gh` CLI | **P0** |
| **Jira** | Спринты, задачи, статусы, борды, линки к MRs | `jira-cli` или REST API | **P0** |
| **Confluence** | Wiki-страницы, документация проектов | REST API | **P1** |
| **Sentry** | Ошибки, issues, traces, releases | REST API / `sentry-cli` | **P1** |
| **Kubernetes** | Pod status, logs, rollout status, deployments (devops skill) | `kubectl` | **P1** |
| **Grafana** | Дашборды, алерты, метрики | REST API | **P2** |
| **Loki** | Запросы логов, поиск ошибок | LogQL API (через Grafana) | **P2** |
| **RabbitMQ** | Queue stats, consumers | Management API | **P2** |
| **Telegram** | Уведомления, команды | Bot API (через OpenClaw) | **P0** (OpenClaw) |
| **Slack** | Уведомления, команды | Bot API (через OpenClaw) | **P0** (OpenClaw) |

### Не нужны для ShipMate MVP

| Сервис | Причина |
|--------|---------|
| Docker | Сборка образов происходит в GitLab CI — ShipMate видит это через pipelines |
| Helm | Операции деплоя — не задача PM. Для понимания что задеплоено — kubectl достаточно |
| PostgreSQL / MongoDB / ClickHouse | Прямой доступ к БД не нужен |
| Keycloak | Auth-система, не релевантна для PM |
| NGINX / CloudFlare / SSL | Не отдельная интеграция, но топология описана в `data/team-context.md`: CloudFlare -> NGINX ingress -> K8s pods. Используется в system-design и incident analysis |
| Scaleway | Cloud management — задача DevOps. Cockpit покрывается через Grafana (P2) |
| Prometheus / InfluxDB | Низкоуровневые метрики, доступ через Grafana |

### Решения по приоритетам

**Kubernetes поднят до P1** — продакшен на Scaleway Kapsule. PM-у критично знать: "что задеплоено?", "почему сервис лежит?", "прошёл ли rollout?". Команды `kubectl get pods`, `kubectl logs`, `kubectl rollout status` — это delivery visibility, прямая задача PM. Оформляется как devops skill.

**GitLab CI/CD выделен отдельной строкой P0** — pipeline status ("зелёный/красный") это ключевой сигнал для "успеваем ли мы". В исходной таблице был смешан с GitLab (code hosting). Разделение позволяет: (1) отдельный skill для CI/CD, (2) чёткий scope — `glab ci` для pipelines vs `glab mr` для MRs.

**NGINX / CloudFlare / SSL — не интеграция, а знание** — ShipMate не вызывает их API, но должен знать топологию сети (CloudFlare -> NGINX ingress -> K8s pods) для system-design ревью и разбора инцидентов. Это контекст в `data/team-context.md`, а не отдельный skill.

**Scaleway Cockpit покрывается Grafana** — метрики php-fpm доступны через Grafana дашборды. Отдельная интеграция с Scaleway API для PM не нужна.

**Prometheus / InfluxDB — доступ через Grafana** — низкоуровневые data sources. ShipMate обращается к Grafana API, который уже агрегирует данные из всех источников.

---

