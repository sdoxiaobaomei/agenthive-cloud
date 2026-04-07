// Simple database initialization script
import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Admin config to create database and user
const adminConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'postgres',
  user: 'postgres',
  password: 'admin',
}

// Target database
const dbName = process.env.DB_NAME || 'agenthive'
const dbUser = process.env.DB_USER || 'agenthive'
const dbPassword = process.env.DB_PASSWORD || 'agenthive123'

async function init() {
  console.log('[InitDB] Starting initialization...')
  
  const pool = new Pool(adminConfig)
  
  try {
    // Create database
    console.log('[InitDB] Creating database if not exists...')
    await pool.query(`CREATE DATABASE ${dbName}`).catch(() => {
      console.log('[InitDB] Database already exists')
    })
    
    // Create user
    console.log('[InitDB] Creating user if not exists...')
    await pool.query(`CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}'`).catch(() => {
      console.log('[InitDB] User already exists, updating password...')
      return pool.query(`ALTER USER ${dbUser} WITH PASSWORD '${dbPassword}'`)
    })
    
    // Grant privileges
    await pool.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser}`)
    console.log('[InitDB] Privileges granted')
    
    await pool.end()
    
    // Connect to target DB and create tables
    console.log('[InitDB] Creating tables...')
    const targetPool = new Pool({ ...adminConfig, database: dbName })
    
    const schemaSQL = readFileSync(join(__dirname, '../src/db/schema.sql'), 'utf-8')
    await targetPool.query(schemaSQL)
    
    // Grant table privileges
    await targetPool.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${dbUser}`)
    await targetPool.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${dbUser}`)
    await targetPool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${dbUser}`)
    
    console.log('[InitDB] Tables created')
    await targetPool.end()
    
    console.log('[InitDB] ✅ Initialization complete!')
    
  } catch (error) {
    console.error('[InitDB] ❌ Error:', error.message)
    process.exit(1)
  }
}

init()
