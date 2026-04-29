# Reflection: TICKET-P0-DEV-001

## 事件
Dev 环境 Docker Compose 部署后发现 3 项配置错误，导致 payment-service 和 nginx 持续重启、logistics-service 数据库表缺失。

## 发现的问题

### 1. nginx upstream 主机名不一致
- `nginx/nginx.conf` 使用 `java-gateway:8080`
- `docker-compose.dev.yml` 服务名是 `gateway-service`
- **根因**: 生产配置和 dev 配置混用，没有 dev 专用的 nginx 配置

### 2. payment-service 环境变量缺失
- `INTERNAL_API_TOKEN` 和 `WITHDRAWAL_ENCRYPT_KEY` 在 `application.yml` 中定义为 required（无默认值）
- 但 `.env.dev` 和 `docker-compose.dev.yml` 中未传入
- **根因**: 新增业务代码引入了新的环境变量依赖，但平台侧的配置文件未同步更新
- **额外坑**: `WITHDRAWAL_ENCRYPT_KEY` 要求恰好 32 字符（AES-256），第一次设置的值长度不对导致二次失败

### 3. 数据库 schema 未自动初始化
- 各 Java 服务都有 `db/schema.sql`，但 postgres 容器未挂载
- **根因**: 初始化脚本 `init-multiple-dbs.sh` 只创建数据库，不创建表
- **注意**: postgres `/docker-entrypoint-initdb.d/` 只在数据目录为空时执行，现有环境需要手动执行

## 改进措施

1. **Dev/Prod 配置分离**: 创建 `nginx/nginx.dev.conf`，避免生产 SSL 配置污染 dev 环境
2. **环境变量变更通知机制**: 业务代码新增 `${}` 占位符时，应同步更新 `.env.dev` 和 `docker-compose.dev.yml`
3. **数据库初始化标准化**: 合并 schema.sql 到统一脚本，新环境自动初始化，现有环境运维手册补充手动执行步骤
4. **部署前健康检查**: 建议在 CI 或部署脚本中增加 `docker compose config` 验证环境变量完整性

## 安全基线检查

- [x] 无明文 Secret 提交 Git（`.env.dev` 中的值是 dev 专用占位符，已标记 `change-in-prod`）
- [x] `WITHDRAWAL_ENCRYPT_KEY` 32 字符符合 AES-256 要求
- [x] 所有 Java 服务镜像非 root 用户（appuser:1001）
- [x] 日志轮转已配置（json-file, 100m×5+compress）

## 关联 Pattern

- 新增 `skills/platform/draft/dev-prod-config-separation.md`（30天考察期）
