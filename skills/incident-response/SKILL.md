---
name: shipmate-incident-response
description: "Incident triage and response: Sentry error analysis, Grafana alert monitoring, severity classification, runbook suggestions, and post-mortem templates."
metadata:
  { "openclaw": { "emoji": "🚨" } }
---

# Incident Response

You help the team detect, classify, and respond to production incidents using Sentry and Grafana data.

## When to use

- User asks about production errors, alerts, or incidents
- User says: "incident", "alert", "on-call", "инцидент", "алерт", "упало", "ошибки в Sentry", "что горит", "Grafana alerts"
- User shares a Sentry issue link or Grafana alert
- User asks for a post-mortem or incident summary

## Plugin Tools (preferred)

If the ShipMate plugin is installed, **prefer plugin tools over curl**:

- **Sentry:** use `sentry_issues` tool for unresolved errors and stacktraces
- **Grafana:** use `grafana_alerts` tool for active alerts, rules, and annotations
- **Jira:** use `jira_search` tool to check for existing incident tickets

Check if these tools are available in your tool list. If not, fall back to curl commands below.

### Fallback: Sentry via curl

```bash
# Unresolved issues (last 24h)
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "$SENTRY_URL/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/issues/?query=is:unresolved+age:-24h&sort=date&limit=10" | jq '.[] | {id, title, culprit, level, count, lastSeen: .lastSeen}'

# Issue details + latest event with stacktrace
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "$SENTRY_URL/api/0/issues/<ISSUE_ID>/events/latest/" | jq '{title, message, dateCreated, entries: [.entries[] | select(.type == "exception")]}'
```

### Fallback: Grafana via curl

```bash
# Active alerts
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
  "$GRAFANA_URL/api/alertmanager/grafana/api/v2/alerts" | jq '.[] | {alertname: .labels.alertname, state: .status.state, startsAt}'

# Alert rules
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
  "$GRAFANA_URL/api/ruler/grafana/api/v1/rules" | jq 'to_entries[] | .value[][] | .rules[] | {title: .grafana_alert.title, state: .grafana_alert.state}'
```

## Process

### 1. Gather data

Collect information from all available sources in parallel:

1. **Sentry** — `sentry_issues` with `time_range=1h` (recent errors first)
2. **Grafana** — `grafana_alerts` with `state=firing` (active alerts)
3. **Jira** — `jira_search` with query `type = Bug AND status != Done AND priority in (Highest, High)` (existing incidents)

If a source is unavailable, note it and continue with what's accessible.

### 2. Classify severity

Based on collected data, classify the incident:

| Severity | Criteria | Response |
|----------|----------|----------|
| **P1 — Critical** | Production down, revenue impact, data loss, >50% users affected | Immediate response, all hands, status page update |
| **P2 — Major** | Degraded performance, partial outage, key feature broken, error rate spike >5x | 30-min response, on-call + team lead |
| **P3 — Minor** | Isolated errors, non-critical feature affected, single user reports | 4-hour response, next business day fix |
| **P4 — Warning** | Warning-level alerts, minor anomalies, trend changes | Monitor, address in next sprint |

**Classification signals:**
- Sentry: error count spike, new error types, fatal level errors
- Grafana: firing alerts count, alert duration, affected services
- Error rate vs baseline (if `data/team-context.md` has baseline metrics)

### 3. Suggest response actions

Based on severity and error patterns, suggest a runbook:

**For common patterns:**

| Error Pattern | Suggested Actions |
|---------------|-------------------|
| Connection refused / timeout to DB | Check DB pod status (`kubectl`), check connection pool, check recent migrations |
| OOM / memory spike | Check pod resources (`kubectl top`), look for memory leaks in recent PRs, consider rollback |
| 5xx spike on specific endpoint | Check recent deployments, review latest merged PRs for that service, check downstream deps |
| Auth/token errors | Check token expiry, verify secrets rotation, check identity provider status |
| Queue backlog growing | Check consumer pods, check for stuck jobs, scale consumers |

### 4. Check for duplicates

Before creating a new incident ticket:

1. Search Jira for similar issues: `jira_search` with keywords from the error title
2. Check if there's an existing open incident for the same service
3. If duplicate found — add a comment with new data instead of creating a new ticket

### 5. Create incident ticket (if needed)

If no duplicate exists and severity is P1-P3, offer to create a Jira ticket:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/issue" \
  -d '{
    "fields": {
      "project": {"key": "<PROJECT_KEY>"},
      "summary": "[P<N>] <Service> — <Error Title>",
      "description": {"type": "doc", "version": 1, "content": [...]},
      "issuetype": {"name": "Bug"},
      "priority": {"name": "<High|Highest>"},
      "labels": ["incident"]
    }
  }'
```

Always ask the user before creating a ticket.

## Output Format

```markdown
## Incident Report

**Severity:** P<1-4> — <Critical/Major/Minor/Warning>
**Time:** <timestamp>
**Affected Services:** <list>

### Active Alerts
| Source | Alert | State | Since | Details |
|--------|-------|-------|-------|---------|
| Sentry | <error title> | error (x<count>) | <last_seen> | <culprit> |
| Grafana | <alert name> | firing | <activeAt> | <annotation> |

### Error Analysis
- **Root cause hypothesis:** <based on stacktrace and alert correlation>
- **Blast radius:** <which users/features are affected>
- **Trend:** <new error vs recurring, count trajectory>

### Recommended Actions
1. **Immediate:** <what to do right now>
2. **Investigate:** <what to check next>
3. **Mitigate:** <rollback / feature flag / scale>

### Existing Tickets
- <PROJ-123> — <similar issue title> (status: <status>)
- Or: "No existing tickets found — create one?"

### Post-Mortem Template (P1/P2 only)
<Offer to generate if severity warrants>
```

### Post-Mortem Template

When requested (or automatically for P1 incidents), offer this template:

```markdown
## Post-Mortem: <Incident Title>
**Date:** <date>
**Duration:** <start> — <end> (<total>)
**Severity:** P<N>
**Author:** <team member>

### Summary
<1-2 sentences: what happened, what was the impact>

### Timeline
| Time | Event |
|------|-------|
| HH:MM | Alert fired: <details> |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Monitoring confirmed recovery |

### Root Cause
<What actually caused the incident>

### Impact
- Users affected: <number/percentage>
- Duration: <minutes/hours>
- Revenue impact: <if applicable>

### What Went Well
- <what worked in the response>

### What Went Wrong
- <what could have been better>

### Action Items
| Action | Owner | Deadline |
|--------|-------|----------|
| <fix description> | <person> | <date> |
```

## Fallback Behavior

- If Sentry is not configured: "Sentry is not connected. Set SENTRY_URL, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT to enable error tracking."
- If Grafana is not configured: "Grafana is not connected. Set GRAFANA_URL and GRAFANA_TOKEN to enable alert monitoring."
- If both are unavailable: "No monitoring tools configured. I can still help with incident response if you paste error details or alert messages."
- If Jira is unavailable: skip duplicate check and ticket creation, note that Jira is not configured

## Rules

- Never dismiss alerts — every firing alert deserves acknowledgment
- Correlate across sources: Sentry error spike + Grafana alert = likely same incident
- Time-correlate: group errors and alerts that started within the same 5-minute window
- Be specific about blast radius — "some users" is not helpful, use data
- Always suggest checking recent deployments as a potential cause
- For P1: bias toward quick mitigation (rollback, feature flag) over debugging
- For P3/P4: bias toward investigation and planned fix over emergency response
- Keep total API calls under 10 per incident triage
