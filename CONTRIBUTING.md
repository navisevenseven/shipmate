# Contributing to ShipMate

Thank you for your interest in contributing to ShipMate! This document outlines the process for contributing to the project.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/navisevenseven/shipmate/issues) to avoid duplicates
2. Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
3. Include: steps to reproduce, expected vs actual behavior, environment details

### Suggesting Features

1. Open a [feature request](.github/ISSUE_TEMPLATE/feature_request.md)
2. Describe the use case and expected behavior
3. Check if it aligns with the [project roadmap](docs/TZ-master.md)

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/description`
3. Make your changes following the code standards below
4. Commit with GPG signature: `git commit -S -m "feat: description"`
5. Push and create a Pull Request
6. Wait for review and CI checks

## Code Standards

### Skills (SKILL.md files)

- Follow the AgentSkills spec with YAML frontmatter
- Include `metadata` with `requires.bins` / `requires.env` where applicable
- Add a "Fallback Behavior" section for graceful degradation
- Include clear "When to use" triggers
- Provide CLI examples with actual commands

### Bash Scripts

- Use `set -euo pipefail`
- Include usage/help text
- No interactive input (non-interactive by design)
- Test on both Linux and macOS

### General

- English for code and documentation
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- GPG-signed commits required
- No hardcoded secrets or tokens

## Pull Request Process

1. Update documentation if your change affects behavior
2. Add test scenarios to `tests/scenarios.md` for new features
3. Ensure all existing test scenarios still pass
4. Update `CHANGELOG.md` with your changes
5. Request review from code owners

## Security

For security vulnerabilities, please see [SECURITY.md](SECURITY.md). Do NOT open public issues for security problems.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
