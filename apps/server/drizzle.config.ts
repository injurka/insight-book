import path from 'node:path'
import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'db', 'insight-book.sqlite')

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: `file:${dbPath}`,
  },
})
