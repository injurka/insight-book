import path from 'node:path'
import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

const dbUrl = process.env.DATABASE_URL || `file:${process.env.DB_PATH || path.resolve(process.cwd(), 'db', 'insight-book.sqlite')}`
const authToken = process.env.DATABASE_AUTH_TOKEN

const isRemote = dbUrl.startsWith('libsql://') || dbUrl.startsWith('https://')

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: isRemote ? 'turso' : 'sqlite',
  dbCredentials: {
    url: dbUrl,
    authToken,
  },
})
