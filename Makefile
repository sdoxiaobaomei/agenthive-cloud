# ==========================================
# AgentHive Cloud - Makefile
# ==========================================

# Default shell
SHELL := /bin/bash

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m # No Color

# Project info
PROJECT_NAME := agenthive-cloud
COMPOSE_FILE := docker-compose.yml

# ==========================================
# Help
# ==========================================
.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)AgentHive Cloud - Available Commands:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Profiles:$(NC)"
	@echo "  $(GREEN)with-nginx$(NC)     - Include Nginx reverse proxy"
	@echo "  $(GREEN)with-storage$(NC)   - Include MinIO object storage"
	@echo "  $(GREEN)monitoring$(NC)     - Include Prometheus and Grafana"

# ==========================================
# Development Commands
# ==========================================
.PHONY: dev
dev: ## Start development environment with hot reload
	@echo "$(BLUE)Starting development environment...$(NC)"
	WEB_TARGET=development SUPERVISOR_TARGET=development \
	docker-compose -f $(COMPOSE_FILE) up -d postgres redis
	@echo "$(GREEN)Database services started!$(NC)"
	@echo "$(YELLOW)Run 'make dev-web' and 'make dev-api' in separate terminals$(NC)"

.PHONY: dev-web
dev-web: ## Start web frontend in development mode
	@echo "$(BLUE)Starting web frontend...$(NC)"
	cd apps/web && npm install && npm run dev

.PHONY: dev-api
dev-api: ## Start supervisor API in development mode
	@echo "$(BLUE)Starting supervisor API...$(NC)"
	cd apps/supervisor && go mod tidy && air

.PHONY: dev-docker
dev-docker: ## Start full development environment in Docker
	@echo "$(BLUE)Starting Docker development environment...$(NC)"
	WEB_TARGET=development SUPERVISOR_TARGET=development \
	docker-compose -f $(COMPOSE_FILE) up --build -d
	@echo "$(GREEN)Development environment started!$(NC)"
	@echo "  - Frontend: http://localhost:5173"
	@echo "  - API:      http://localhost:8080"
	@echo "  - Postgres: localhost:5432"
	@echo "  - Redis:    localhost:6379"

# ==========================================
# Build Commands
# ==========================================
.PHONY: build
build: ## Build all production Docker images
	@echo "$(BLUE)Building production images...$(NC)"
	docker-compose -f $(COMPOSE_FILE) build
	@echo "$(GREEN)Build completed!$(NC)"

.PHONY: build-web
build-web: ## Build web frontend Docker image
	@echo "$(BLUE)Building web frontend image...$(NC)"
	docker-compose -f $(COMPOSE_FILE) build web

.PHONY: build-api
build-api: ## Build supervisor API Docker image
	@echo "$(BLUE)Building supervisor API image...$(NC)"
	docker-compose -f $(COMPOSE_FILE) build supervisor

.PHONY: build-local
build-local: ## Build applications locally without Docker
	@echo "$(BLUE)Building applications locally...$(NC)"
	@echo "Building web frontend..."
	cd apps/web && npm install && npm run build
	@echo "Building supervisor API..."
	cd apps/supervisor && go mod tidy && go build -o ../../bin/supervisor ./cmd/server/main.go
	@echo "$(GREEN)Local build completed!$(NC)"

# ==========================================
# Test Commands
# ==========================================
.PHONY: test
test: test-unit test-integration ## Run all tests

.PHONY: test-unit
test-unit: ## Run unit tests
	@echo "$(BLUE)Running unit tests...$(NC)"
	@echo "$(YELLOW)Web frontend tests:$(NC)"
	cd apps/web && npm install && npm run test:unit
	@echo "$(YELLOW)Supervisor API tests:$(NC)"
	cd apps/supervisor && go test -v ./...
	@echo "$(GREEN)Unit tests completed!$(NC)"

.PHONY: test-integration
test-integration: ## Run integration tests
	@echo "$(BLUE)Running integration tests...$(NC)"
	@echo "$(YELLOW)E2E tests with Playwright:$(NC)"
	cd apps/web && npm install && npm run test:e2e
	@echo "$(GREEN)Integration tests completed!$(NC)"

.PHONY: test-web
test-web: ## Run web frontend tests only
	@echo "$(BLUE)Running web frontend tests...$(NC)"
	cd apps/web && npm install && npm run test:unit

.PHONY: test-api
test-api: ## Run supervisor API tests only
	@echo "$(BLUE)Running supervisor API tests...$(NC)"
	cd apps/supervisor && go test -v ./...

