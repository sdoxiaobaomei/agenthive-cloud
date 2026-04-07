# PostgreSQL 数据库接入指南

## 概述

后端 API 已从内存 Mock 数据迁移到 PostgreSQL 数据库。所有数据现在都会持久化存储。

## 快速开始

### 1. 安装 PostgreSQL

**Windows:**
```powershell
# 使用 Chocolatey
choco install postgresql

# 或使用安装包从 https://www.postgresql.org/download/windows/ 下载
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
# 切换到 postgres 用户（Linux/Mac）
sudo -u postgres psql

# 创建数据库和用户
CREATE DATABASE agenthive;
CREATE USER agenthive WITH PASSWORD 'agenthive123';
GRANT ALL PRIVILEGES ON DATABASE agenthive TO agenthive;
\q
```

### 3. 配置环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接：

```env
# PostgreSQL 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agenthive
DB_USER=agenthive
DB_PASSWORD=agenthive123
```

### 4. 初始化数据库

运行初始化脚本创建表结构和默认数据：

```bash
npm run db:init
```

### 5. 启动服务器

```bash
npm run dev
```

## 数据库表结构

### users - 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| username | VARCHAR(50) | 用户名 |
| email | VARCHAR(100) | 邮箱 |
| phone | VARCHAR(20) | 手机号 |
| password_hash | VARCHAR(255) | 密码哈希 |
| role | VARCHAR(20) | 角色 |
| avatar | TEXT | 头像 URL |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### agents - Agent 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(100) | 名称 |
| role | VARCHAR(50) | 角色 |
| status | VARCHAR(20) | 状态 |
| description | TEXT | 描述 |
| config | JSONB | 配置信息 |
| last_heartbeat_at | TIMESTAMP | 最后心跳时间 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### tasks - 任务表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| title | VARCHAR(200) | 标题 |
| description | TEXT | 描述 |
| type | VARCHAR(50) | 类型 |
| status | VARCHAR(20) | 状态 |
| priority | VARCHAR(20) | 优先级 |
| progress | INTEGER | 进度 0-100 |
| assigned_to | UUID | 分配给 Agent |
| parent_id | UUID | 父任务 ID |
| input/output | JSONB | 输入/输出数据 |
| created_at | TIMESTAMP | 创建时间 |

### code_files - 代码文件表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| path | VARCHAR(500) | 文件路径 |
| name | VARCHAR(255) | 文件名 |
| content | TEXT | 文件内容 |
| language | VARCHAR(50) | 语言 |
| last_modified | TIMESTAMP | 最后修改时间 |

### agent_logs - Agent 日志表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| agent_id | UUID | Agent ID |
| message | TEXT | 日志消息 |
| level | VARCHAR(20) | 日志级别 |
| created_at | TIMESTAMP | 创建时间 |

### sms_codes - 短信验证码表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| phone | VARCHAR(20) | 手机号 |
| code | VARCHAR(10) | 验证码 |
| expires_at | TIMESTAMP | 过期时间 |
| attempts | INTEGER | 尝试次数 |
| created_at | TIMESTAMP | 创建时间 |

## 常用命令

```bash
# 初始化数据库（创建表 + 插入默认数据）
npm run db:init

# 启动开发服务器
npm run dev

# 构建
npm run build

# 测试
npm run test
```

## 故障排除

### 连接失败

1. 检查 PostgreSQL 服务是否运行：
   ```bash
   # Windows
   net start postgresql-x64-15
   
   # Mac/Linux
   sudo systemctl status postgresql
   ```

2. 检查数据库和用户是否存在：
   ```sql
   \l                    -- 列出数据库
   \du                   -- 列出用户
   \c agenthive          -- 连接数据库
   \dt                   -- 列出表
   ```

3. 检查环境变量配置是否正确

### 表不存在

运行初始化脚本：
```bash
npm run db:init
```

## 从 Mock 数据迁移

如果需要保留原有 Mock 数据，可以在初始化前导出，然后手动插入到数据库中。
