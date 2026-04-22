import { pool } from '../src/config/database.js'

try {
  const result = await pool.query('SELECT NOW()')
  console.log('DB OK:', result.rows[0].now)
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
  console.log('Tables:', tables.rows.length)
  for (const r of tables.rows) console.log(' -', r.table_name)
} catch (e: any) {
  console.error('Error:', e.message)
}
await pool.end()
