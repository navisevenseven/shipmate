# Team Context

> This file stores long-term facts about the team and project.
> ShipMate reads it at session start for persistent context.
> Update this file when team composition or conventions change.

## Project

- **Repository**: <!-- e.g., gitlab.company.com/group/repo or github.com/org/repo -->
- **Platform**: <!-- gitlab | github | both -->
- **Language/Stack**: <!-- e.g., TypeScript, Python, Go -->
- **Architecture**: <!-- e.g., monolith, microservices -->

## Team Members

<!-- Add team members so ShipMate can reference them by name -->

| Name | Handle | Platform | Role / Expertise |
|------|--------|----------|------------------|
| <!-- Alice --> | <!-- @alice --> | <!-- GitLab --> | <!-- Backend, API design --> |
| <!-- Bob --> | <!-- @bob --> | <!-- GitHub --> | <!-- Frontend, React --> |

## Sprint Conventions

- **Sprint length**: <!-- e.g., 2 weeks -->
- **Sprint naming**: <!-- e.g., Jira sprints, GitHub Milestones, GitLab Milestones, or date-based -->
- **Estimation**: <!-- e.g., T-shirt sizes, story points, none -->
- **Stand-up**: <!-- e.g., async in Slack, daily sync -->

## Branch & PR/MR Conventions

- **Branch naming**: <!-- e.g., feat/*, fix/*, chore/* -->
- **PR/MR template**: <!-- yes/no, where -->
- **Required reviewers**: <!-- e.g., 1 approval, CODEOWNERS -->
- **CI required to merge**: <!-- yes/no -->

## GitLab Configuration

- **GitLab Host**: <!-- e.g., gitlab.company.com -->
- **GitLab Project IDs**: <!-- e.g., 42, 123 (comma-separated) -->
- **Default Project ID**: <!-- primary project for glab commands -->

## GitHub Configuration

- **GitHub Repos**: <!-- e.g., org/repo1, org/repo2 -->
- **Default Repo**: <!-- primary repo for gh commands -->

## Jira Configuration

- **Jira Instance**: <!-- e.g., yourorg.atlassian.net -->
- **Jira Project Key**: <!-- e.g., PROJ, CD, SHIP -->
- **Jira Board ID**: <!-- numeric board ID for sprint queries -->
- **Story Points Field**: <!-- e.g., customfield_10016 (default Jira Cloud) -->

## Kubernetes Configuration

- **Cluster Name**: <!-- e.g., production-kapsule -->
- **Default Namespace**: <!-- e.g., production -->
- **Namespaces**: <!-- e.g., production, staging, dev -->
- **Key Deployments**: <!-- e.g., api-server, worker, frontend -->

## Monitoring & Observability

- **Sentry Project**: <!-- e.g., my-project -->
- **Sentry Org**: <!-- e.g., my-org -->
- **Grafana URL**: <!-- e.g., https://grafana.company.com -->
- **Key Dashboards**: <!-- e.g., API latency, DB performance -->

## Infrastructure Topology

<!-- Help ShipMate understand the network layout for system-design and incident analysis -->

```
<!-- Example:
CloudFlare -> NGINX Ingress -> K8s Pods
                              ├── api-server (3 replicas)
                              ├── worker (2 replicas)
                              └── frontend (2 replicas)
Database: Scaleway RDB (PostgreSQL)
Cache: Redis (in-cluster)
Queue: RabbitMQ (in-cluster)
-->
```

## Key Directories

<!-- Help ShipMate navigate the codebase -->

| Directory | What lives here |
|-----------|----------------|
| <!-- src/api/ --> | <!-- API endpoints --> |
| <!-- src/core/ --> | <!-- Business logic --> |
| <!-- tests/ --> | <!-- Test suite --> |
| <!-- deploy/ --> | <!-- Helm charts, K8s manifests --> |
| <!-- docs/ --> | <!-- Project documentation --> |
