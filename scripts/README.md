# AgentHive Cloud — Scripts Directory

> Organized automation scripts for the AgentHive Cloud platform

---

## 📁 Directory Structure

```
scripts/
├── README.md              # This file
├── build-api-ci.sh        # CI entrypoint script (referenced by GitHub Actions)
│
├── build/                 # Build scripts
├── deploy/                # Deployment scripts (referenced by CI)
├── dev/                   # Development environment scripts
├── ops/                   # Operations & validation scripts (referenced by CI)
├── test/                  # Testing scripts
├── db/                    # Database scripts
├── security/              # Security hardening & secret management
├── maintenance/           # Project maintenance & ticket management
└── archive/               # Archived / infrequently used scripts
```

---

## 🔨 `build/` — Build Scripts

Scripts for building Docker images and application bundles.

| Script | Description |
|--------|-------------|
| `build-api-minimal.sh` | Minimal API Docker build |
| `build-landing-minimal.sh` | Minimal Landing page Docker build |
| `build-docker-images.ps1` | PowerShell: build all Docker images |
| `build-images.ps1` | PowerShell: image build helper |
| `docker-build.mjs` | Node.js based Docker build script |
| `Build-DockerImage.ps1` | PowerShell: generic Docker image builder |

---

## 🚀 `deploy/` — Deployment Scripts (CI Referenced)

**These scripts are referenced by GitHub Actions workflows.**

| Script | Description |
|--------|-------------|
| `deploy-k3s.sh` | Deploy to K3s cluster |
| `deploy-k8s.sh` | Deploy to Kubernetes cluster |
| `quick-deploy-k8s.sh` | Quick K8s deployment shortcut |
| `deploy-local-k8s.sh` | Deploy to local K8s (kind/minikube) |
| `bootstrap-k3s-ecs.sh` | Bootstrap K3s on Alibaba Cloud ECS |
| `verify-deployment.sh` | Post-deploy health verification (used by `.github/workflows/deploy-k3s.yml`) |
| `verify-k3s.sh` | K3s-specific deployment verification |
| `rollback-k3s.sh` | Rollback K3s deployment on failure (used by `.github/workflows/deploy-k3s.yml`) |

**CI Usage Example:**
```bash
bash scripts/deploy/verify-deployment.sh --namespace agenthive --timeout 180
bash scripts/deploy/rollback-k3s.sh --namespace agenthive --revision -1
```

---

## 💻 `dev/` — Development Scripts

Scripts for setting up and running the local development environment.

| Script | Description |
|--------|-------------|
| `start-local.sh` | Start all local services (Unix) |
| `start-local.ps1` | Start all local services (PowerShell) |
| `start-agents.sh` | Start agent services (Unix) |
| `start-agents.ps1` | Start agent services (PowerShell) |
| `start-dev-with-java.ps1` | Start dev stack including Java microservices |
| `start-full-docker.ps1` | Start full stack via Docker Compose |
| `start-landing.ps1` | Start Landing page dev server |
| `setup-dev-env.sh` | One-time dev environment setup |
| `setup-docker-mirror.sh` | Configure Docker registry mirror (China) |
| `setup-kind-cluster.sh` | Create local kind Kubernetes cluster |
| `setup-dd-k8s.sh` | Setup Datadog K8s monitoring |
| `kind-cluster.yaml` | kind cluster configuration |

**Usage Example:**
```bash
# First time setup
bash scripts/dev/setup-dev-env.sh

# Start local services
bash scripts/dev/start-local.sh
```

---

## 🔧 `ops/` — Operations Scripts (CI Referenced)

**Some of these scripts are referenced by GitHub Actions workflows.**

| Script | Description |
|--------|-------------|
| `validate-env.sh` | Validate environment configuration (used by `.github/workflows/env-check.yml`) |
| `validate-env.ps1` | Validate environment configuration (PowerShell) |
| `health-check-dev.sh` | Development stack health check (Unix) |
| `health-check-dev.ps1` | Development stack health check (PowerShell) |
| `dev-acceptance.ps1` | Run dev acceptance tests |
| `install-local-tools.ps1` | Install required local development tools |
| `ci-build-deploy.ps1` | CI build & deploy orchestration |

