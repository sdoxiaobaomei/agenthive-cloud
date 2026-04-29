# Reflection: MON-2 - Prometheus scrape target 配置

## 任务
为 7 个 Java 微服务配置 Prometheus scrape target，统一采集 `/actuator/prometheus` 端点。

## 变更
- 文件: `monitoring/prometheus/prometheus.yml`
- 在 `scrape_configs:` 下新增 7 个 job：
  - `java-gateway` -> `gateway-service:8080`
  - `java-auth` -> `auth-service:8081`
  - `java-user` -> `user-service:8082`
  - `java-payment` -> `payment-service:8083`
  - `java-order` -> `order-service:8084`
  - `java-cart` -> `cart-service:8085`
  - `java-logistics` -> `logistics-service:8086`

## 验证
- `python -c "import yaml; yaml.safe_load(...)"` -> YAML 语法合法
- `docker compose -f monitoring/docker-compose.yml config` -> 输出完整，prometheus.yml 挂载路径正确
  - 注：命令返回 exit code 1 仅因 PowerShell 将 Docker 的 warning (`version` obsolete) 当作 NativeCommandError，配置本身无错误

## 安全与基线检查
- [x] 无明文 Secret
- [x] 使用服务名（非 localhost/IP），符合容器网络最佳实践
- [x] 配置注释清晰，说明指标路径和网络解析方式

## 已知限制 / 后续关注
- Prometheus 在 `agenthive-monitoring` 网络，Java 服务在 `agenthive-dev` 网络。
  若两网络未做互通或服务未同时加入两个网络，DNS 解析将在运行时失败。
  这属于网络架构/部署问题，不在本次配置变更范围内，但需在部署验证时关注。

## 学习
- Docker Compose 的 `version` 属性已被标记为 obsolete，后续可考虑移除以减少 warning。
- PowerShell 中 `docker` 命令的 warning 会被当作 NativeCommandError 抛出非零退出码，验证时需注意区分真正错误与 stderr warning。
