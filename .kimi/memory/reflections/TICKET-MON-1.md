# Reflection: TICKET-MON-1 - Java 微服务 Prometheus 监控埋点统一接入

## 任务概述
为 7 个 Java 微服务统一补齐 Prometheus metrics 暴露能力，包括：
- gateway-service, auth-service, user-service, payment-service, order-service, cart-service, logistics-service

## 修改内容

### 1. pom.xml 依赖调整
| 服务 | actuator | prometheus | 说明 |
|------|----------|------------|------|
| gateway-service | 已有 | 新增 | 仅补 prometheus |
| auth-service | 新增 | 新增 | 两者均缺失 |
| user-service | 新增 | 新增 | 两者均缺失 |
| payment-service | 新增 | 新增 | 两者均缺失 |
| order-service | 新增 | 新增 | 两者均缺失 |
| cart-service | 已有 | 新增 | 仅补 prometheus |
| logistics-service | 已有 | 新增 | 仅补 prometheus |

### 2. application-docker.yml 管理端点配置
全部 7 个服务统一追加：
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    prometheus:
      enabled: true
    health:
      show-details: always
  metrics:
    tags:
      application: ${spring.application.name}
```

**注意**：cart-service 和 logistics-service 的 `application.yml` 中原有 `include: health,info,metrics`，通过 `application-docker.yml` 覆盖为包含 prometheus 的版本，符合要求（不修改 application.yml）。

## 验证结果
- `mvn compile -pl {all-7-modules} -am` 编译通过 ✅
- `mvn dependency:tree` 解析通过 ✅
- 全部 pom.xml 包含 `micrometer-registry-prometheus` ✅
- 全部 application-docker.yml 包含 `prometheus` 在 exposure.include 中 ✅

## 踩坑记录
1. **BOM 头问题**：部分 `application-docker.yml` 文件带有 UTF-8 BOM 头，导致 `StrReplaceFile` 的 exact match 在个别文件（user-service）首次失败，通过重新读取确认实际缩进后修复。
2. **Maven 路径**：环境变量中未配置 `mvn`，需使用绝对路径 `C:\tools\apache-maven-3.9.15\bin\mvn.cmd` 执行验证。

## 代码规范自检
- [x] 未修改任何 `.java` 业务代码
- [x] 未修改 `application.yml`，仅修改 `application-docker.yml`
- [x] 未引入 `spring-cloud-starter-actuator`（使用的是 `spring-boot-starter-actuator`）
- [x] 无 SQL 注入 / XSS / 敏感信息泄露风险（纯配置变更）
- [x] actuator 依赖未重复添加

## 后续建议
- 可考虑在 `common-web` 或 `common-core` 中统一引入 `micrometer-registry-prometheus`，避免每个服务重复声明（但当前遵循 Database Per Service / 独立依赖原则，显式声明更清晰）。
- Grafana dashboard 模板需与 `application` tag 保持一致，以便按服务维度筛选。
