---
name: shipmate-devops
description: "Kubernetes cluster monitoring, pod status, log retrieval, deployment management, and cluster health checks."
metadata:
  { "openclaw": { "emoji": "🚀", "requires": { "bins": ["kubectl"] } } }
---

# DevOps — Kubernetes Operations

You help development teams monitor Kubernetes clusters, debug pod issues, check deployment status, and retrieve logs.

## When to use

- User asks about deployment status, pod health, or what's running in production
- User says: "что задеплоено?", "pod status", "logs", "restart", "rollout", "cluster health"
- User wants to debug a failing service or check infrastructure

## Context Management

kubectl output can be large. Follow these rules:

1. **Always limit output.** Use `--tail` for logs, `-o json | jq` for structured data
2. **Start with overview.** Get pod list first, then dive into specific pods
3. **Namespace awareness.** Always ask which namespace or check `data/team-context.md` for defaults
4. **Summarize raw output.** Don't dump full kubectl JSON into context — extract key fields

**Target: 3-5 kubectl calls per user request** (max 8 for complex debugging)

## Commands

### Cluster Health

```bash
# Quick cluster overview
kubectl cluster-info

# Node status
kubectl get nodes -o wide

# All namespaces summary
kubectl get pods --all-namespaces --field-selector=status.phase!=Running 2>/dev/null
```

### Pod Status

```bash
# List pods in namespace (default or from team-context)
kubectl get pods -n <namespace> -o json | jq '.items[] | {
  name: .metadata.name,
  status: .status.phase,
  ready: (.status.containerStatuses // [] | map(select(.ready)) | length),
  total: (.status.containerStatuses // [] | length),
  restarts: (.status.containerStatuses // [] | map(.restartCount) | add // 0),
  age: .metadata.creationTimestamp
}'

# Quick summary (one-liner)
kubectl get pods -n <namespace> -o wide
```

### Logs

```bash
# Recent logs (last 100 lines)
kubectl logs <pod-name> -n <namespace> --tail=100 --timestamps

# Logs from crashed container
kubectl logs <pod-name> -n <namespace> --previous --tail=50

# Logs with time filter
kubectl logs <pod-name> -n <namespace> --since=1h --tail=200

# Multi-container pod: specify container
kubectl logs <pod-name> -c <container-name> -n <namespace> --tail=100
```

### Deployments

```bash
# Deployment status
kubectl get deployments -n <namespace> -o json | jq '.items[] | {
  name: .metadata.name,
  ready: "\(.status.readyReplicas // 0)/\(.spec.replicas)",
  updated: .status.updatedReplicas,
  available: .status.availableReplicas,
  image: (.spec.template.spec.containers[0].image)
}'

# Rollout status (live)
kubectl rollout status deployment/<name> -n <namespace>

# Rollout history
kubectl rollout history deployment/<name> -n <namespace>

# Rollout restart (triggers new rollout with same config)
kubectl rollout restart deployment/<name> -n <namespace>
```

### Events & Debugging

```bash
# Recent events (for debugging crashes, scheduling issues)
kubectl get events -n <namespace> --sort-by='.lastTimestamp' | tail -20

# Describe pod (detailed status including conditions, events)
kubectl describe pod <pod-name> -n <namespace> | tail -40

# Resource usage (if metrics-server installed)
kubectl top pods -n <namespace> 2>/dev/null || echo "metrics-server not installed"
```

## Process

### 1. Determine namespace

Check `data/team-context.md` for configured namespaces. If not set, ask:
- "Which namespace? (e.g., production, staging, default)"

### 2. Get overview first

Always start with `kubectl get pods -n <namespace>` before diving into specifics.

### 3. Analyze and report

## Output Format

```markdown
## Cluster Status: <namespace>

### Pods
| Pod | Status | Ready | Restarts | Age |
|-----|--------|-------|----------|-----|
| api-server-0 | Running | 1/1 | 0 | 5d |
| worker-abc123 | CrashLoopBackOff | 0/1 | 15 | 2h |

### Warnings
- **CrashLoopBackOff**: worker-abc123 — container restarting repeatedly
  - Last log: `Error: connection refused to postgres:5432`
  - Action: Check database connectivity

### Deployments
| Deployment | Ready | Image | Last Update |
|------------|-------|-------|-------------|
| api-server | 2/2 | app:v1.2.3 | 3d ago |
| worker | 0/1 | app:v1.2.3 | 2h ago |

### Recommendations
- Investigate worker pod crash (database connectivity)
- Consider scaling api-server if traffic increases
```

## Fallback Behavior

- If `kubectl` is not installed: "DevOps skill requires kubectl. Install it and make sure your kubeconfig is configured."
- If cluster is unreachable: "Cannot connect to Kubernetes cluster. Check your KUBECONFIG environment variable or VPN connection."
- If namespace not found: "Namespace '<name>' not found. Available namespaces: <list>"
- If metrics-server not installed: skip resource usage, note "metrics unavailable"
- Always tell the user what's missing and how to fix it

## Safety Rules

- **Never run destructive commands** (`kubectl delete`, `kubectl edit`) without explicit user approval
- **Rollout restart is safe** — it redeploys with the same config. Confirm with user before executing.
- **Never expose secrets** — don't run `kubectl get secrets` with `-o yaml` or show secret values
- **Log filtering** — if logs contain sensitive data (tokens, passwords), warn the user
- **Read-only by default** — only `get`, `describe`, `logs`, `top` commands are safe to run freely
