/**
 * node-pg-migrate 配置文件 (CommonJS)
 * 
 * 使用方式：
 *   npx node-pg-migrate up          # 执行所有待迁移
 *   npx node-pg-migrate down        # 回滚最后一个
 *   npx node-pg-migrate create xxx  # 创建新迁移
 */

module.exports = {
  // 数据库连接配置
  // 优先级：DATABASE_URL > DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD > 本地默认
  databaseUrl: (() => {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '5432';
    const db   = process.env.DB_NAME || 'agenthive';
    const user = process.env.DB_USER || 'agenthive';
    const pass = process.env.DB_PASSWORD || 'dev';
    return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
  })(),
  
  // 迁移文件目录
  migrationsDir: 'src/db/migrations',
  
  // 迁移表名
  migrationsTable: '_migrations',
  
  // 迁移表字段配置
  migrationsTableOptions: {
    name: 'name',
    applied_at: 'applied_at'
  },
  
  // 日志配置
  verbose: true,
  
  // 检查顺序（按文件名排序）
  checkOrder: true,
  
  // 方向（默认只执行 up）
  direction: 'up',
  
  // 计数（down 时回滚几个，默认 1）
  count: 1,
  
  // 忽略缺失的迁移文件
  ignoreMissing: false,
  
  // 单个事务执行所有迁移（生产环境推荐 false，每个迁移独立事务）
  allInTransaction: false,
  
  // 锁定超时（毫秒）
  lockTimeoutMs: 30000,
  
  // Schema（默认 public）
  schema: 'public'
};
