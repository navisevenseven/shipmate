# ShipMate v0.3.0 — Infrastructure & Dog-fooding

## Highlights

- Docker sandbox image for secure team chat deployment
- Production Docker image with OpenClaw + ShipMate (multi-stage build)
- Railway one-click deployment template
- Docker Compose for local dog-fooding
- CI/CD pipeline for automated Docker image builds (GHCR)

## Docker Images

### Sandbox (`Dockerfile.sandbox`)

Lightweight container with CLI tools for OpenClaw sandbox mode. OpenClaw mounts the target project and executes agent bash commands inside this container — providing filesystem isolation.

```bash
docker pull ghcr.io/navisevenseven/shipmate-sandbox:latest
```

Includes: `git`, `gh` (GitHub CLI), `glab` (GitLab CLI), `jq`, `curl`, `kubectl`

### Production (`Dockerfile`)

Full self-hosted deployment: OpenClaw gateway + ShipMate skills + plugin + CLI tools.

```bash
docker pull ghcr.io/navisevenseven/shipmate:latest
```

## Deployment

### Docker Compose (local)

```bash
cp .env.example .env
# Fill in SHIPMATE_WORKSPACE and tokens
docker compose up -d
```

### Railway (cloud)

1. Connect GitHub repo to Railway
2. Set environment variables
3. Deploy

## Dog-fooding

See [docs/dogfooding.md](docs/dogfooding.md) for the 2-4 week internal testing checklist.

## What's Next

- **Phase 4:** ClawHub listing, community launch, public release
- Content: articles, demo videos
- Community posts (Show HN, Reddit, Product Hunt)

## Previous Releases

- [v0.2.0](https://github.com/navisevenseven/shipmate/releases/tag/v0.2.0) — TypeScript Plugin (5 tools, caching, rate limiting)
- [v0.1.0](https://github.com/navisevenseven/shipmate/releases/tag/v0.1.0) — Skills Pack MVP (6 skills, CLI integrations)

## Downloads

- Source code (zip)
- Source code (tar.gz)
- CHECKSUMS.txt (GPG-signed)

## Verify

```bash
sha256sum -c CHECKSUMS.txt
gpg --verify CHECKSUMS.txt.asc CHECKSUMS.txt
```
