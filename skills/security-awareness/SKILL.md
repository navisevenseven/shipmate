---
name: shipmate-security-awareness
description: "Lightweight security audit for PM context: dependency vulnerability scanning, secret detection, and OWASP quick checks."
metadata:
  { "openclaw": { "emoji": "🔒", "requires": { "bins": ["git"] } } }
---

# Security Awareness

You help development teams identify security risks through dependency scanning, secret detection, and OWASP quick checks. This is a PM-level security overview — not a replacement for professional penetration testing.

## When to use

- User asks about security, vulnerabilities, or audit
- User says: "security", "уязвимости", "vulnerabilities", "безопасность", "audit dependencies", "секреты в коде", "OWASP", "перед релизом безопасность", "security scan", "dependency check"
- Before a release (part of pre-release checklist)
- When reviewing code that handles auth, payments, or sensitive data

**Related skills:** For code-review security dimension → `../code-review/SKILL.md`. For architectural security decisions → `../system-design/SKILL.md`.

## team-context.md Fields

Check `data/team-context.md` for:

```
## Security Config
- package_manager: npm | yarn | pip
- secret_scan_tool: gitleaks | trufflehog | grep
- excluded_paths: vendor,node_modules,dist,.next
```

## Context Management

Security scans can produce large output. Follow these rules:

1. **Summarize by severity.** Don't list every low-severity vulnerability — group and count
2. **Critical/High first.** Always surface critical and high severity issues prominently
3. **Actionable output.** For every finding, include what to do about it
4. **Confidence level.** Mark findings as "Confirmed" (tool-verified) or "Possible" (grep match)

**Target: 3-5 commands per request**

## Process

### Phase 1 — Dependency Vulnerability Scan

Detect package manager and run appropriate audit:

```bash
# Detect package manager
ls package-lock.json 2>/dev/null && echo "npm" || \
ls yarn.lock 2>/dev/null && echo "yarn" || \
ls requirements.txt 2>/dev/null && echo "pip" || \
ls Pipfile.lock 2>/dev/null && echo "pip" || \
echo "unknown"
```

#### npm

```bash
npm audit --json 2>/dev/null | jq '{
  total: .metadata.totalDependencies,
  vulnerabilities: .metadata.vulnerabilities,
  critical: [.vulnerabilities | to_entries[] | select(.value.severity == "critical") | .key],
  high: [.vulnerabilities | to_entries[] | select(.value.severity == "high") | .key]
}'
```

#### yarn

```bash
yarn audit --json 2>/dev/null | head -50
```

#### pip (requires pip-audit)

```bash
pip-audit --format json 2>/dev/null | jq '[.[] | {name, version, fix_versions, description: .vulns[0].description}] | group_by(.name) | map({package: .[0].name, version: .[0].version, vulns: length, fix: .[0].fix_versions})'
```

**Fallback (no audit tool available):**
- Parse lock files manually for known vulnerable versions
- Suggest: "Install `pip-audit` (`pip install pip-audit`) or use `npm audit` for comprehensive vulnerability scanning."

### Phase 2 — Secret Scan

#### Preferred: gitleaks or trufflehog

```bash
# gitleaks (fast, low false positives)
gitleaks detect --source . --no-git --report-format json 2>/dev/null | jq '[.[] | {rule: .RuleID, file: .File, line: .StartLine}] | group_by(.rule) | map({rule: .[0].rule, count: length, files: [.[].file] | unique})'

# trufflehog (deep scan including git history)
trufflehog filesystem . --json 2>/dev/null | head -20
```

#### Fallback: grep (basic pattern matching)

```bash
# Basic secret patterns — HIGH false positive rate
grep -rn --include='*.ts' --include='*.js' --include='*.py' --include='*.go' --include='*.rb' --include='*.java' --include='*.env' \
  -e 'AKIA[0-9A-Z]\{16\}' \
  -e 'sk-[a-zA-Z0-9]\{20,\}' \
  -e 'ghp_[a-zA-Z0-9]\{36\}' \
  -e 'gho_[a-zA-Z0-9]\{36\}' \
  -e 'glpat-[a-zA-Z0-9_\-]\{20\}' \
  -e "password\s*=\s*['\"][^'\"]\+" \
  . 2>/dev/null | head -20
```

**When using grep fallback**, always include this warning:
> Using basic pattern matching (grep). Results may include false positives and miss Base64-encoded or obfuscated secrets. Install `gitleaks` for comprehensive secret detection.

#### Git History Check

```bash
# Files with secret-like names ever committed
git log --all --diff-filter=A --name-only --pretty=format: -- '*.env' '*.key' '*.pem' '*.p12' '*.pfx' 2>/dev/null | sort -u | head -10
```

### Phase 3 — OWASP Quick Check

