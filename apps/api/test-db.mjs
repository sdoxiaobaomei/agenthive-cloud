// Test PostgreSQL connection with password "admin"
import pg from 'pg'
const { Pool } = pg

console.log('Testing PostgreSQL with user "postgres", password "admin"...')
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'admin',
  connectionTimeoutMillis: 5000,
})

try {
  const client = await pool.connect()
  const result = await client.query('SELECT NOW() as now, version() as version')
  console.log('✅ Connected successfully!')
  console.log('  Time:', result.rows[0].now)
  console.log('  Version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1])
  
  // Check if agenthive database exists
  const dbResult = await client.query("SELECT datname FROM pg_database WHERE datname = 'agenthive'")
  if (dbResult.rows.length > 0) {
    console.log('  Database "agenthive": EXISTS')
  } else {
    console.log('  Database "agenthive": NOT FOUND - will create...')
    await client.query('CREATE DATABASE agenthive')
    console.log('  ✅ Created database "agenthive"')
  }
  
  // Check if agenthive user exists
  const userResult = await client.query("SELECT usename FROM pg_user WHERE usename = 'agenthive'")
  if (userResult.rows.length > 0) {
    console.log('  User "agenthive": EXISTS')
  } else {
    console.log('  User "agenthive": NOT FOUND - will create...')
    await client.query("CREATE USER agenthive WITH PASSWORD 'agenthive123'")
    await client.query('GRANT ALL PRIVILEGES ON DATABASE agenthive TO agenthive')
    console.log('  ✅ Created user "agenthive"')
  }
  
  // Grant privileges on schema
  await client.query('GRANT ALL ON SCHEMA public TO agenthive')
  
  client.release()
  console.log('\n✅ PostgreSQL is ready for API server!')
} catch (error) {
  console.error('❌ Connection failed:', error.message)
} finally {
  await pool.end()
}
