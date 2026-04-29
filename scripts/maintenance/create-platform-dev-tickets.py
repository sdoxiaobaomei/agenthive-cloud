#!/usr/bin/env python3
"""Create Platform dev environment consistency tickets."""
import os

base = "AGENTS/workspace"
os.makedirs(base, exist_ok=True)

tickets = [
    {
        "id": "PLAT-DEV-001",
        "title": "修复 Nacos 凭据不一致 + 启用服务发现",
        "priority": "P0",
        "description": """修复 Docker Dev 环境中 Nacos 认证和服务发现的致命不一致问题。

根因分析：
1. Nacos 容器自身认证配置：NACOS_AUTH_IDENTITY_KEY=agenthive, NACOS_AUTH_IDENTITY_VALUE=agenthive-secret-2024
2. 但所有 Java 服务连接 Nacos 的 username/password = nacos/nacos
3. 凭据对不上 → Java 服务 Nacos 认证失败 → 服务注册不上 → Gateway 路由 500
4. 同时 application-docker.yml 中 nacos.discovery.enabled=false 和 nacos.config.enabled=false
5. 即使凭据修好了，服务也不会注册到 Nacos

修复内容：
1. docker-compose.dev.yml 中所有 Java 服务的 SPRING_CLOUD_NACOS_*_USERNAME/PASSWORD 改为 agenthive/agenthive-secret-2024
2. 所有 Java 服务的 application-docker.yml 中 nacos.discovery.enabled 改为 true
3. 所有 Java 服务的 application-docker.yml 中 nacos.config.enabled 改为 true（或按需保留 false 但 discovery 必须 true）
4. bootstrap.yml 中的 username/password 环境变量名与 docker-compose 对齐""",
        "ac": [
            "docker-compose.dev.yml 中 gateway-service/auth-service/user-service/payment-service/order-service/cart-service/logistics-service 的 SPRING_CLOUD_NACOS_DISCOVERY_USERNAME 改为 agenthive",
            "上述服务的 SPRING_CLOUD_NACOS_DISCOVERY_PASSWORD 改为 agenthive-secret-2024",
            "上述服务的 SPRING_CLOUD_NACOS_CONFIG_USERNAME 改为 agenthive",
            "上述服务的 SPRING_CLOUD_NACOS_CONFIG_PASSWORD 改为 agenthive-secret-2024",
            "所有 Java 服务的 application-docker.yml 中 spring.cloud.nacos.discovery.enabled = true",
            "bootstrap.yml 中 username/password 使用环境变量 ${NACOS_USERNAME}/${NACOS_PASSWORD}，docker-compose 中注入对应值",
            "docker compose -f docker-compose.dev.yml --profile java up -d 后，访问 http://localhost:8848/nacos 可看到所有服务已注册",
            "Gateway 路由 lb://auth-service 可正常转发到 auth-service"
        ],
        "files": [
            "docker-compose.dev.yml",
            "apps/java/gateway-service/src/main/resources/application-docker.yml",
            "apps/java/auth-service/src/main/resources/application-docker.yml",
            "apps/java/user-service/src/main/resources/application-docker.yml",
            "apps/java/payment-service/src/main/resources/application-docker.yml",
            "apps/java/order-service/src/main/resources/application-docker.yml",
            "apps/java/cart-service/src/main/resources/application-docker.yml",
            "apps/java/logistics-service/src/main/resources/application-docker.yml",
            "apps/java/auth-service/src/main/resources/bootstrap.yml",
            "apps/java/gateway-service/src/main/resources/bootstrap.yml"
        ],
        "depends_on": [],
        "risk": "high",
        "security": "review_required",
        "notes": "Nacos 凭据修改后，所有 Java 服务必须重启。建议在非工作时间执行。"
    },
    {
        "id": "PLAT-DEV-002",
        "title": "修复数据库初始化：Node DB + 统一用户表 + auth DB 主机",
        "priority": "P0",
        "description": """修复 Docker Dev 环境中的数据库初始化不一致问题。

根因分析：
1. Node API 使用 DB_NAME=agenthive，但 init-multiple-dbs.sh 只创建 auth_db/user_db/payment_db/order_db/cart_db/logistics_db，没有 agenthive
2. auth-service 的 application-docker.yml 中 DB_HOST=postgres-auth，但 docker-compose 中 postgres 服务名是 postgres
3. init-schemas.sql 创建 t_auth_user 表，但 auth-service/db/init.sql 创建 sys_user 表，两套用户表冲突

修复内容：
1. init-multiple-dbs.sh 的 POSTGRES_MULTIPLE_DATABASES 增加 agenthive
2. auth-service 的 application-docker.yml 中 DB_HOST 改为 postgres（与 docker-compose 服务名一致）
3. 统一用户表：决定使用 sys_user（与 auth-service 代码一致），在 init-schemas.sql 中删除 t_auth_user 相关定义，确保 sys_user 表在 auth_db 中创建
4. 确保 init-schemas.sql 中的 sys_user 结构与 auth-service 的实体类一致""",
        "ac": [
            "docker-compose.dev.yml 中 postgres 的 POSTGRES_MULTIPLE_DATABASES 包含 agenthive（Node API 数据库）",
            "init-multiple-dbs.sh 正确创建 agenthive 数据库",
            "auth-service 的 application-docker.yml 中 DB_HOST 从 postgres-auth 改为 postgres",
            "init-schemas.sql 中删除 t_auth_user 定义，统一使用 sys_user",
            "init-schemas.sql 中 auth_db 部分包含完整的 sys_user/sys_role/sys_user_role 表结构",
            "docker compose up 后，Node API 可正常连接 agenthive 数据库",
            "docker compose up 后，auth-service 可正常连接 auth_db 数据库并找到 sys_user 表",
            "所有 6 个数据库（auth/user/payment/order/cart/logistics/agenthive）初始化后结构正确"
        ],
        "files": [
            "docker-compose.dev.yml",
            "apps/java/scripts/init-multiple-dbs.sh",
            "apps/java/scripts/init-schemas.sql",
            "apps/java/auth-service/src/main/resources/application-docker.yml",
            "apps/java/auth-service/src/main/resources/db/init.sql",
            "apps/java/auth-service/src/main/resources/db/schema.sql"
        ],
        "depends_on": [],
        "risk": "high",
        "security": "review_required",
        "notes": "数据库结构调整涉及数据丢失风险。Dev 环境可接受重建，但需确保 Schema 正确。"
    },
    {
        "id": "PLAT-DEV-003",
        "title": "统一 JWT Secret + .env.dev 完整性检查",
        "priority": "P0",
        "description": """修复 JWT Secret 不一致和 .env.dev 缺失关键环境变量的问题。

根因分析：
1. Node API 和 Java Gateway 都使用 ${JWT_SECRET}，但如果 .env.dev 未定义，值为空字符串
2. 空字符串 JWT Secret 导致 token 签名/验证异常 → 401 Unauthorized
3. .env.dev 可能缺少 REDIS_PASSWORD、DB_PASSWORD、LLM_API_KEY 等关键变量
4. 没有启动前检查机制，服务启动失败后才暴露配置缺失

修复内容：
1. 创建 scripts/setup-dev-env.sh：自动生成/验证 .env.dev 中的必需变量
2. 如果 JWT_SECRET 未定义，脚本生成一个随机 256-bit secret 并写入 .env.dev
3. 脚本检查所有必需变量：DB_USER, DB_PASSWORD, REDIS_PASSWORD, JWT_SECRET, LLM_API_KEY 等
4. docker-compose.dev.yml 启动前调用检查脚本（或在文档中强制要求）
5. 确保 Node API 和 Java 服务使用完全相同的 JWT_SECRET 值""",
        "ac": [
            "scripts/setup-dev-env.sh 脚本创建，功能：检查 .env.dev 是否存在，检查必需变量是否定义",
            "脚本为缺失的 JWT_SECRET 自动生成随机 256-bit base64 字符串",
            "脚本列出所有缺失的必需变量并给出示例值",
            "docker-compose.dev.yml 的注释中增加启动前运行 setup-dev-env.sh 的说明",
            "Node API 和 Java Gateway 使用相同 JWT_SECRET 后，token 可跨服务验证",
            "手动测试：Node API 登录获取 token → 携带 token 访问 Java Gateway 受保护端点 → 返回 200 而非 401"
        ],
        "files": [
            ".env.dev",
            ".env.dev.example",
            "scripts/setup-dev-env.sh",
            "docker-compose.dev.yml",
            "apps/api/src/middleware/auth.ts",
            "apps/java/gateway-service/src/main/resources/application-docker.yml"
        ],
        "depends_on": [],
        "risk": "medium",
        "security": "critical",
        "notes": "JWT Secret 生成后不得更改（否则已有 token 失效）。Dev 环境可接受重新生成。"
    },
    {
        "id": "PLAT-DEV-004",
        "title": "敏感信息外迁：Nacos token/identity 移入 .env.dev",
        "priority": "P1",
        "description": """将 docker-compose.dev.yml 中硬编码的敏感信息迁移到 .env.dev 环境变量。

根因分析：
1. docker-compose.dev.yml 中硬编码了 NACOS_AUTH_TOKEN（base64 编码的明文）、NACOS_AUTH_IDENTITY_VALUE
2. 这些敏感信息暴露在版本控制中，存在泄露风险
3. 虽然 dev 环境敏感度较低，但养成硬编码习惯会导致生产环境也犯同样错误

修复内容：
1. docker-compose.dev.yml 中所有硬编码敏感值改为 ${ENV_VAR} 引用
2. .env.dev.example 中增加对应变量名和示例值（示例值用明显假的占位符）
3. .env.dev 中设置实际值（不提交到 git，.gitignore 已配置）
4. scripts/setup-dev-env.sh 为缺失的敏感变量生成安全随机值""",
        "ac": [
            "docker-compose.dev.yml 中 NACOS_AUTH_TOKEN 改为 ${NACOS_AUTH_TOKEN}",
            "docker-compose.dev.yml 中 NACOS_AUTH_IDENTITY_VALUE 改为 ${NACOS_AUTH_IDENTITY_VALUE}",
            "docker-compose.dev.yml 中 SPRING_CLOUD_NACOS_*_PASSWORD 改为 ${NACOS_PASSWORD}",
            ".env.dev.example 增加上述变量名和占位符示例值",
            "scripts/setup-dev-env.sh 为缺失的敏感变量自动生成安全随机值",
            "docker compose config 验证通过（无未定义变量警告）",
            "git diff 确认 docker-compose.dev.yml 不再包含任何硬编码 secret"
        ],
        "files": [
            "docker-compose.dev.yml",
            ".env.dev",
            ".env.dev.example",
            "scripts/setup-dev-env.sh"
        ],
        "depends_on": ["PLAT-DEV-001", "PLAT-DEV-003"],
        "risk": "medium",
        "security": "critical",
        "notes": "需确保 .env.dev 不会被意外提交到 git。检查 .gitignore 已包含 .env.dev。"
    },
    {
        "id": "PLAT-DEV-005",
        "title": "Dev 环境启动健康检查脚本",
        "priority": "P1",
        "description": """创建一键健康检查脚本，启动 docker-compose 后自动验证所有服务状态。

根因分析：
1. 当前启动 docker-compose 后，开发者需要手动访问各个端口确认服务正常
2. 500/401 错误在启动后一段时间才暴露，没有统一的诊断入口
3. 缺乏"启动成功/失败"的明确判断标准

修复内容：
1. 创建 scripts/health-check-dev.sh：
   - 检查所有容器运行状态（docker compose ps）
   - 检查每个服务的 /health 或 /actuator/health 端点
   - 检查数据库连接（psql 简单查询）
   - 检查 Redis 连接（redis-cli ping）
   - 检查 Nacos 服务注册列表
2. 输出彩色报告：✅ 正常 / ❌ 失败 / ⚠️ 警告
3. 失败时给出具体诊断建议（如"auth-service 未注册到 Nacos，检查凭据"）""",
        "ac": [
            "scripts/health-check-dev.sh 创建，支持 bash（Linux/Mac）和 PowerShell（Windows）双版本",
            "脚本检查所有必需容器状态：postgres, redis, nacos, rabbitmq, api, landing, gateway, auth, user, payment, order, cart, logistics",
            "脚本调用每个 Java 服务的 /actuator/health，Node API 的 /api/health",
            "脚本检查 Nacos 服务注册列表（curl http://localhost:8848/nacos/v1/ns/service/list）",
            "脚本检查数据库：psql -c 'SELECT 1' 到每个数据库",
            "脚本检查 Redis：redis-cli -a password ping",
            "输出报告包含：服务状态表格、失败项诊断建议、修复命令",
            "执行时间 < 30 秒"
        ],
        "files": [
            "scripts/health-check-dev.sh",
            "scripts/health-check-dev.ps1",
            "docker-compose.dev.yml"
        ],
        "depends_on": ["PLAT-DEV-001", "PLAT-DEV-002", "PLAT-DEV-003"],
        "risk": "low",
        "security": "none",
        "notes": "健康检查脚本本身不修改任何配置，只读状态。可安全频繁执行。"
    },
    {
        "id": "PLAT-DEV-006",
        "title": "配置一致性门禁：docker-compose ↔ application.yml 变量对齐检查",
        "priority": "P2",
        "description": """创建自动化门禁脚本，防止 docker-compose 环境变量与 application.yml 中的变量名不一致。

根因分析：
1. PLAT-DEV-001~003 中的问题本质上都是"配置不一致"：docker-compose 设了 A，application.yml 读的是 B
2. 这类问题人工检查容易遗漏，且随代码变更会重新出现
3. 需要自动化机制在 CI 或提交前检查对齐情况

修复内容：
1. 创建 scripts/config-consistency-check.py：
   - 扫描 docker-compose.dev.yml 中所有 ${ENV_VAR} 环境变量
   - 扫描所有 application-docker.yml 中使用的 ${ENV_VAR} 环境变量
   - 检查 docker-compose 注入的变量名是否与 application.yml 期望的一致
   - 检查 .env.dev.example 是否覆盖了所有必需变量
2. 发现不一致时输出具体差异（如"docker-compose 注入 REDIS_HOST，但 application.yml 期望 SPRING_DATA_REDIS_HOST"）
3. 集成到 CI pipeline 或 pre-commit hook""",
        "ac": [
            "scripts/config-consistency-check.py 创建，解析 YAML 文件提取环境变量引用",
            "脚本对比 docker-compose.dev.yml 与所有 application-docker.yml 的变量名",
            "脚本检查 .env.dev.example 是否包含所有被引用的变量（标记 required/optional）",
            "脚本输出差异报告：完全一致 / 部分不一致 / 严重不匹配",
            "集成到 GitHub Actions / CI pipeline（可选，P2 后续迭代）",
            "脚本执行时间 < 10 秒",
            "覆盖所有 Java 服务 + Node API + 基础设施服务"
        ],
        "files": [
            "scripts/config-consistency-check.py",
            ".github/workflows/config-check.yml"
        ],
        "depends_on": ["PLAT-DEV-001", "PLAT-DEV-002", "PLAT-DEV-003", "PLAT-DEV-004"],
        "risk": "low",
        "security": "none",
        "notes": "纯分析脚本，不修改任何文件。可集成到 pre-commit hook 或 CI。"
    }
]