# ==========================================
# Deployment Commands
# ==========================================
.PHONY: deploy
deploy: ## Deploy to local Kubernetes (requires kubectl and k8s cluster)
	@echo "$(BLUE)Deploying to local Kubernetes...$(NC)"
	@echo "$(YELLOW)Applying Kubernetes manifests...$(NC)"
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/configmap.yaml
	kubectl apply -f k8s/secret.yaml
	kubectl apply -f k8s/postgres.yaml
	kubectl apply -f k8s/redis.yaml
	kubectl apply -f k8s/supervisor.yaml
	kubectl apply -f k8s/web.yaml
	kubectl apply -f k8s/ingress.yaml
	@echo "$(GREEN)Deployment completed!$(NC)"
	@echo "Waiting for pods to be ready..."
	kubectl wait --for=condition=ready pod -l app=agenthive-web --timeout=300s
	kubectl wait --for=condition=ready pod -l app=agenthive-supervisor --timeout=300s
	@echo "$(GREEN)All pods are ready!$(NC)"

.PHONY: deploy-docker
deploy-docker: ## Deploy using Docker Compose (production mode)
	@echo "$(BLUE)Deploying with Docker Compose...$(NC)"
	docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)Deployment completed!$(NC)"
	@echo "  - Web UI:   http://localhost"
	@echo "  - API:      http://localhost:8080"

.PHONY: deploy-with-monitoring
deploy-with-monitoring: ## Deploy with monitoring stack
	@echo "$(BLUE)Deploying with monitoring...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --profile monitoring up -d
	@echo "$(GREEN)Deployment with monitoring completed!$(NC)"
	@echo "  - Web UI:      http://localhost"
	@echo "  - API:         http://localhost:8080"
	@echo "  - Prometheus:  http://localhost:9090"
	@echo "  - Grafana:     http://localhost:3000"

.PHONY: undeploy
deploy-down: ## Stop Docker Compose deployment
	@echo "$(BLUE)Stopping deployment...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)Deployment stopped!$(NC)"

.PHONY: undeploy-volumes
deploy-down-volumes: ## Stop deployment and remove volumes (WARNING: data loss)
	@echo "$(RED)WARNING: This will remove all data volumes!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose -f $(COMPOSE_FILE) down -v; \
		echo "$(GREEN)Deployment stopped and volumes removed!$(NC)"; \
	fi

# ==========================================
# Kubernetes Commands - Production
# ==========================================
.PHONY: k8s-apply
k8s-apply: ## Apply Kubernetes manifests (production config)
	@echo "$(BLUE)Applying Kubernetes manifests...$(NC)"
	kubectl apply -k k8s/

.PHONY: k8s-delete
k8s-delete: ## Delete Kubernetes resources (production config)
	@echo "$(BLUE)Deleting Kubernetes resources...$(NC)"
	kubectl delete -k k8s/

.PHONY: k8s-status
k8s-status: ## Check Kubernetes deployment status (production)
	@echo "$(BLUE)Checking Kubernetes status...$(NC)"
	kubectl get all -n agenthive

.PHONY: k8s-logs
k8s-logs: ## View Kubernetes logs (production)
	@echo "$(BLUE)Viewing logs...$(NC)"
	kubectl logs -n agenthive -l app=agenthive-supervisor --tail=100 -f

# ==========================================
# Local Kubernetes Commands (Docker Desktop)
# ==========================================
.PHONY: k8s-local-deploy
k8s-local-deploy: ## Deploy to local K8s (Docker Desktop)
	@echo "$(BLUE)Deploying to local Kubernetes...$(NC)"
	@chmod +x scripts/local-k8s.sh
	@./scripts/local-k8s.sh deploy

.PHONY: k8s-local-build
k8s-local-build: ## Build images for local K8s
	@echo "$(BLUE)Building images for local Kubernetes...$(NC)"
	@chmod +x scripts/local-k8s.sh
	@./scripts/local-k8s.sh build

.PHONY: k8s-local-status
k8s-local-status: ## Check local K8s deployment status
	@echo "$(BLUE)Checking local Kubernetes status...$(NC)"
	@./scripts/local-k8s.sh status

.PHONY: k8s-local-logs
k8s-local-logs: ## View local K8s logs
	@echo "$(BLUE)Viewing local Kubernetes logs...$(NC)"
	@./scripts/local-k8s.sh logs

