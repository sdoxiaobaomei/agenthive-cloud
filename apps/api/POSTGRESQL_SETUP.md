# PostgreSQL 数据库接入完成 ✅

## 已完成的工作

### 1. 依赖安装
- ✅ 安装了 `pg` (PostgreSQL 驱动)
- ✅ 安装了 `@types/pg` (类型定义)

### 2. 数据库配置
- ✅ 创建了 `src/config/database.ts` - 数据库连接池配置
- ✅ 支持环境变量配置 (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
- ✅ 连接池配置（最大20连接，30秒空闲超时）

### 3. 数据库表结构
- ✅ 创建了 `src/db/schema.sql` - 完整的数据库表结构
- ✅ users (用户表)
- ✅ agents (Agent表)
- ✅ tasks (任务表)
- ✅ code_files (代码文件表)
- ✅ agent_logs (Agent日志表)
- ✅ sms_codes (短信验证码表)
- ✅ 所有必要的索引
- ✅ 自动更新时间的触发器

### 4. 数据访问层 (DAL)
- ✅ 创建了 `src/db/index.ts` - PostgreSQL 数据访问层
- ✅ 重写了 `src/utils/database.ts` - 从内存存储迁移到 PostgreSQL
- ✅ 所有 CRUD 操作已改为异步
- ✅ 支持 camelCase 和 snake_case 字段映射

### 5. 控制器更新
- ✅ 更新了 `src/controllers/auth.ts` - 添加 await
- ✅ 更新了 `src/controllers/agents.ts` - 添加 await
- ✅ 更新了 `src/controllers/tasks.ts` - 添加 await
- ✅ 更新了 `src/controllers/code.ts` - 添加 await
- ✅ 更新了 `src/services/sms.ts` - 适配异步数据库操作

### 6. 初始化脚本
- ✅ 创建了 `scripts/init-db.ts` - 数据库初始化脚本
- ✅ 包含默认数据插入
- ✅ 可通过 `npm run db:init` 运行

### 7. 类型定义
- ✅ 更新了 `src/types/index.ts`
- ✅ 支持数据库 snake_case 和 API camelCase 双字段

### 8. 环境变量
- ✅ 创建了 `.env.example` - 环境变量示例
- ✅ 创建了 `.env` - 默认环境配置

## 快速开始

### 1. 安装 PostgreSQL

**Windows:**
```powershell
# 下载安装包从 https://www.postgresql.org/download/windows/
# 或使用 Chocolatey
choco install postgresql
```

**Mac:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. 创建数据库

```bash
# 连接到 PostgreSQL
psql -U postgres

# 创建数据库和用户
CREATE DATABASE agenthive;
CREATE USER agenthive WITH PASSWORD 'agenthive123';
GRANT ALL PRIVILEGES ON DATABASE agenthive TO agenthive;
\q
```

### 3. 初始化数据库

```bash
cd agenthive-cloud/apps/api
npm run db:init
```

### 4. 启动服务器

```bash
npm run dev
```

## 数据库表结构

```sql
users          - 用户信息
agents         - Agent 信息
tasks          - 任务信息
code_files     - 代码文件
agent_logs     - Agent 日志
sms_codes      - 短信验证码
```

## API 端点

所有原有的 API 端点保持不变：

- `POST /api/auth/sms/send` - 发送短信验证码
- `POST /api/auth/login/sms` - 短信登录
- `POST /api/auth/login` - 用户名密码登录
- `POST /api/auth/register` - 注册
- `GET /api/auth/me` - 获取当前用户
- ... 等等

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3001 | 服务器端口 |
| DB_HOST | localhost | 数据库主机 |
| DB_PORT | 5432 | 数据库端口 |
| DB_NAME | agenthive | 数据库名 |
| DB_USER | agenthive | 数据库用户 |
| DB_PASSWORD | agenthive123 | 数据库密码 |
| JWT_SECRET | - | JWT 密钥 |
| CORS_ORIGIN | - | CORS 配置 |

## 故障排除

### 连接失败
```bash
# 检查 PostgreSQL 服务状态
# Windows
net start postgresql-x64-15

# Mac/Linux
sudo systemctl status postgresql
```

### 表不存在
```bash
npm run db:init
```

### 权限错误
确保数据库用户有正确的权限：
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agenthive;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agenthive;
```

## 从 Mock 数据迁移

数据现在会持久化存储在 PostgreSQL 中，服务重启后数据不会丢失。

如需导出/导入数据，可使用 PostgreSQL 的标准工具：
```bash
# 导出
pg_dump -U agenthive agenthive > backup.sql

# 导入
psql -U agenthive agenthive < backup.sql
```
