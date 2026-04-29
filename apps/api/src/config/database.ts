// 数据库配置
import pg from 'pg'
import logger from '../utils/logger.js'
const { Pool } = pg

// 数据库连接配置
export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'agenthive',
  user: process.env.DB_USER || 'agenthive',
  password: process.env.DB_PASSWORD || 'dev',
}

// 创建连接池
export const pool = new Pool({
  ...dbConfig,
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 连接空闲超时
  connectionTimeoutMillis: 2000, // 连接超时
})

// 测试连接
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT NOW()')
    logger.info('[Database] Connected', { now: result.rows[0].now })
    client.release()
    return true
  } catch (error) {
    logger.error('[Database] Connection failed', error as Error)
    return false
  }
}

// 关闭连接池
export const closePool = async (): Promise<void> => {
  await pool.end()
}
