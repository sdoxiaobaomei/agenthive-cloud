# Java 后端变更日志 (CHANGELOG)

> **目标读者**：前端工程师、Java 后端工程师、DevOps 工程师  
> **适用范围**：`apps/java` - AgentHive Java 微服务集群

---

## 目录

- [网关变更（影响 DevOps）](#网关变更影响-devops)
- [服务层变更（影响前端/Java 后端）](#服务层变更影响前端java-后端)
- [部署注意事项](#部署注意事项)

---

## 网关变更（影响 DevOps）

### 路由从硬编码改为服务发现

- **变更前**：路由硬编码为 `http://localhost:808x`
- **变更后**：路由改为 `lb://service-name`，通过服务名进行负载均衡
- **示例**：
  ```yaml
  # 变更前
  uri: http://localhost:8081

  # 变更后
  uri: lb://auth-service
  ```
- **影响**：
  - 服务实例可动态扩缩容，无需修改网关配置
  - 支持 Nacos 服务发现自动注册/注销
  - 本地开发时需确保 Nacos 正常运行

### 新增依赖 `spring-cloud-starter-loadbalancer`

- **依赖坐标**：
  ```xml
  <dependency>
      <groupId>org.springframework.cloud</groupId>
      <artifactId>spring-cloud-starter-loadbalancer</artifactId>
  </dependency>
  ```
- **用途**：提供客户端负载均衡能力，配合 `lb://` 协议使用
- **注意**：确保网关 `pom.xml` 中已引入该依赖

### 限流 Lua 脚本修复过期漏洞

- **漏洞描述**：原 Lua 脚本在部分边界场景下可能导致 Redis Key 永不过期
- **修复内容**：确保每次 `INCR` 后都执行 `EXPIRE`，并明确设置窗口过期时间
- **当前脚本逻辑**：
  ```lua
  local key = KEYS[1];
  local limit = tonumber(ARGV[1]);
  local window = tonumber(ARGV[2]);
  local current = redis.call('GET', key);
  if current == false then
    redis.call('SET', key, 1, 'EX', window);
    return 1;
  end;
  local count = tonumber(current);
  if count >= limit then
    return 0;
  else
    redis.call('INCR', key);
    redis.call('EXPIRE', key, window);  -- 确保过期
    return 1;
  end
  ```
- **限流配置**：
  - 单 IP 限制：200 请求 / 60 秒
  - 超出限制返回 HTTP 429 (Too Many Requests)

---

## 服务层变更（影响前端/Java 后端）

### AuthController 分层修复

- **变更内容**：`/users/{id}/roles` 逻辑从 Controller 下沉到 Service 层
- **涉及文件**：
  - `auth-service/src/main/java/com/agenthive/auth/controller/AuthController.java`
  - `auth-service/src/main/java/com/agenthive/auth/service/AuthService.java`
  - `auth-service/src/main/java/com/agenthive/auth/service/impl/AuthServiceImpl.java`
- **对前端影响**：**接口契约不变**，URL、请求/响应格式保持兼容
- **改进点**：
  - 职责分离更清晰
  - 便于单元测试和复用
  - 符合分层架构规范

### order-service 清理重复代码

- **变更内容**：清理 `order-service` 中的重复代码，统一使用 `common-core` / `common-web`
- **涉及范围**：
  - 统一异常处理（使用 `common-web` 的 `GlobalExceptionHandler`）
  - 统一响应封装（使用 `common-core` 的 `Result<T>`）
  - 统一工具类（ID 生成、日期处理等）
- **对前端影响**：**响应格式标准化**，错误码和消息体更加统一
- **对 Java 后端影响**：
  - 其他服务迁移时请参考 `order-service` 的改造方式
  - 优先使用 `common-core` 和 `common-web` 提供的公共能力

---

## 部署注意事项

### Nacos 服务发现真正生效

- **变更内容**：Nacos 服务发现现在真正生效，各服务启动时会自动注册到 Nacos
- **配置要求**：
  ```yaml
  spring:
    application:
      name: auth-service  # 必须与网关路由中的 service-id 一致
    cloud:
      nacos:
        discovery:
          server-addr: ${NACOS_SERVER:nacos:8848}
  ```
- **检查命令**：
  ```bash
  curl http://localhost:8848/nacos/v1/ns/service/list?pageNo=1&pageSize=10
  ```

### 服务名与网关路由一致性要求

- **要求**：各服务 `spring.application.name` 必须与网关路由配置中的 `service-id` 完全一致
- **对照表**：

  | 服务 | `spring.application.name` | 网关路由 URI |
  |------|---------------------------|--------------|
  | 认证服务 | `auth-service` | `lb://auth-service` |
  | 订单服务 | `order-service` | `lb://order-service` |
  | 支付服务 | `payment-service` | `lb://payment-service` |
  | 购物车服务 | `cart-service` | `lb://cart-service` |
  | 物流服务 | `logistics-service` | `lb://logistics-service` |

- **不一致后果**：网关无法找到对应服务，返回 HTTP 503 (Service Unavailable)

---

> 如有疑问，请联系 Java 后端团队或查阅 `java/README.md`。