for t in tickets:
    td = os.path.join(base, f"TICKET-{t['id']}")
    os.makedirs(td, exist_ok=True)
    
    deps_yaml = "\n".join([f"  - TICKET-{d}" for d in t["depends_on"]]) if t["depends_on"] else "  []"
    files_yaml = "\n".join([f"  - {f}" for f in t["files"]])
    ac_yaml = "\n".join([f"  - {ac}" for ac in t["ac"]])
    
    content = f"""ticket_id: TICKET-{t['id']}
title: {t['title']}
type: {'infrastructure' if '脚本' in t['title'] or '检查' in t['title'] else 'fix'}
priority: {t['priority']}
status: pending
assigned_team: platform
role: platform_dev
description: >-
  {t['description'].replace(chr(10), chr(10) + '  ')}
acceptance_criteria:
{ac_yaml}
relevant_files:
{files_yaml}
constraints:
  - 仅修改 dev 环境配置，不影响生产环境
  - 所有修改需向后兼容（现有开发者可平滑过渡）
  - 敏感信息不得硬编码在版本控制文件中
depends_on:
{deps_yaml}
parent_ticket: null
qa_result: null
created_at: '2026-04-28T00:00:00Z'
retry_count: 0
confidence_threshold: 0.85
risk_assessment: {t['risk']}
security_implications: {t['security']}
notes: >-
  [LEAD-DISPATCH-2026-04-28] Docker Dev 环境一致性改进系列任务。
  根因分析见诊断报告。
  {t['notes']}
"""
    
    with open(os.path.join(td, "TICKET.yaml"), "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"Created TICKET-{t['id']}")

print(f"\nDone. Created {len(tickets)} Platform tickets.")
