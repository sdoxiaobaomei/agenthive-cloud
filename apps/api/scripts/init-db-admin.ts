// Database initialization with admin user
import pg from 'pg'
const { Pool } = pg

// Admin connection config
const adminConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'postgres', // Connect to default postgres database first
  user: 'postgres',     // Default admin user
  password: 'admin',    // Default admin password
}

// Target database config
const targetDbName = process.env.DB_NAME || 'agenthive'
const targetDbUser = process.env.DB_USER || 'agenthive'
const targetDbPassword = process.env.DB_PASSWORD || 'agenthive123'

async function initDatabase() {
  console.log('[InitDB] Starting database initialization...')
  console.log('[InitDB] Admin user: postgres')
  console.log('[InitDB] Target database:', targetDbName)
  
  const adminPool = new Pool(adminConfig)
  
  try {
    // 1. Check if database exists, create if not
    console.log('[InitDB] Checking database...')
    const dbCheck = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName]
    )
    
    if (dbCheck.rowCount === 0) {
      console.log(`[InitDB] Creating database ${targetDbName}...`)
      await adminPool.query(`CREATE DATABASE ${targetDbName}`)
      console.log(`[InitDB] Database ${targetDbName} created`)
    } else {
      console.log(`[InitDB] Database ${targetDbName} already exists`)
    }
    
    // 2. Check if user exists, create if not
    console.log('[InitDB] Checking user...')
    const userCheck = await adminPool.query(
      `SELECT 1 FROM pg_user WHERE usename = $1`,
      [targetDbUser]
    )
    
    if (userCheck.rowCount === 0) {
      console.log(`[InitDB] Creating user ${targetDbUser}...`)
      await adminPool.query(
        `CREATE USER ${targetDbUser} WITH PASSWORD $1`,
        [targetDbPassword]
      )
      console.log(`[InitDB] User ${targetDbUser} created`)
    } else {
      console.log(`[InitDB] User ${targetDbUser} already exists`)
      // Update password
      await adminPool.query(
        `ALTER USER ${targetDbUser} WITH PASSWORD $1`,
        [targetDbPassword]
      )
      console.log(`[InitDB] User ${targetDbUser} password updated`)
    }
    
    // 3. Grant privileges
    console.log('[InitDB] Granting privileges...')
    await adminPool.query(`GRANT ALL PRIVILEGES ON DATABASE ${targetDbName} TO ${targetDbUser}`)
    console.log('[InitDB] Privileges granted')
    
    await adminPool.end()
    
    // 4. Connect to target database and create tables
    console.log('[InitDB] Connecting to target database...')
    const targetPool = new Pool({
      ...adminConfig,
      database: targetDbName,
    })
    
    // Read schema SQL
    const schemaPath = new URL('../src/db/schema.sql', import.meta.url)
    const schema = await (await fetch(schemaPath)).text()
    
    console.log('[InitDB] Creating tables...')
    await targetPool.query(schema)
    console.log('[InitDB] Tables created')
    
    // 5. Grant table privileges
    await targetPool.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${targetDbUser}`)
    await targetPool.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${targetDbUser}`)
    console.log('[InitDB] Table privileges granted')
    
    await targetPool.end()
    
    console.log('[InitDB] ✅ Database initialized successfully!')
    
  } catch (error) {
    console.error('[InitDB] ❌ Failed:', error)
    process.exit(1)
  }
}

initDatabase()
