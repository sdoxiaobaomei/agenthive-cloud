# AgentHive 监控系统 - Makefile
# 简化本地开发和构建操作

.PHONY: help build build-prometheus build-grafana build-node-exporter push up down logs test clean

# 默认配置
REGISTRY ?= registry.cn-hangzhou.aliyuncs.com
NAMESPACE ?= agenthive
VERSION ?= latest

help: ## 显示帮助信息
	@echo "AgentHive 监控系统 - 可用命令:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ========== 本地构建 ==========

build: build-prometheus build-grafana build-node-exporter ## 构建所有镜像

build-prometheus: ## 构建 Prometheus 镜像
	docker build -t $(NAMESPACE)/prometheus:$(VERSION) ./prometheus

build-grafana: ## 构建 Grafana 镜像
	docker build -t $(NAMESPACE)/grafana:$(VERSION) -f ./grafana/Dockerfile .

build-node-exporter: ## 构建 Node Exporter 镜像
	docker build -t $(NAMESPACE)/node-exporter:$(VERSION) ./node-exporter

# ========== 推送镜像 ==========

push: push-prometheus push-grafana push-node-exporter ## 推送所有镜像到仓库

push-prometheus: ## 推送 Prometheus 镜像
	docker tag $(NAMESPACE)/prometheus:$(VERSION) $(REGISTRY)/$(NAMESPACE)/prometheus:$(VERSION)
	docker push $(REGISTRY)/$(NAMESPACE)/prometheus:$(VERSION)

push-grafana: ## 推送 Grafana 镜像
	docker tag $(NAMESPACE)/grafana:$(VERSION) $(REGISTRY)/$(NAMESPACE)/grafana:$(VERSION)
	docker push $(REGISTRY)/$(NAMESPACE)/grafana:$(VERSION)

push-node-exporter: ## 推送 Node Exporter 镜像
	docker tag $(NAMESPACE)/node-exporter:$(VERSION) $(REGISTRY)/$(NAMESPACE)/node-exporter:$(VERSION)
	docker push $(REGISTRY)/$(NAMESPACE)/node-exporter:$(VERSION)

# ========== 本地运行 ==========

up: ## 使用 docker-compose 启动本地环境
	docker-compose up -d

down: ## 停止本地环境
	docker-compose down

logs: ## 查看日志
	docker-compose logs -f

ps: ## 查看运行状态
	docker-compose ps

# ========== 测试 ==========

test: ## 测试本地构建的镜像
	@echo "测试 Prometheus..."
	@docker run --rm -d -p 9090:9090 --name test-prometheus $(NAMESPACE)/prometheus:$(VERSION)
	@sleep 5
	@curl -s http://localhost:9090/-/healthy && echo " ✓ Prometheus 正常" || echo " ✗ Prometheus 异常"
	@docker stop test-prometheus
	@echo ""
	@echo "测试 Grafana..."
	@docker run --rm -d -p 3000:3000 --name test-grafana $(NAMESPACE)/grafana:$(VERSION)
	@sleep 10
	@curl -s http://localhost:3000/api/health && echo " ✓ Grafana 正常" || echo " ✗ Grafana 异常"
	@docker stop test-grafana
	@echo ""
	@echo "测试 Node Exporter..."
	@docker run --rm -d -p 9100:9100 --name test-node-exporter $(NAMESPACE)/node-exporter:$(VERSION)
	@sleep 3
	@curl -s http://localhost:9100/ | grep -q "Node Exporter" && echo " ✓ Node Exporter 正常" || echo " ✗ Node Exporter 异常"
	@docker stop test-node-exporter

# ========== 清理 ==========

clean: ## 清理本地镜像和容器
	docker-compose down -v
	docker rmi $(NAMESPACE)/prometheus:$(VERSION) || true
	docker rmi $(NAMESPACE)/grafana:$(VERSION) || true
	docker rmi $(NAMESPACE)/node-exporter:$(VERSION) || true

docker-prune: ## 清理未使用的 Docker 资源
	docker system prune -f

# ========== VM 部署 ==========

deploy-vm: ## 在 VM 上部署（需要 VERSION 参数）
	@echo "部署版本: $(VERSION)"
	@./deploy-vm.sh $(VERSION)

# ========== 版本发布 ==========

tag: ## 创建 Git 标签并推送（触发 Actions）
	@if [ -z "$(VERSION)" ] || [ "$(VERSION)" = "latest" ]; then \
		echo "错误: 请指定版本号，如: make tag VERSION=v1.0.0"; \
		exit 1; \
	fi
	git tag monitoring-$(VERSION)
	git push origin monitoring-$(VERSION)
	@echo "已推送标签 monitoring-$(VERSION)，GitHub Actions 将自动构建"
