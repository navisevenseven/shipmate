---
name: shipmate-devops-docker
description: "Docker container monitoring, compose operations, image analysis, build troubleshooting, and container debugging."
metadata:
  { "openclaw": { "emoji": "🐳", "requires": { "bins": ["docker"] } } }
---

# DevOps — Docker Operations

You help development teams monitor Docker containers, debug compose services, analyze images, and troubleshoot build issues.

## When to use

- User asks about container status, Docker logs, or compose services
- User says: "docker", "контейнер", "container", "compose", "образ не собирается", "container crash", "docker logs", "docker-compose", "что запущено"
- User wants to debug a failing container or check service health

**Related skills:** For K8s cluster operations → `../devops-k8s/SKILL.md`. For CI/CD pipeline issues → `../devops-cicd/SKILL.md`.

## team-context.md Fields

Check `data/team-context.md` for:

```
## Docker Config
- compose_version: v2 | v1
- default_compose_file: docker-compose.yml
- registry_url: <private registry if any>
```

## Docker Compose Version Detection

At the start of any compose operation, detect the available version:

```bash
docker compose version 2>/dev/null && echo "v2" || (docker-compose --version 2>/dev/null && echo "v1" || echo "none")
```

- **v2 available:** Use `docker compose` (subcommand) — this is the modern standard
- **v1 only:** Fall back to `docker-compose` (hyphenated binary)
- **Neither:** Note in output: "Docker Compose not available. Only standalone container commands are supported."

Use the detected version consistently throughout the session. All examples below use v2 syntax (`docker compose`).

## Context Management

Docker output can be large. Follow these rules:

1. **Always limit output.** Use `--tail` for logs, `--format` or `| jq` for structured data
2. **Start with overview.** Get container list first, then dive into specific containers
3. **Summarize raw output.** Don't dump full inspect JSON into context — extract key fields
4. **Timestamps matter.** Always use `--timestamps` with logs for debugging

**Target: 3-5 commands per request** (max 8 for complex debugging)

## Commands

### Container Status

```bash
# Running containers (overview)
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'

# All containers including stopped
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.CreatedAt}}'

# Compose services status
docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'

# Resource usage (CPU, memory — snapshot)
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}'
```

### Logs

```bash
# Recent logs (last 100 lines with timestamps)
docker logs <container> --tail 100 --timestamps

# Compose service logs
docker compose logs <service> --tail 100 --timestamps

# Logs since specific time
docker logs <container> --since 1h --tail 200

# Follow logs (for live debugging — use sparingly, always with --tail)
# docker logs <container> --follow --tail 50
```

### Container Debugging

```bash
# Container details (extract key fields)
docker inspect <container> | jq '.[0] | {
  State: .State,
  Image: .Config.Image,
  Created: .Created,
  RestartPolicy: .HostConfig.RestartPolicy,
  Env: [.Config.Env[] | select(test("PASSWORD|SECRET|TOKEN|KEY") | not)],
  Ports: .NetworkSettings.Ports,
  Mounts: [.Mounts[] | {Source, Destination, Type}]
}'

# Container health check status
docker inspect <container> | jq '.[0].State.Health'

# Processes inside container
docker top <container>

# Network details
docker network ls --format 'table {{.Name}}\t{{.Driver}}\t{{.Scope}}'
docker network inspect <network> | jq '.[0].Containers | to_entries[] | {name: .value.Name, ip: .value.IPv4Address}'
```

### Image Analysis

```bash
# Local images
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}'

# Image details
docker image inspect <image> | jq '.[0] | {
  Size: (.Size / 1048576 | floor | tostring + "MB"),
  ExposedPorts: .Config.ExposedPorts,
  Cmd: .Config.Cmd,
  Entrypoint: .Config.Entrypoint,
  WorkDir: .Config.WorkingDir
}'

# Image layers (for debugging build issues)
docker history <image> --format 'table {{.CreatedBy}}\t{{.Size}}' --no-trunc | head -20
```

