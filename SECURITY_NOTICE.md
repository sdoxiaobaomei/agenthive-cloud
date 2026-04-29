# Security Notice — PLATFORM-SECURITY-001

**Date:** 2026-04-29  
**Severity:** Critical  
**Status:** Remediated (key removed from repository — **rotation still required**)

---

## Summary

A valid Kimi LLM API key was discovered committed in plaintext in the following tracked files:

- `.env`
- `.env.dev`

## Leaked Key (Partial)

`sk-kimi-QDB39…` — **full key has been removed from the repository.**

> ⚠️ **Removal from Git does NOT revoke the key.** It may still exist in Git history (commits, forks, clones). The key **must** be rotated immediately at the provider console.

---

## Immediate Actions Required

### 1. Rotate the API Key

1. Log in to the [Kimi Console](https://www.kimi.com/code).
2. Revoke / delete the leaked key.
3. Generate a new key.
4. Update your **local** `.env.local` file (never commit it).

### 2. Audit Usage

- Check Kimi console usage logs for the leaked key.
- If any unexpected usage is found, treat it as a potential security incident and follow your incident-response playbook.

---

## Remediation Applied in This Ticket

| Item | Action |
|------|--------|
| Leaked key removed | Replaced with placeholders in `.env` and `.env.dev` |
| `.env` | `LLM_API_KEY=<YOUR_LLM_API_KEY>` |
| `.env.dev` | `LLM_API_KEY=sk-kimi-dev-placeholder-replace-me` |
| `.env.prod` | Fixed unsafe defaults: `CORS_ORIGIN`, `NACOS_AUTH_TOKEN`, marked critical passwords as `REQUIRED` |
| `.env.example` | Added clear instructions on how to obtain a real key |
| `.gitignore` | Excludes `.env.*` but allows `.env.*.example` |
| CI workflow | `.github/workflows/env-check.yml` blocks `sk-kimi-` patterns and localhost `CORS_ORIGIN` in PRs |
| Validation scripts | `scripts/validate-env.sh` + `scripts/validate-env.ps1` for local pre-deploy checks |

---

## Prevention Checklist

- [ ] Never commit real API keys, passwords, or tokens to Git.
- [ ] Use `.env.local` for local secrets (it is already gitignored).
- [ ] Run `scripts/validate-env.sh .env.prod` before every production deployment.
- [ ] Review PRs with the new `env-check` CI job; it will fail if secrets are detected.
- [ ] Rotate secrets on a regular schedule (e.g., quarterly).

---

> **Hive Mode**: *Security is a shared responsibility — when in doubt, rotate it out.* 🐝
