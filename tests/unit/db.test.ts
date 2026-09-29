import { describe, it, expect, afterEach } from 'vitest'
import { sql } from '@/lib/db'

describe('db', () => {
  let insertedId: string | undefined

  afterEach(async () => {
    if (insertedId) {
      await sql`delete from candidates where id = ${insertedId}`
      insertedId = undefined
    }
  })

  it('inserts and reads a candidate row', async () => {
    const rows = await sql`
      insert into candidates (role, name, file_url, file_name, resume_text)
      values ('PM', 'Test Candidate', 'https://example.com/f.pdf', 'f.pdf', 'sample text')
      returning id, role, name
    `
    insertedId = rows[0].id as string
    expect(rows[0].role).toBe('PM')
    expect(rows[0].name).toBe('Test Candidate')
  })
})
