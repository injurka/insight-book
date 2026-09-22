import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { handleElysiaError } from '../utils/errors'
import { catalogRouter } from './catalog.controller'

describe('Catalog plugin router', () => {
  const app = new Elysia().onError(handleElysiaError).use(catalogRouter)

  it('does not require authorization for public plugin files', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/catalog/plugins/files/invalid-path'),
    )

    // The route is reached and validates the storage path. With the old
    // mandatory auth plugin this request returned 401 before validation.
    expect(response.status).toBe(400)
  })

  it('keeps user catalog operations protected', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/catalog/plugins/my'),
    )

    expect(response.status).toBe(401)
  })
})
