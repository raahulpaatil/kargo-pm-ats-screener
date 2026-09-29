import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
import path from 'path'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const sql = neon(url)
const schema = readFileSync(path.join(__dirname, '../src/lib/schema.sql'), 'utf-8')

async function main() {
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    await sql.query(stmt)
  }
  console.log('Migration complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
