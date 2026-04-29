# Skill: Gateway lb:// 路由范式

## 问题
Spring Cloud Gateway 虽然启用了 Nacos Discovery，但路由配置中使用硬编码 `http://service:port`，导致：
- 无法利用 Nacos 的服务发现和健康检查
- 单实例故障时无法自动路由到健康实例
- 新增/缩容实例时需要手动修改 Gateway 配置

## 正确配置

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: auth-service
          uri: lb://auth-service
          predicates:
            - Path=/api/auth/**
          filters:
            - StripPrefix=1
```

## 规则
- **所有注册到 Nacos 的微服务**：必须使用 `lb://service-name`
- **未注册到 Nacos 的服务**（如 Node.js API）：保持 `http://service:port`
- **service-name** 必须与 `spring.application.name` 完全一致

## 反模式
```yaml
uri: http://auth-service:8081  # ❌ 硬编码，无法服务发现
```

## 关联 Ticket
- TICKET-PLAT-DEV-001
