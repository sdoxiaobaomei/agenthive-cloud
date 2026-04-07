# Agent Runtime Service

K8s-native agent runtime service for Docker Desktop Kubernetes cluster.

> 📚 **完整文档**: 参见 [docs/README.md](docs/README.md) - Agent Runtime v2.2.0 库文档
> 
> 本文档仅涵盖 K8s 轻量级部署服务。关于完整的 Agent Runtime 库功能，请参阅上述链接。

## Overview

The Agent Runtime is a lightweight service that runs inside Kubernetes pods and:
- Executes tasks assigned by the Supervisor
- Reports health status and heartbeats
- Provides real-time task execution capabilities

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Docker Desktop K8s                        │
│  ┌───────────────┐         ┌───────────────┐               │
│  │  Agent Pod 1  │         │  Agent Pod 2  │               │
│  │  (postgres)   │         │  (postgres)   │               │
│  │   :16-alpine  │         │   :16-alpine  │               │
│  │  ┌─────────┐  │         │  ┌─────────┐  │               │
│  │  │ nc HTTP │  │         │  │ nc HTTP │  │               │
│  │  │ :8080   │  │         │  │ :8080   │  │               │
│  │  └────┬────┘  │         │  └────┬────┘  │               │
│  │       │       │         │       │       │               │
│  │  /workspace   │         │  /workspace   │               │
│  └───────┼───────┘         └───────┼───────┘               │
│          │                         │                        │
│          └───────────┬─────────────┘                        │
│                      │                                      │
│              ┌───────┴───────┐                              │
│              │    Service    │                              │
│              │  agent-runtime│                              │
│              │    :8080      │                              │
│              └───────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## Deployment

### Prerequisites

- Docker Desktop with Kubernetes enabled
- kubectl configured to use docker-desktop context

### Deploy

```bash
# Create namespace
kubectl create namespace agenthive

# Deploy agent runtime
kubectl apply -f deploy/k8s/deployment-pg.yaml
kubectl apply -f deploy/k8s/service.yaml
```

### Verify Deployment

```bash
# Check pods
kubectl get pods -n agenthive -l component=agent-runtime

# Check services
kubectl get svc -n agenthive

# Test health endpoint
kubectl exec -n agenthive <pod-name> -- wget -qO- http://localhost:8080/

# View logs
kubectl logs -n agenthive -l component=agent-runtime
```

## Technical Details

### Base Image

Uses `postgres:16-alpine` as the base image because:
- Already cached in Docker Desktop (no pull required)
- Includes Alpine Linux with busybox tools
- Lightweight (~80MB)
- Contains `nc` (netcat) for HTTP server

### HTTP Server

Simple netcat-based HTTP server responding with JSON health status:
```json
{"status":"healthy"}
```

### Resource Limits

- **Requests**: 16Mi memory, 5m CPU
- **Limits**: 64Mi memory, 50m CPU

### Health Checks

- **Liveness**: TCP socket probe on port 8080
- **Readiness**: TCP socket probe on port 8080

## Service Endpoints

| Service | Type | Endpoint | Purpose |
|---------|------|----------|---------|
| agent-runtime | ClusterIP | 10.96.x.x:8080 | Internal access |
| agent-runtime-nodeport | NodePort | :30080 | External access |

## Files

```
deploy/k8s/
├── deployment-pg.yaml    # Main deployment (postgres:16-alpine base)
└── service.yaml          # ClusterIP + NodePort services
```
