# [Draft] Dev/Prod Config Separation

> 来源: TICKET-P0-DEV-001 | 创建: 2026-04-27 | 考察期: 2026-05-27

## 场景

同一套代码在 dev/prod 运行，配置差异导致"在我机器上没问题"。

## 配置分离

```
nginx/
├── nginx.conf       # 生产（SSL、真实域名）
└── nginx.dev.conf   # 开发（localhost、无 SSL）
```

## docker-compose.dev.yml 检查项

```yaml
services:
  redis:
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --save 900 1 --save 300 10 --save 60 10000
      --requirepass ${REDIS_PASSWORD:-agenthive}
  payment-service:
    environment:
      - INTERNAL_API_TOKEN=${INTERNAL_API_TOKEN}
      - WITHDRAWAL_ENCRYPT_KEY=${WITHDRAWAL_ENCRYPT_KEY}
```

## 部署前检查清单

- [ ] nginx upstream 主机名与 docker-compose 服务名一致
- [ ] 所有 `${}` 占位符在 `.env.dev` 中有值
- [ ] AES-256 密钥恰好 32 字符
- [ ] `docker compose config` 无解析错误

## 变更同步机制

业务代码新增环境变量时，同步更新：
1. `.env.dev`
2. `.env.example`
3. `docker-compose.dev.yml` 的 `environment` 段
4. PR 描述标注 "Config Change"

## 注意

- `docker-compose.dev.yml` **不会自动加载** `.env.dev`，需 `--env-file .env.dev`
- postgres `/docker-entrypoint-initdb.d/` **只在数据目录为空时执行**

## 踩坑

TICKET-P0-DEV-001: `nginx.conf` 使用 `java-gateway:8080`，但 docker-compose 服务名是 `gateway-service`；`INTERNAL_API_TOKEN` 和 `WITHDRAWAL_ENCRYPT_KEY` 在 `.env.dev` 中未传入；AES-256 密钥第一次长度不对导致二次失败。
