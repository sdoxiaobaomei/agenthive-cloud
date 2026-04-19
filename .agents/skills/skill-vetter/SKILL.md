---
name: skill-vetter
description: Security and quality validator for new skills. Use when creating, modifying, or reviewing any skill to ensure it follows safety guidelines, proper structure, and best practices. Validates SKILL.md frontmatter, checks for malicious scripts, ensures no sensitive data exposure, and verifies compliance with skill creation standards.
---

# Skill Vetter

Validates skills for security, safety, and quality before they are used.

## When to Run

Run the vetter on any new or modified skill before:
- Using the skill in production
- Committing the skill to version control
- Sharing the skill with other users

## Validation Checklist

### 1. Security Checks

**Scripts (`scripts/` directory)**
- [ ] No execution of user-provided code without validation
- [ ] No network requests to untrusted endpoints
- [ ] No file system operations outside intended scope
- [ ] No use of `eval()`, `exec()`, or equivalent in dynamic languages
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] Input sanitization for all external data
- [ ] Safe temporary file handling

**Assets (`assets/` directory)**
- [ ] No executable binaries without clear purpose
- [ ] No encrypted or obfuscated payloads
- [ ] File types match claimed formats

### 2. Structure Validation

**Required Files**
- [ ] `SKILL.md` exists in skill root
- [ ] YAML frontmatter is present and valid
- [ ] `name` field matches directory name
- [ ] `description` field is comprehensive (includes what and when)

**Optional Resources**
- [ ] `scripts/` only contains executable code
- [ ] `references/` only contains documentation
- [ ] `assets/` only contains output resources

### 3. Content Quality

**SKILL.md Body**
- [ ] Instructions are clear and actionable
- [ ] Examples are provided where helpful
- [ ] No placeholder text or TODOs
- [ ] Progressively disclosed (core in SKILL.md, details in references)
- [ ] Under 500 lines (large content in references/)

**Description Quality**
- [ ] Explains what the skill does
- [ ] Lists specific triggers for when to use it
- [ ] Includes task types and file formats supported
- [ ] Clear enough for auto-triggering

### 4. Safety Guidelines

**Prohibited Content**
- [ ] No malware or harmful code patterns
- [ ] No social engineering prompts
- [ ] No data exfiltration mechanisms
- [ ] No privilege escalation techniques
- [ ] No circumvention of security controls

**Risky Patterns to Flag**
- Shell commands with user input interpolation
- File deletion operations
- Network requests without validation
- Cryptocurrency operations
- Password cracking or brute force

## Validation Process

```
1. Read SKILL.md
   ├─ Check frontmatter format
   ├─ Verify required fields
   └─ Note referenced resources

2. Inspect scripts/
   ├─ Check each script for security issues
   ├─ Validate no hardcoded secrets
   └─ Ensure safe operations only

3. Inspect assets/
   ├─ Verify file types
   ├─ Check for suspicious binaries
   └─ Confirm safe content

4. Generate Report
   ├─ List all issues found
   ├─ Categorize by severity (Critical/Warning/Info)
   └─ Provide fix recommendations
```

## Severity Levels

- **Critical**: Security vulnerability or safety issue - skill must not be used
- **Warning**: Quality issue or potential risk - should be fixed before use
- **Info**: Best practice suggestion - optional improvement

## Reporting Format

```
## Skill Vetting Report: <skill-name>

### Summary
- Status: ✅ PASSED / ⚠️ WARNINGS / ❌ FAILED
- Critical Issues: N
- Warnings: N
- Info: N

### Critical Issues (Must Fix)
1. [File]: [Issue description]
   - Risk: [Security/quality impact]
   - Fix: [Recommended solution]

### Warnings (Should Fix)
...

### Info (Optional)
...

### Final Recommendation
[APPROVE / APPROVE_WITH_NOTES / REJECT]
```

## Quick Reference

**Common Issues:**
- Missing frontmatter → Add YAML frontmatter with name and description
- Weak description → Include "Use when..." triggers
- Script without validation → Add input sanitization
- Large SKILL.md → Move details to references/

**Safe Script Patterns:**
- Use argparse for CLI arguments
- Validate all file paths
- Use context managers for resources
- Log operations for auditability
