# Skill: Spring Cloud Nacos Bootstrap 标准化模板

## 问题
微服务项目中，各服务的 `bootstrap.yml` 容易出现环境变量命名不一致（如 `NACOS_HOST` vs `NACOS_SERVER`）、结构差异（缺少 `spring.application.name`）等问题，导致部分服务无法正确连接 Nacos。

## 标准化模板

```yaml
spring:
  application:
    name: ${SERVICE_NAME}
  cloud:
    nacos:
      config:
        server-addr: ${NACOS_SERVER:localhost:8848}
        namespace: ${NACOS_NAMESPACE:}
        file-extension: yaml
        username: ${NACOS_USERNAME:}
        password: ${NACOS_PASSWORD:}
      discovery:
        server-addr: ${NACOS_SERVER:localhost:8848}
        namespace: ${NACOS_NAMESPACE:}
        username: ${NACOS_USERNAME:}
        password: ${NACOS_PASSWORD:}
        ephemeral: false
        heart-beat-interval: 5000
        register-enabled: true
```

## 关键约束
- **必须使用 `${NACOS_SERVER}`**，禁止使用 `${NACOS_HOST}:${NACOS_PORT}` 组合
- **必须包含 `spring.application.name`**，确保 Nacos 注册名正确
- **docker-compose 中注入**：`NACOS_SERVER=nacos:8848`、`NACOS_USERNAME=agenthive`、`NACOS_PASSWORD=${NACOS_PASSWORD}`

## 验证命令
```bash
grep -r "NACOS_HOST\|NACOS_PORT" apps/java/*/src/main/resources/bootstrap.yml
# 期望输出为空
grep -L "spring.application.name" apps/java/*/src/main/resources/bootstrap.yml
# 期望输出为空
```

## 关联 Ticket
- TICKET-PLAT-DEV-001
