# AgentHive Cloud - Deployment Guide

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Environment Variables](#environment-variables)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

The fastest way to get started:

```bash
# Clone and enter the project
cd agenthive-cloud

# Copy environment template
cp .env.example .env

# Start all services
make dev-docker
```

Access your services:
- **Web UI**: http://localhost:5173
- **API**: http://localhost:8080
- **Database**: localhost:5432
- **Redis**: localhost:6379

## 📦 Prerequisites

### Required
- **Docker** 20.10+ and Docker Compose 2.0+
- **Make** (for convenience commands)
- **Git**

### Optional (for development)
- **Node.js** 20+ (for local frontend development)
- **Go** 1.22+ (for local backend development)
- **kubectl** (for Kubernetes deployment)
- **kustomize** (for Kubernetes manifest management)

## 💻 Development Setup

### Option 1: Docker Development (Recommended)

```bash
# Start with hot reload
make dev-docker

# View logs
make logs

# Stop services
make deploy-down
```

### Option 2: Local Development

**Terminal 1 - Database:**
```bash
docker-compose up -d postgres redis
```

**Terminal 2 - Backend:**
```bash
cd apps/supervisor
go mod tidy
air  # or: go run cmd/server/main.go
```

**Terminal 3 - Frontend:**
```bash
cd apps/web
npm install
npm run dev
```

### Development Commands

```bash
make dev          # Start development environment
make dev-web      # Start web frontend only
make dev-api      # Start supervisor API only
make fmt          # Format code
make lint         # Lint code
make test         # Run all tests
make test-unit    # Run unit tests only
make test-web     # Run frontend tests only
make test-api     # Run backend tests only
```

## 🏭 Production Deployment

### Docker Compose Production

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with production values

# 2. Build production images
make build

# 3. Deploy
make deploy-docker

# With monitoring stack
make deploy-with-monitoring
```

### Environment Configuration

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Key variables to configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | `agenthive_secret` |
| `REDIS_PASSWORD` | Redis password | `redis_secret` |
| `JWT_SECRET` | JWT signing secret | Required |
| `WEB_PORT` | Web UI port | `80` |
| `SUPERVISOR_PORT` | API port | `8080` |

## ☸️ Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Ingress controller (nginx recommended)

### Deploy with kubectl

```bash
# Deploy all resources
make deploy

# Or manually:
kubectl apply -k k8s/
```

### Deploy with Helm (Coming Soon)

```bash
helm repo add agenthive https://charts.agenthive.io
helm install agenthive agenthive/agenthive-cloud
```

### Kubernetes Resources

| Resource | Description |
|----------|-------------|
| Namespace | `agenthive` |
| ConfigMap | Application configuration |
| Secret | Sensitive credentials |
| Deployment | Web frontend (2 replicas) |
| Deployment | Supervisor API (2 replicas) |
| StatefulSet | PostgreSQL database |
| Deployment | Redis cache |
| Service | Internal service discovery |
| Ingress | External access |
| HPA | Horizontal Pod Autoscaler |

### Accessing Services

```bash
# Port forward for local access
kubectl port-forward -n agenthive svc/web 8080:80
kubectl port-forward -n agenthive svc/supervisor 8081:8080

# Or use ingress (requires DNS/host entry)
# Add to /etc/hosts: 127.0.0.1 agenthive.local
```

## 📊 Monitoring

### Enable Monitoring Stack

```bash
docker-compose --profile monitoring up -d
```

### Access Dashboards

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

### Default Dashboards

- System metrics (CPU, Memory, Disk)
- Application metrics (Requests, Latency, Errors)
- Database metrics (Connections, Query time)
- Redis metrics (Memory, Operations)

## 🔧 Makefile Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make dev` | Start development environment |
| `make dev-docker` | Start dev environment in Docker |
| `make build` | Build all production images |
| `make build-web` | Build web image only |
| `make build-api` | Build API image only |
| `make test` | Run all tests |
| `make test-unit` | Run unit tests |
| `make deploy` | Deploy to Kubernetes |
| `make deploy-docker` | Deploy with Docker Compose |
| `make deploy-with-monitoring` | Deploy with monitoring |
| `make deploy-down` | Stop Docker deployment |
| `make logs` | View logs |
| `make ps` | Show running containers |
| `make clean` | Clean Docker resources |
| `make clean-all` | Clean everything including volumes |
| `make k8s-status` | Check K8s deployment status |
| `make k8s-logs` | View K8s logs |

## 🐳 Docker Images

### Web Frontend

```bash
# Development
docker build --target development -t agenthive/web:dev apps/web

# Production
docker build --target production -t agenthive/web:latest apps/web
```

### Supervisor API

```bash
# Development
docker build --target development -t agenthive/supervisor:dev apps/supervisor

# Production
docker build --target production -t agenthive/supervisor:latest apps/supervisor
```

## 🔐 Security Best Practices

1. **Change default passwords** in `.env`
2. **Use strong JWT secrets** (min 32 characters)
3. **Enable HTTPS** in production
4. **Restrict CORS origins** instead of using `*`
5. **Use secrets management** (Kubernetes Secrets, Vault)
6. **Regular security updates** for base images

## 🚨 Troubleshooting

### Common Issues

#### Services won't start

```bash
# Check logs
make logs

# Check specific service
make logs-web
make logs-api

# Verify environment
docker-compose config
```

#### Database connection errors

```bash
# Check database is running
docker-compose ps

# Verify credentials in .env
cat .env | grep DB_

# Reset database (WARNING: data loss)
make deploy-down-volumes
```

#### Port conflicts

```bash
# Check what's using port 8080
lsof -i :8080

# Use different ports in .env
WEB_PORT=8081
SUPERVISOR_PORT=8082
```

#### Kubernetes deployment issues

```bash
# Check pod status
kubectl get pods -n agenthive

# Check events
kubectl get events -n agenthive --sort-by='.lastTimestamp'

# View logs
kubectl logs -n agenthive deployment/supervisor

# Describe resource
kubectl describe pod -n agenthive <pod-name>
```

### Health Checks

```bash
# Web health
curl http://localhost:80/health

# API health
curl http://localhost:8080/health

# Database
docker-compose exec postgres pg_isready -U agenthive

# Redis
docker-compose exec redis redis-cli ping
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Grafana Documentation](https://grafana.com/docs/)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 📄 License

[MIT License](LICENSE)