### Build Troubleshooting

```bash
# Build with full output (for debugging)
docker build --progress=plain . 2>&1 | tail -50

# Compose build specific service
docker compose build --no-cache <service> 2>&1 | tail -50

# Build with specific Dockerfile
docker build -f Dockerfile.dev --progress=plain . 2>&1 | tail -50
```

## Troubleshooting Patterns

| Symptom | Diagnosis Steps | Common Causes |
|---------|----------------|---------------|
| **Container exits immediately** | Check exit code: `docker inspect <c> \| jq '.[0].State'`, then logs | Missing CMD/ENTRYPOINT, env var not set, dependency not ready |
| **Container in restart loop** | Check `RestartCount` and logs for crash reason | OOM kill, unhandled exception, dependency failure |
| **Port conflict** | `docker port <container>`, check host port bindings | Another process or container using same port |
| **Build fails** | `docker build --progress=plain` for full output | Dependency resolution, network issues in build, wrong base image |
| **Compose service can't reach another** | `docker compose exec <svc> ping <other-svc>` | Service not in same network, DNS not ready, service not healthy |
| **Slow container** | `docker stats --no-stream` for resource usage | CPU/memory limits too low, I/O bottleneck, inefficient code |
| **Image too large** | `docker history <image>` for layer analysis | No multi-stage build, large base image, unnecessary files copied |

### Docker Best Practices Checklist (for PM awareness)

When reviewing Docker-related issues, check:

- [ ] Multi-stage builds used (smaller images)
- [ ] Non-root user in Dockerfile
- [ ] Health checks defined
- [ ] `.dockerignore` present
- [ ] Specific image tags (not `latest`)
- [ ] Secrets not in image layers
- [ ] Resource limits set in compose

## Output Format

```markdown
## Docker Status: <project/directory>

### Running Services
| Service | Status | Ports | Image | CPU | Memory |
|---------|--------|-------|-------|-----|--------|
| api | Up 2h (healthy) | 8080:8080 | app:latest | 2.5% | 128MB |
| postgres | Up 2h (healthy) | 5432:5432 | postgres:15 | 0.5% | 64MB |
| worker | Restarting (3) | — | app:latest | 0% | 0MB |

### Issues
- **worker** — restart loop (3 restarts)
  - Exit code: 137 (OOM killed)
  - Last log: `JavaScript heap out of memory`
  - Action: Increase memory limit in docker-compose.yml (`mem_limit: 512m`)

### Recommendations
- Worker container is OOM-killed — current limit likely too low
- Consider adding health checks to worker service
- Image uses `latest` tag — pin to specific version for reproducibility
```

## Fallback Behavior

- If `docker` not installed: "Docker CLI not installed. Install Docker to enable container monitoring."
- If `docker compose` (v2) not available: fall back to `docker-compose` (v1). Note: "Using legacy docker-compose. Consider upgrading to Docker Compose v2."
- If neither compose version available: "Docker Compose not available. I can only monitor standalone containers."
- If Docker daemon not running: "Docker daemon is not running. Start Docker Desktop or the Docker service."
- If no containers running: "No containers found. Is the project running? Try `docker compose up -d`."

## Safety Rules

- **Read-only by default.** Only `ps`, `logs`, `inspect`, `stats`, `top`, `images`, `history`, `network ls/inspect` are safe
- **Restart requires confirmation:** `docker restart`, `docker compose restart` — ask user first
- **Never run destructive commands** without explicit approval: `docker rm`, `docker rmi`, `docker system prune`, `docker compose down`
- **Never expose secrets.** Filter environment variables: exclude anything matching PASSWORD, SECRET, TOKEN, KEY from inspect output
- **Build commands are safe** but can be long-running — warn the user about potential duration
- **Context budget:** Never keep more than 50 lines of log output in context. Summarize and discard
