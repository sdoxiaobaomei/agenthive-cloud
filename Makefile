# AgentHive Cloud - Makefile

.PHONY: help cluster-up cluster-down infra-up infra-down dev-up dev-down build docker-build docker-push deploy

# Default target
help:
	@echo "AgentHive Cloud - Available Commands:"
	@echo ""
	@echo "  Cluster Management:"
	@echo "    make cluster-up      - Start local K8s cluster (kind/k3d)"
	@echo "    make cluster-down    - Stop local K8s cluster"
	@echo ""
	@echo "  Infrastructure:"
	@echo "    make infra-up        - Deploy Redis, PostgreSQL, MinIO"
	@echo "    make infra-down      - Remove infrastructure"
	@echo ""
	@echo "  Development:"
	@echo "    make dev-up          - Start all apps with hot-reload (skaffold)"
	@echo "    make dev-down        - Stop dev environment"
	@echo "    make dev-web         - Start Web UI only"
	@echo "    make dev-supervisor  - Start Supervisor only"
	@echo ""
	@echo "  Building:"
	@echo "    make build           - Build all binaries"
	@echo "    make docker-build    - Build all Docker images"
	@echo "    make docker-push     - Push images to registry"
	@echo ""
	@echo "  Deployment:"
	@echo "    make deploy-dev      - Deploy to dev environment"
	@echo "    make deploy-prod     - Deploy to production"
	@echo ""
	@echo "  Testing:"
	@echo "    make test            - Run all tests"
	@echo "    make test-unit       - Run unit tests"
	@echo "    make test-e2e        - Run E2E tests"
	@echo ""
	@echo "  Utilities:"
	@echo "    make clean           - Clean build artifacts"
	@echo "    make lint            - Run linters"
	@echo "    make fmt             - Format code"

# Variables
CLUSTER_NAME ?= agenthive-dev
NAMESPACE ?= agenthive-dev
DOCKER_REGISTRY ?= ghcr.io/agenthive
VERSION ?= $(shell git describe --tags --always --dirty)

# Cluster Management
cluster-up:
	@echo "Starting local K8s cluster..."
	@kind create cluster --name $(CLUSTER_NAME) --config platform/kind-config.yaml || true
	@kubectl create namespace $(NAMESPACE) || true

cluster-down:
	@echo "Stopping local K8s cluster..."
	@kind delete cluster --name $(CLUSTER_NAME)

# Infrastructure
infra-up:
	@echo "Deploying infrastructure..."
	@helm upgrade --install redis bitnami/redis -n $(NAMESPACE) --set auth.enabled=false
	@helm upgrade --install postgres bitnami/postgresql -n $(NAMESPACE) \
		--set auth.username=agenthive,auth.password=agenthive,auth.database=agenthive
	@helm upgrade --install minio bitnami/minio -n $(NAMESPACE) \
		--set auth.rootUser=agenthive,auth.rootPassword=agenthive123

infra-down:
	@echo "Removing infrastructure..."
	@helm uninstall redis postgres minio -n $(NAMESPACE) || true

# Development
dev-up:
	@echo "Starting development environment with hot-reload..."
	@skaffold dev -f deploy/skaffold.yaml

dev-down:
	@echo "Stopping development environment..."
	@skaffold delete -f deploy/skaffold.yaml

dev-web:
	@echo "Starting Web UI..."
	@cd apps/web && npm run dev

dev-supervisor:
	@echo "Starting Supervisor..."
	@cd apps/supervisor && go run ./cmd/server

# Building
build:
	@echo "Building all binaries..."
	@cd apps/supervisor && go build -o ../../bin/supervisor ./cmd/server
	@cd apps/agent-runtime && go build -o ../../bin/agent-runtime ./cmd/agent

docker-build:
	@echo "Building Docker images..."
	@docker build -t $(DOCKER_REGISTRY)/web:$(VERSION) -f apps/web/Dockerfile apps/web
	@docker build -t $(DOCKER_REGISTRY)/supervisor:$(VERSION) -f apps/supervisor/Dockerfile apps/supervisor
	@docker build -t $(DOCKER_REGISTRY)/agent-runtime:$(VERSION) -f apps/agent-runtime/Dockerfile apps/agent-runtime

docker-push: docker-build
	@echo "Pushing Docker images..."
	@docker push $(DOCKER_REGISTRY)/web:$(VERSION)
	@docker push $(DOCKER_REGISTRY)/supervisor:$(VERSION)
	@docker push $(DOCKER_REGISTRY)/agent-runtime:$(VERSION)

# Deployment
deploy-dev:
	@echo "Deploying to dev environment..."
	@helm upgrade --install agenthive ./deploy/helm/agenthive \
		-n $(NAMESPACE) \
		--set image.tag=$(VERSION)

deploy-prod:
	@echo "Deploying to production..."
	@helm upgrade --install agenthive ./deploy/helm/agenthive \
		-n agenthive \
		-f ./deploy/helm/agenthive/values-production.yaml \
		--set image.tag=$(VERSION)

# Testing
test:
	@echo "Running all tests..."
	@make test-unit
	@make test-e2e

test-unit:
	@echo "Running unit tests..."
	@cd apps/supervisor && go test ./...
	@cd apps/agent-runtime && go test ./...
	@cd apps/web && npm run test:unit

test-e2e:
	@echo "Running E2E tests..."
	@cd apps/web && npm run test:e2e

# Utilities
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf bin/ dist/ *.log
	@docker system prune -f

lint:
	@echo "Running linters..."
	@cd apps/supervisor && golangci-lint run
	@cd apps/agent-runtime && golangci-lint run
	@cd apps/web && npm run lint

fmt:
	@echo "Formatting code..."
	@cd apps/supervisor && go fmt ./...
	@cd apps/agent-runtime && go fmt ./...
	@cd apps/web && npm run format
