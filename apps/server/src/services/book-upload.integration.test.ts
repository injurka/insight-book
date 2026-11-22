import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'bun:test'

it('imports all supported book extensions through the API and validates persisted pages and TOC', async () => {
  const scratch = await mkdtemp(path.join(tmpdir(), 'insight-book-upload-'))

  try {
    const database = path.join(scratch, 'books.sqlite')
    const catalog = path.join(scratch, 'catalog.sqlite')
    const process = Bun.spawn({
      cmd: [Bun.argv[0], new URL('./testing/book-upload-scenario.ts', import.meta.url).pathname],
      env: {
        ...Bun.env,
        AUTH_MODE: 'single',
        DB_PATH: database,
        DATABASE_URL: `file:${database}`,
        CATALOG_DATABASE_URL: `file:${catalog}`,
        UPLOAD_STORAGE: 'local',
        UPLOADS_PATH: path.join(scratch, 'uploads'),
        WORKER_COUNT: '2',
        MAX_REQUEST_BODY_SIZE_MB: '2',
        LOG_LEVEL: 'error',
      },
      stdout: 'pipe',
      stderr: 'pipe',
      signal: AbortSignal.timeout(45_000),
    })
    const [code, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])

    expect(code, `${stdout}\n${stderr}`).toBe(0)
  }
  finally {
    await rm(scratch, { recursive: true, force: true })
  }
}, 50_000)
