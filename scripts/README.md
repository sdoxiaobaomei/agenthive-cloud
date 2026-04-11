# Scripts Directory

> Automation scripts for AI Digital Twin project

---

## 📁 Directory Structure

```
scripts/
├── README.md              # This file
├── health-check/          # Health check scripts
│   ├── basic.sh          # Basic environment health check
│   └── pre-session.sh    # Pre-session validation
├── workstation/           # Workstation management
│   ├── init.sh           # Initialize new workstation ⭐
│   ├── cleanup.sh        # Cleanup temp files
│   └── sync-config.sh    # Sync config to all workstations
├── hooks/                 # Git hooks
│   ├── pre-commit        # Pre-commit validation
│   └── post-commit       # Post-commit reminders
└── test/                  # Test automation (to be added)
```

---

## 🚀 Quick Start

### Initialize a New Workstation

```bash
# For backend-dev agent
./scripts/workstation/init.sh backend-dev

# For frontend-dev agent
./scripts/workstation/init.sh frontend-dev
```

### Run Health Check

```bash
# Basic health check
cd WORKSTATIONS/backend-dev-ws/workspace/ai-digital-twin
../../../scripts/health-check/basic.sh

# Pre-session check
../../../scripts/health-check/pre-session.sh
```

### Cleanup Workspaces

```bash
# Clean all workstations
./scripts/workstation/cleanup.sh
```

### Sync Configuration

```bash
# Sync shared config to all workstations
./scripts/workstation/sync-config.sh
```

---

## 🔧 Git Hooks

### Install Hooks

```bash
# Copy hooks to .git directory
cp scripts/hooks/pre-commit .git/hooks/
cp scripts/hooks/post-commit .git/hooks/
chmod +x .git/hooks/pre-commit .git/hooks/post-commit
```

### Pre-Commit Hook

Validates before each commit:
- Checks for sensitive files
- Validates commit message format
- Warns about large files

### Post-Commit Hook

Reminds to:
- Update session-progress.md
- Update feature-list.json
- Create handoff if needed

---

## 📋 Session Workflow

```bash
# 1. Start session - run health check
cd WORKSTATIONS/{agent}-ws/workspace/ai-digital-twin
../../../scripts/health-check/pre-session.sh

# 2. Work on feature
# ... make changes ...

# 3. Before commit - hooks run automatically
git add .
git commit -m "[agent] FEATURE: description"

# 4. Sync progress to session-progress.md
../../../scripts/workstation/sync-progress.sh
```

---

## 🎯 Best Practices

### From Anthropic's "Effective harnesses for long-running agents"

1. **Always run pre-session check** before starting work
2. **Commit frequently** with descriptive messages
3. **Update progress files** after each session
4. **Keep workspaces clean** - run cleanup weekly

---

*Based on Anthropic Engineering best practices*