Manual code review checklist based on OWASP Top 10 (2021). Check applicable items:

| # | Risk | What to Check | How to Verify |
|---|------|---------------|---------------|
| A01 | **Broken Access Control** | Auth checks on all endpoints, RBAC enforcement | grep for unprotected routes, check middleware chain |
| A02 | **Cryptographic Failures** | HTTPS enforced, passwords hashed (bcrypt/argon2), no plaintext secrets | Check TLS config, password storage code |
| A03 | **Injection** | Parameterized queries, input sanitization, no eval/exec with user input | grep for string concatenation in SQL, `eval(`, `exec(` |
| A04 | **Insecure Design** | Rate limiting, account lockout, CSRF protection | Check auth flow, form submissions |
| A05 | **Security Misconfiguration** | Debug mode off in production, CORS restrictive, security headers set | Check env configs, response headers |
| A06 | **Vulnerable Components** | Dependencies up to date, no known CVEs | Phase 1 results |
| A07 | **Auth Failures** | Session management, JWT expiry, MFA available | Check token TTL, session config |
| A08 | **Data Integrity Failures** | Signed updates, CI/CD pipeline integrity | Check artifact signing, deploy pipeline |
| A09 | **Logging Failures** | Auth events logged, no PII in logs, log injection prevented | Check logging config and content |
| A10 | **SSRF** | URL validation, no user-controlled internal requests | Check HTTP client usage |

**Note:** This is a quick screening, not a comprehensive audit. Flag issues for the team to investigate.

## Output Format

```markdown
## Security Audit Summary

**Scan date:** <date>
**Tools used:** <npm audit / pip-audit / gitleaks / grep fallback>
**Confidence:** High (dedicated tools) | Medium (grep fallback)

### Dependency Vulnerabilities
| Severity | Count | Top Packages | Fix Available |
|----------|-------|-------------|---------------|
| Critical | 2 | lodash, express | Yes |
| High | 5 | axios, jsonwebtoken | Partial |
| Moderate | 12 | — | — |
| Low | 8 | — | — |

**Action required:** 2 critical vulnerabilities need immediate update.

### Secret Scan
| Finding | Confidence | File | Line |
|---------|-----------|------|------|
| AWS Access Key (AKIA...) | Confirmed | src/config.ts | 42 |
| Possible password | Possible (grep) | lib/auth.js | 15 |

**Git history:** No secret-bearing files (.env, .key, .pem) found in git history.

### OWASP Quick Check
| Check | Status | Notes |
|-------|--------|-------|
| A01 Broken Access Control | ⚠️ | 3 routes without auth middleware |
| A02 Cryptographic Failures | ✅ | HTTPS enforced, bcrypt for passwords |
| A03 Injection | ✅ | Parameterized queries used |
| A05 Security Misconfiguration | ❌ | DEBUG=true in production env |
| A06 Vulnerable Components | ⚠️ | See dependency scan above |

### Recommendations (priority order)
1. **[Critical]** Update lodash to 4.17.21 (prototype pollution — CVE-XXXX)
2. **[Critical]** Remove hardcoded AWS key from src/config.ts — use environment variable
3. **[High]** Disable debug mode in production environment
4. **[Medium]** Add auth middleware to unprotected routes: /api/admin, /api/export, /api/debug
```

## Persistence

After generating a security audit, persist key findings for tracking:

```bash
cat >> memory/$(date +%Y-%m-%d).md << 'SECURITY_EOF'
## Security Audit (<date>)
- Critical vulns: <count> (packages: <list>)
- High vulns: <count>
- Secrets found: <count> (<types>)
- OWASP flags: <list of failing checks>
SECURITY_EOF
```

## Fallback Behavior

- If no package manager detected: "No package manager found. I can still run secret scan and OWASP checklist."
- If `npm audit` / `pip-audit` / `yarn audit` unavailable: "Dependency audit tool not available. Install `pip-audit` (pip) or use `npm audit` (Node.js) for vulnerability scanning. Running secret scan and OWASP checklist instead."
- If `gitleaks` / `trufflehog` unavailable: fall back to grep with confidence warning
- If project has no source code (empty repo): "No source code found for security analysis."
- Always tell the user what tools were used and what was skipped

## Safety Rules

- **Never display full secret values.** Show only the pattern and location (e.g., "AKIA...XXXX in src/config.ts:42")
- **Never commit or store secrets.** If a secret is found, recommend removing it — don't copy it anywhere
- **Read-only operations only.** Security scan is observation, not remediation
- **PII awareness.** If logs or config contain PII (emails, names), note it but don't reproduce it in output
- **No automated fixes.** Always present findings and let the team decide on remediation
- **Confidence transparency.** Always state whether findings are from dedicated tools (high confidence) or grep (possible false positives)
