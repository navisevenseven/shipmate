# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in ShipMate, please report it responsibly.

**Do NOT open a public GitHub issue.** Instead:

1. Email: security@shipmate.dev (or use the [security issue template](.github/ISSUE_TEMPLATE/security.md) marked as confidential)
2. Include: description, steps to reproduce, potential impact
3. We will respond within 48 hours

## Security Model

ShipMate follows a **three-layer isolation model** designed for team chat deployments. For the full threat model, see [docs/security.md](docs/security.md).

### Layers

| Layer | What | How |
|-------|------|-----|
| Workspace | Agent sees only the target project | `agents.defaults.workspace` in config |
| Tool Policy | Agent cannot read/write arbitrary files | `group:fs` in deny list |
| Sandbox | Bash runs in Docker (recommended) | `sandbox.mode: "all"` |

### Token Scoping

- Use **Fine-grained Personal Access Tokens** scoped to a single repository
- Never use classic PATs with broad `repo` scope
- Jira tokens should have minimal required permissions

## Verifying Releases

All releases are GPG-signed. To verify:

```bash
# Download release and checksums
gh release download v0.1.0 --repo AiYsen/shipmate

# Verify checksums
sha256sum -c CHECKSUMS.txt

# Verify GPG signature
gpg --verify CHECKSUMS.txt.asc CHECKSUMS.txt
```

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Supply Chain Security

- **Primary source:** GitHub Releases (verified, GPG-signed)
- **Secondary:** ClawHub (for discovery only — always verify source)
- Pin dependencies to exact versions
- Review third-party skill packs before installing