**CI Usage Example:**
```bash
bash scripts/ops/validate-env.sh .env.prod
```

---

## 🧪 `test/` — Test Scripts

| Script | Description |
|--------|-------------|
| `e2e-smoke-test.sh` | End-to-end smoke tests (Unix) |
| `e2e-smoke-test.ps1` | End-to-end smoke tests (PowerShell) |
| `test-api-chat.mjs` | API chat endpoint test (Node.js) |
| `Test-CiBuild.ps1` | CI build validation tests |
| `test-llm.ps1` | LLM integration tests |

---

## 🗄️ `db/` — Database Scripts

| Script | Description |
|--------|-------------|
| `init-databases.sql` | Initialize all databases |
| `init.sql` | Initial schema setup |
| `backup-postgres.sh` | PostgreSQL backup script |
| `restore-postgres.sh` | PostgreSQL restore script |

---

## 🔒 `security/` — Security Scripts

| Script | Description |
|--------|-------------|
| `clean-git-secrets.sh` | Scan & remove secrets from git history |
| `rotate-secrets.sh` | Rotate application secrets |
| `security-group-hardening.ps1` | Alibaba Cloud security group hardening |
| `generate-selfsigned-cert.sh` | Generate self-signed TLS certificates |

---

## 🛠️ `maintenance/` — Project Maintenance

Scripts for ticket management, memory health checks, and skill reviews.

| Script | Description |
|--------|-------------|
| `batch-review-strategy-a.py` | Batch review strategy executor |
| `compress-reflections.ps1` | Compress agent reflection logs |
| `compress-reflections.sh` | Compress agent reflection logs (Unix) |
| `create-platform-dev-tickets.py` | Generate platform team tickets |
| `create-ui-prototype-tickets.py` | Generate UI prototype tickets |
| `create-tickets.js` | Generic ticket creation helper |
| `lead-behavior-check.ps1` | Lead agent behavior validation |
| `memory-health-check.ps1` | Agent memory health check (PowerShell) |
| `memory-health-check.sh` | Agent memory health check (Unix) |
| `review-skills.ps1` | Skill registry review (PowerShell) |
| `review-skills.sh` | Skill registry review (Unix) |
| `scan-tickets.py` | Ticket status scanner |

---

## 📦 `archive/` — Archived Scripts

Infrequently used or legacy scripts kept for reference.

| Script | Description |
|--------|-------------|
| `config-consistency-check.py` | Configuration consistency validator |
| `config-consistency-report.txt` | Consistency report output |
| `bump-version.ps1` | Version bumping (PowerShell) |
| `bump-version.sh` | Version bumping (Unix) |
| `monitor-landing.ps1` | Legacy landing page monitor |
| `disk-monitor.sh` | Disk usage monitor |
| `daemon.json` | Docker daemon configuration template |
| `init-workspace.js` | Legacy workspace initialization |
| `prep-workspace.js` | Legacy workspace preparation |
| `workspace-lifecycle.js` | Legacy workspace lifecycle manager |
| `build-and-push.sh` | Legacy build & push script |
| `build-local-k8s.sh` | Legacy local K8s build script |
| `deploy-to-k8s.ps1` | Legacy K8s deployment (PowerShell) |

---

## 🚀 Quick Reference

### Start Development Environment
```bash
bash scripts/dev/setup-dev-env.sh
bash scripts/dev/start-local.sh
```

### Deploy to K3s
```bash
bash scripts/deploy/deploy-k3s.sh
```

### Run Health Checks
```bash
bash scripts/ops/health-check-dev.sh
bash scripts/deploy/verify-deployment.sh --namespace agenthive
```

### Validate Environment
```bash
bash scripts/ops/validate-env.sh .env.prod
```

---

*Part of AgentHive Cloud infrastructure. All changes to CI-referenced scripts must be coordinated with `.github/workflows/` updates.*
