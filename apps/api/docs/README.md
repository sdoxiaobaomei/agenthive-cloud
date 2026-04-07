# AgentHive API 文档

> API 服务文档中心 - v1.0.0

---

## 📚 文档目录

### API 参考

- [API_REFERENCE.md](API_REFERENCE.md) - 完整的 API 端点参考
- [TODO.md](TODO.md) - 功能开发 TODO 列表

### 数据库

- [database/README.md](database/README.md) - 数据库概览
- [database/POSTGRESQL_SETUP.md](database/POSTGRESQL_SETUP.md) - PostgreSQL 配置
- [database/REDIS_WEBSOCKET.md](database/REDIS_WEBSOCKET.md) - Redis 与 WebSocket

### 部署

- [deployment/](deployment/) - 部署配置文档（K8s, Docker）

### 指南

- [guides/STARTUP_GUIDE.md](guides/STARTUP_GUIDE.md) - 启动指南
- [guides/SETUP_SUMMARY.md](guides/SETUP_SUMMARY.md) - 配置总结

---

## 🚀 快速开始

### 开发模式

```bash
cd agenthive-cloud/apps/api
npm run dev
```

### 数据库初始化

```bash
npm run db:init
```

### 运行测试

```bash
npm test
```

---

## 📋 版本信息

- **当前版本**: 1.0.0
- **Node.js**: >= 20.0.0
- **TypeScript**: 5.3+

---

## 📄 License

MIT
