# Episode: Dev 环境资源优化 — Nacos 线程爆炸 & Java 内存统一调整

## 日期
2026-04-27

## 触发原因
Dev 环境 Nacos 内存使用 98.8% (758MB/768MB)，Auth/Payment 内存使用 86%，需要诊断根因并优化。

## 诊断结论

### Nacos：三重配置缺陷叠加
1. **JVM 年轻代畸形**: 镜像默认 `JVM_XMN=512m` = `JVM_XMX=512m`，老年代几乎为 0
2. **gRPC 线程池爆炸**: `sdkRpcExecutor` = CPU核心数 × `remote.executor.times.of.processors` (默认16)。Docker Desktop 32核 → 512 线程，仅线程栈就占 512MB
3. **参数注入位置错误**: Nacos `docker-startup.sh` 将 `JAVA_OPT_EXT` 放在 `-jar` **之后**，JVM 不识别。必须使用 `JAVA_TOOL_OPTIONS`

### Auth/Payment：容器内存限制过紧
- Java 21 + Spring Boot 3 + Nacos 客户端 + HikariCP + RabbitMQ，非堆内存约 60-100MB
- 512MB 容器中，JVM 堆 384M + 非堆 ≈ 440-480M，**不是内存泄漏**，是正常开销

### 额外发现
- 大部分 Java 服务（auth, user, payment, order）**缺少 actuator 依赖**
- 所有服务都**缺少 micrometer-registry-prometheus**
- `prometheus.yml` 中 Java 服务的 scrape target **全部注释**
- `.env.dev` 缺少 `REDIS_PASSWORD`，Redisson 发送空密码 AUTH 导致连接失败

## 已执行修复

| 服务 | 修改 |
|------|------|
| Nacos | 容器限制 768M→1536M, JVM_XMX 512m→1024m, XMN 384m, JAVA_TOOL_OPTIONS 限制线程池倍数为1 |
| Auth | 容器限制 512M→768M, JAVA_OPTS `-Xms256m -Xmx512m -XX:MaxMetaspaceSize=128m` |
| Payment | 同上 |
| Gateway | 同上 |
| User | 同上 |
| Order | 同上 |
| Cart | 同上 |
| Logistics | 同上 |
| Redis | command 追加 `--requirepass ${REDIS_PASSWORD:-agenthive}` |
| .env.dev | 追加 `REDIS_PASSWORD=agenthive` |

## 修复后验证
- Nacos: 954MB/1.5GB (62%), 247 线程 (原 998), nacos-grpc-executor 2 个 (原 512)
- Auth: 473MB/768MB (61%), healthy
- Payment: 480MB/768MB (62%), healthy
- docker-compose 配置语法验证通过

## 关键教训
1. **容器环境下的默认值可能是灾难**: Nacos 的 `remote.executor.times.of.processors=16` 在裸机合理，但在报告多核的容器环境中 = 线程爆炸
2. **JAVA_TOOL_OPTIONS 是容器注入 JVM 参数的最可靠方式**: 不受启动脚本位置影响
3. **线程栈是隐藏内存杀手**: 512 线程 × 1MB = 512MB，远大于堆内存增长
4. **监控埋点不是"有 Prometheus 就够了"**: 7 个 Java 服务中 4 个连 actuator 都没有，prometheus.yml 也没有配置 scrape

## Maestro Loop 后续执行记录

### Phase 2: Divergence → Agent 分派
用户要求通过子 Agent 完成后续优化。在分派过程中发现基础设施问题：

**Agent 工具循环解析 Bug**: 
- `Agent` 内置工具在加载 specialist agent（extend lead → subagents 含 platform → extend lead...）时陷入无限递归
- 错误路径：`lead/../platform/../lead/../node/../lead/../java/../lead/agent.yaml`
- **Workaround**: 通过 `kimi --print --agent-file path --input-format text --output-format text --final-message-only` CLI 直接启动 agent，绕过 `Agent` 工具的 subagent 解析

### Phase 2: Agent 输出收集

| Ticket | Agent | Confidence | 文件 | 状态 |
|--------|-------|------------|------|------|
| MON-1 | java | 0.98 | 14 files (7×pom.xml + 7×application-docker.yml) | ✅ completed |
| MON-2 | platform | 0.95 | monitoring/prometheus/prometheus.yml | ✅ completed |
| MON-2B | platform (CLI) | 1.0 | monitoring/docker-compose.yml | ✅ completed |
| NAC-3 | java | 0.88 | 无（纯调研） | ✅ completed |

### Phase 3: Convergence 审阅

**MON-1 抽查验证**:
- auth-service pom.xml: actuator + micrometer-registry-prometheus ✅
- auth-service application-docker.yml: management.endpoints.web.exposure.include = health,info,metrics,prometheus ✅
- cart-service/gateway-service: 未重复添加 actuator，正确覆盖 docker 配置 ✅

**MON-2 验证**:
- prometheus.yml 包含 7 个 java-* scrape job，metrics_path = /actuator/prometheus ✅

**MON-2B 验证**:
- prometheus service 同时加入 agenthive-monitoring 和 agenthive-dev 网络 ✅
- agenthive-dev 声明为 external: true ✅
- docker compose config 验证通过（exit code 0，warning 为 `version` obsolete 假失败）✅

**NAC-3 关键结论**:
- Nacos 2.4/2.5 镜像**未修复** JVM 默认值、线程池计算、JAVA_OPT_EXT 位置问题
- 建议升级到 2.4.2（低风险，修复安全漏洞）
- SCA 2023.0.1.0 的 Client 2.3.2 存在 Spring HttpHeaders 冲突 bug，需后续升级 SCA 到 2023.0.3.4+

### 新增教训
5. **Agent 工具存在 extend 链循环解析 bug**: 当 lead 定义 subagents 且 subagent extend lead 时，内置 `Agent` 工具会递归崩溃。需通过 CLI 方式 `kimi --print --agent-file` 绕过。
6. **Docker Compose `version` obsolete warning 不等于配置错误**: PowerShell 将 stderr warning 当作 NativeCommandError，需用 `$?` 或 `2>$null` 区分真假失败。
