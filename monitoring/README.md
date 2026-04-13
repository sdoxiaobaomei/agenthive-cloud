# AgentHive 监控系统

基于 Prometheus + Grafana 的监控解决方案，支持本地开发测试和云端 VM 部署。

## 📁 目录结构

```
monitoring/
├── docs/                    # 搭建、运维、深度原理文档
│   ├── README.md
│   ├── 01-搭建与部署-setup.md
│   ├── 02-运维与排障-operations.md
│   └── 03-NodeExporter文件系统-node-exporter.md
├── prometheus/              # Prometheus 镜像构建
│   ├── Dockerfile
│   └── prometheus.yml       # 默认配置
├── grafana/                 # Grafana 镜像构建
│   ├── Dockerfile
│   └── provisioning/        # 预配置数据源和 Dashboard
├── node-exporter/           # Node Exporter 镜像构建
│   └── Dockerfile
├── docker-compose.yml       # 本地开发测试
├── deploy-vm.sh             # VM 部署脚本
├── Makefile                 # 构建与部署辅助命令
└── README.md
```

## 📖 文档导航

详细的搭建、运维和深度原理文档已迁移至 `monitoring/docs/` 目录：

| 文档 | 内容 |
|------|------|
| [docs/README.md](./docs/README.md) | 文档首页与三件套关系说明 |
| [docs/01-搭建与部署-setup.md](./docs/01-搭建与部署-setup.md) | 从零搭建：docker run 参数逐条详解 |
| [docs/02-运维与排障-operations.md](./docs/02-运维与排障-operations.md) | 日常运维：状态检查、日志跟踪、服务探活 |
| [docs/03-NodeExporter文件系统-node-exporter.md](./docs/03-NodeExporter文件系统-node-exporter.md) | 文件系统排除规则深度指南 |

## 🚀 快速开始

### 方式一：本地开发测试（docker-compose）

```bash
cd monitoring

# 启动
docker-compose up -d

# 查看状态
docker-compose ps

# 停止
docker-compose down
```

访问地址：
- Grafana: http://localhost:3000 (admin/admin123)
- Prometheus: http://localhost:9090

### 方式二：VM 一键部署（deploy-vm.sh）

**前提**：镜像已构建并推送到镜像仓库（如阿里云 ACR）。

```bash
cd monitoring

# 一键部署指定版本
./deploy-vm.sh v20260413.3

# 覆盖仓库地址和命名空间
REGISTRY=your-registry.cn NAMESPACE=your-namespace ./deploy-vm.sh v20260413.3
```

> 详细用法和环境变量说明，参见 [docs/01-搭建与部署-setup.md](./docs/01-搭建与部署-setup.md) 的 "一键 VM 部署" 章节。

### 方式三：VM 手动部署（学习/调试）

如果你想逐个理解每个 `docker run` 参数的含义，或需要自定义网络/挂载配置，参考 [docs/01-搭建与部署-setup.md](./docs/01-搭建与部署-setup.md) 的 "VM 手动单容器部署" 章节。

---

## 🔨 构建与推送镜像

### 使用 Makefile（推荐）

```bash
cd monitoring

# 构建所有镜像
make build

# 测试镜像
make test

# 推送到远程仓库
make push

# 在 VM 上部署
make deploy-vm VERSION=v20260413.3
```

> 完整命令列表见 `Makefile` 或 [docs/01-搭建与部署-setup.md](./docs/01-搭建与部署-setup.md) 的 "镜像从哪来" 章节。

### 使用 GitHub Actions（CI/CD）

**方式一：手动触发工作流**

GitHub 仓库 → Actions → "Build & Push Monitoring Images" → Run workflow

**方式二：打标签自动触发**

```bash
git tag monitoring-v1.0.0
git push origin monitoring-v1.0.0
```

## ⚙️ 配置说明

### Prometheus 配置

编辑 `prometheus/prometheus.yml`，添加你的采集目标：

```yaml
scrape_configs:
  - job_name: 'my-api'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: /metrics
```

### Grafana 配置

预配置内容：
- 数据源：Prometheus (http://localhost:9090)
- Dashboard：系统监控面板

自定义 Dashboard：
1. 将 JSON 文件放入 `grafana/provisioning/dashboards/dashboards/`
2. 重新构建镜像

## 🔧 常用命令

```bash
# 本地构建测试
docker build -t test-prometheus ./prometheus
docker run -p 9090:9090 test-prometheus

# 推送指定标签
docker tag test-prometheus registry.cn-hangzhou.aliyuncs.com/agenthive/prometheus:v1.0.0
docker push registry.cn-hangzhou.aliyuncs.com/agenthive/prometheus:v1.0.0

# 查看镜像层级
docker history registry.cn-hangzhou.aliyuncs.com/agenthive/prometheus:v1.0.0
```

## 📦 镜像清单

| 镜像 | 说明 | 端口 |
|------|------|------|
| `agenthive/prometheus` | 时序数据库，存储指标 | 9090 |
| `agenthive/grafana` | 可视化仪表盘 | 3000 |
| `agenthive/node-exporter` | 系统指标采集器 | 9100 |

## 🔒 安全建议

1. **修改默认密码**：Grafana 默认密码 `admin123`，生产环境必须修改
2. **限制端口访问**：Prometheus 9090 端口建议只对内网开放
3. **使用 HTTPS**：生产环境配置 Nginx 反向代理 + SSL 证书
4. **定期备份**：备份 `/opt/agenthive-monitoring/data` 目录

## 📝 更新日志

### v1.0.0
- 初始版本
- 集成 Prometheus v2.48.0
- 集成 Grafana v10.2.3
- 集成 Node Exporter v1.7.0
- 预配置系统监控 Dashboard
