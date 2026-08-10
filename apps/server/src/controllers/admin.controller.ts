import type { CATALOG_PLUGIN_STATUS } from '../constants/catalog-plugin'
import { Elysia, t } from 'elysia'
import { adminService } from '../services/admin.service'
import { authPlugin } from '../utils/auth'

export const adminRouter = new Elysia({ prefix: '/api/admin' })
  .use(authPlugin)

  .get('/subscription-tiers', async ({ userId }) => {
    return adminService.getSubscriptionTiers(userId)
  })

  .get('/stats', async ({ userId }) => {
    return adminService.getStats(userId)
  })

  .get('/users', async ({ userId, query }) => {
    return adminService.listUsers(userId, {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      search: query.search as string | undefined,
    })
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
      search: t.Optional(t.String()),
    }),
  })

  .get('/users/:id', async ({ userId, params }) => {
    return adminService.getUserDetail(userId, Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .post('/users', async ({ userId, body }) => {
    return adminService.createUser(userId, body as Parameters<typeof adminService.createUser>[1])
  }, {
    body: t.Object({
      username: t.String({ minLength: 2 }),
      password: t.String({ minLength: 6 }),
      role: t.Optional(t.String()),
      email: t.Optional(t.Nullable(t.String())),
      subscriptionTier: t.Optional(t.String()),
      tokenLimit: t.Optional(t.Number()),
      bookLimit: t.Optional(t.Number()),
    }),
  })

  .patch('/users/:id', async ({ userId, params, body }) => {
    return adminService.updateUser(userId, Number(params.id), body as Parameters<typeof adminService.updateUser>[2])
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      role: t.Optional(t.String()),
      subscriptionTier: t.Optional(t.String()),
      tokenLimit: t.Optional(t.Number()),
      bookLimit: t.Optional(t.Number()),
      username: t.Optional(t.String()),
      email: t.Optional(t.Nullable(t.String())),
      password: t.Optional(t.String()),
    }),
  })

  .delete('/users/:id', async ({ userId, params }) => {
    return adminService.deleteUser(userId, Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get('/books/pending', async ({ userId }) => {
    return adminService.listPendingBooks(userId)
  })

  .patch('/books/:id/public-status', async ({ userId, params, body }) => {
    return adminService.setBookPublicStatus(userId, Number(params.id), body.status as 'approved' | 'rejected')
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      status: t.Union([t.Literal('approved'), t.Literal('rejected')]),
    }),
  })

  // ─── Plugin Moderation (delegates to existing catalog) ──────
  .get('/plugins/pending', async ({ userId }) => {
    // Reuse the existing catalog plugin service's pending check
    const { catalogPluginService } = await import('../services/catalog-plugin.service')
    return catalogPluginService.getPendingPlugins(userId)
  })

  .patch('/plugins/:id/status', async ({ userId, params, body }) => {
    const { catalogPluginService } = await import('../services/catalog-plugin.service')
    return catalogPluginService.setPluginStatus(userId, params.id, body.status as typeof CATALOG_PLUGIN_STATUS.APPROVED | typeof CATALOG_PLUGIN_STATUS.REJECTED)
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      status: t.Union([t.Literal('approved'), t.Literal('rejected')]),
    }),
  })
