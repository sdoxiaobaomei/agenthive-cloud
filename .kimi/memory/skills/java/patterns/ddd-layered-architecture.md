# Pattern: DDD 分层架构

```
com.agenthive.{service}/
├── application/          # 应用服务，编排领域对象
│   ├── service/          # ApplicationService
│   └── dto/              # DTO / Command / Query
├── domain/               # 领域层，核心业务逻辑
│   ├── entity/           # 聚合根 + 实体
│   ├── valueobject/      # 值对象
│   ├── repository/       # 仓储接口
│   └── service/          # 领域服务
├── infrastructure/       # 基础设施
│   ├── mapper/           # MyBatis Mapper
│   ├── repository/       # 仓储实现
│   └── config/           # 配置类
└── interfaces/           # 接口适配层
    ├── controller/       # REST API
    └── facade/           # 对外Facade
```

规则:
- Controller 只负责解析请求、调用 Service、返回 Result<T>
- Service 只负责编排，不写业务逻辑
- 业务逻辑在 domain/service/ 或 entity 内部
- 禁止跨层调用（Controller 直接调 Mapper）
