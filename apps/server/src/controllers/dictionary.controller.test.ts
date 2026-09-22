import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { handleElysiaError } from '../utils/errors'
import { catalogRouter } from './catalog.controller'
import { dictionaryController } from './dictionary.controller'

describe('Dictionary router authentication scope', () => {
  it('does not require dictionary authorization on subsequently composed routers', async () => {
    const app = new Elysia()
      .onError(handleElysiaError)
      .use(dictionaryController)
      .use(catalogRouter)

    const response = await app.handle(
      new Request('http://localhost/api/catalog/plugins/files/invalid-path'),
    )

    expect(response.status).toBe(400)
  })
})
