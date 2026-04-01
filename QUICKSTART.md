# 🚀 AgentHive Cloud - Quick Start Guide

Get your AgentHive Cloud environment up and running in 5 minutes!

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) 2.0+
- [Make](https://www.gnu.org/software/make/) (optional but recommended)

## ⚡ Quick Start

### 1. Clone and Setup

```bash
cd agenthive-cloud

# Copy environment configuration
cp .env.example .env

# (Optional) Edit .env with your settings
# nano .env  # or use your preferred editor
```

### 2. Start Development Environment

```bash
# Option A: Using Make (recommended)
make dev-docker

# Option B: Using Docker Compose directly
docker-compose up --build -d
```

### 3. Access Services

| Service | URL | Description |
|---------|-----|-------------|
| Web UI | http://localhost:5173 | Vue.js frontend |
| API | http://localhost:8080 | Go backend API |
| Database | localhost:5432 | PostgreSQL |
| Redis | localhost:6379 | Cache layer |

### 4. Verify Installation

```bash
# Check all services are running
make ps

# View logs
make logs

# Test health endpoints
curl http://localhost:8080/health
curl http://localhost:5173/health
```

## 🛠️ Common Commands

```bash
# Development
make dev-docker      # Start with hot reload
make dev-web         # Start frontend only
make dev-api         # Start backend only

# Build
make build           # Build all images
make build-web       # Build frontend only
make build-api       # Build backend only

# Testing
make test            # Run all tests
make test-unit       # Run unit tests

# Deployment
make deploy-docker   # Deploy with Docker Compose
make deploy          # Deploy to Kubernetes

# Management
make logs            # View all logs
make logs-web        # View web logs
make logs-api        # View API logs
make ps              # Show running containers
make clean           # Clean up resources
```

## 📁 Project Structure

```
agenthive-cloud/
├── apps/
│   ├── web/              # Vue.js frontend
│   │   ├── Dockerfile
│   │   └── package.json
│   └── supervisor/       # Go backend
│       ├── Dockerfile
│       └── cmd/server/
├── k8s/                  # Kubernetes manifests
├── config/               # Configuration files
├── scripts/              # Helper scripts
├── docker-compose.yml    # Docker Compose config
├── Makefile             # Build commands
├── .env.example         # Environment template
└── DEPLOYMENT.md        # Full deployment guide
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Change ports in .env
WEB_PORT=8081
SUPERVISOR_PORT=8082
```

### Permission Denied (Linux/Mac)

```bash
# Fix permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

### Services Won't Start

```bash
# Check what's wrong
make logs

# Reset everything (WARNING: data loss)
make clean-all
make dev-docker
```

## 📝 Next Steps

1. **Read the full guide**: See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions
2. **Configure environment**: Update `.env` with production settings
3. **Set up monitoring**: Enable Prometheus and Grafana
4. **Deploy to Kubernetes**: Use provided K8s manifests

## 🤝 Getting Help

- 📖 [Full Deployment Guide](DEPLOYMENT.md)
- 🐛 [Troubleshooting](#troubleshooting)
- 💬 Open an issue on GitHub

## 🎉 You're All Set!

Your AgentHive Cloud environment is ready. Happy coding! 🚀
