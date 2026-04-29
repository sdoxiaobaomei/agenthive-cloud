# Skill: 多源 SQL Schema 一致性检查

## 问题
微服务项目中，同一数据库表可能在多个 SQL 文件中定义：
- `src/main/resources/db/schema.sql` —— 框架自动执行
- `src/main/resources/db/init.sql` —— 容器初始化
- `../../scripts/init-schemas.sql` —— 全局 Docker 初始化

变更时极易遗漏同步，导致不同环境表结构不一致。

## 检查清单
1. [ ] 同一服务内的 `schema.sql` 和 `init.sql` 表名、字段、类型、约束完全一致
2. [ ] `init-schemas.sql`（全局初始化）中的表结构与服务内 `init.sql` 一致
3. [ ] 表名统一使用业务语义命名（如 `sys_user`），避免同一业务对象出现 `t_auth_user` / `sys_user` 等多个名称

## CI 检查建议
```bash
# 伪代码：提取所有 CREATE TABLE 语句并比对表名+字段
for service in apps/java/*-service; do
  diff <(extract_schema $service/src/main/resources/db/schema.sql) \
       <(extract_schema $service/src/main/resources/db/init.sql)
done
```

## 关联 Ticket
- TICKET-PLAT-DEV-002