.PHONY: k8s-local-delete
k8s-local-delete: ## Delete local K8s resources
	@echo "$(BLUE)Deleting local Kubernetes resources...$(NC)"
	@./scripts/local-k8s.sh delete

.PHONY: k8s-local-reload
k8s-local-reload: ## Quick reload local K8s deployment
	@echo "$(BLUE)Reloading local Kubernetes deployment...$(NC)"
	@./scripts/local-k8s.sh reload

.PHONY: k8s-local-port-forward
k8s-local-port-forward: ## Start port-forward for local access
	@echo "$(BLUE)Starting port-forward...$(NC)"
	@./scripts/local-k8s.sh port-forward

# ==========================================
# Skaffold Commands (Fast Iteration)
# ==========================================
.PHONY: skaffold-dev
skaffold-dev: ## Start Skaffold development mode
	@echo "$(BLUE)Starting Skaffold dev mode...$(NC)"
	@skaffold dev

.PHONY: skaffold-run
skaffold-run: ## Run Skaffold once
	@echo "$(BLUE)Running Skaffold...$(NC)"
	@skaffold run

.PHONY: skaffold-debug
skaffold-debug: ## Run Skaffold in debug mode
	@echo "$(BLUE)Starting Skaffold debug mode...$(NC)"
	@skaffold debug

# ==========================================
# Utility Commands
# ==========================================
.PHONY: logs
logs: ## View Docker Compose logs
	docker-compose -f $(COMPOSE_FILE) logs -f

.PHONY: logs-web
logs-web: ## View web frontend logs
	docker-compose -f $(COMPOSE_FILE) logs -f web

.PHONY: logs-api
logs-api: ## View supervisor API logs
	docker-compose -f $(COMPOSE_FILE) logs -f supervisor

.PHONY: ps
ps: ## Show running containers
	docker-compose -f $(COMPOSE_FILE) ps

.PHONY: clean
clean: ## Clean up Docker resources
	@echo "$(BLUE)Cleaning up Docker resources...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down --remove-orphans
	docker system prune -f
	@echo "$(GREEN)Cleanup completed!$(NC)"

.PHONY: clean-all
clean-all: ## Clean up Docker resources including volumes (WARNING: data loss)
	@echo "$(RED)WARNING: This will remove all data volumes!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose -f $(COMPOSE_FILE) down -v --remove-orphans; \
		docker system prune -af --volumes; \
		echo "$(GREEN)Full cleanup completed!$(NC)"; \
	fi

.PHONY: migrate
migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	@echo "$(YELLOW)TODO: Implement migration command$(NC)"

.PHONY: seed
seed: ## Seed database with initial data
	@echo "$(BLUE)Seeding database...$(NC)"
	@echo "$(YELLOW)TODO: Implement seed command$(NC)"

# ==========================================
# Development Tools
# ==========================================
.PHONY: fmt
fmt: ## Format code
	@echo "$(BLUE)Formatting code...$(NC)"
	cd apps/web && npm run format
	cd apps/supervisor && gofmt -w .

.PHONY: lint
lint: ## Lint code
	@echo "$(BLUE)Linting code...$(NC)"
	cd apps/web && npm run lint
	cd apps/supervisor && golangci-lint run ./...

.PHONY: update-deps
update-deps: ## Update dependencies
	@echo "$(BLUE)Updating dependencies...$(NC)"
	cd apps/web && npm update
	cd apps/supervisor && go get -u ./... && go mod tidy

# ==========================================
# Release Commands
# ==========================================
.PHONY: release
release: ## Create a new release (usage: make release VERSION=x.y.z)
ifndef VERSION
	$(error VERSION is not set. Usage: make release VERSION=x.y.z)
endif
	@echo "$(BLUE)Creating release v$(VERSION)...$(NC)"
	@echo "$(YELLOW)Building images...$(NC)"
	docker-compose -f $(COMPOSE_FILE) build
	@echo "$(YELLOW)Tagging images...$(NC)"
	docker tag $(PROJECT_NAME)_web:latest $(PROJECT_NAME)/web:$(VERSION)
	docker tag $(PROJECT_NAME)_supervisor:latest $(PROJECT_NAME)/supervisor:$(VERSION)
	@echo "$(GREEN)Release v$(VERSION) created!$(NC)"
	@echo "Push to registry with:"
	@echo "  docker push $(PROJECT_NAME)/web:$(VERSION)"
	@echo "  docker push $(PROJECT_NAME)/supervisor:$(VERSION)"
