# messagedrop

## Guardrails (Secrets)

This repo uses a local pre-commit hook with `gitleaks` to prevent committing secrets.

Setup:
- Install `gitleaks`
  - macOS (Homebrew): `brew install gitleaks`
  - Linux (snap): `sudo snap install gitleaks`
  - Windows (Chocolatey): `choco install gitleaks`
- Enable hooks for this repo:
  - `git config core.hooksPath .githooks`

Bypass (not recommended): `SKIP_GITLEAKS=1 git commit ...`
