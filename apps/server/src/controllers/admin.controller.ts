import type { CatalogPluginStatus } from '../constants/catalog-plugin'
import type { ProductEventCategory } from '../constants/product-events'
import type { AdminUserSortBy, SortDirection, UserLifecycleSegment } from '../types/admin-analytics'
import { Elysia, t } from 'elysia'
import { adminAnalyticsService } from '../services/admin-analytics.service'
import { adminService } from '../services/admin.service'
import { subscriptionTierService } from '../services/subscription-tier.service'
import { userEventService } from '../services/user-event.service'
import { authPlugin } from '../utils/auth'

const localizedFields = {
  badgeEn: t.Optional(t.String()),
  badgeRu: t.Optional(t.String()),
  badgeZh: t.Optional(t.String()),
  nameEn: t.Optional(t.String()),
  nameRu: t.Optional(t.String()),
  nameZh: t.Optional(t.String()),
  descriptionEn: t.Optional(t.String()),
  descriptionRu: t.Optional(t.String()),
  descriptionZh: t.Optional(t.String()),
  featuresEn: t.Optional(t.Array(t.String())),
  featuresRu: t.Optional(t.Array(t.String())),
  featuresZh: t.Optional(t.Array(t.String())),
}

const tierBody = t.Object({
  id: t.Optional(t.String()),
  sortOrder: t.Optional(t.Number()),
  icon: t.Optional(t.String()),
  price: t.Optional(t.Number()),
  dailyTokenLimit: t.Optional(t.Nullable(t.Number())),
  dailyBookLimit: t.Optional(t.Nullable(t.Number())),
  isPopular: t.Optional(t.Boolean()),
  gradient: t.Optional(t.String()),
  accentColor: t.Optional(t.String()),
  ...localizedFields,
})

export const adminRouter = new Elysia({ prefix: '/api/admin' })
  .use(authPlugin)

  .get('/subscription-tiers', async ({ userId }) => {
    await adminService.assertAdmin(userId)

    return subscriptionTierService.list()
  })

  .post('/subscription-tiers', async ({ userId, body }) => {
    await adminService.assertAdmin(userId)

    return subscriptionTierService.create(body as Parameters<typeof subscriptionTierService.create>[0])
  }, {
    body: tierBody,
  })

  .patch('/subscription-tiers/:id', async ({ userId, params, body }) => {
    await adminService.assertAdmin(userId)

    return subscriptionTierService.update(params.id, body as Parameters<typeof subscriptionTierService.update>[1])
  }, {
    params: t.Object({ id: t.String() }),
    body: tierBody,
  })

  .delete('/subscription-tiers/:id', async ({ userId, params }) => {
    await adminService.assertAdmin(userId)
    await subscriptionTierService.remove(params.id)

    return { success: true }
  }, {
    params: t.Object({ id: t.String() }),
  })

  .get('/stats', async ({ userId }) => {
    return adminService.getStats(userId)
  })

  .get('/analytics/overview', async ({ userId, query }) => {
    return adminAnalyticsService.getOverview(userId, query.days ? Number(query.days) : 30)
  }, {
    query: t.Object({
      days: t.Optional(t.Numeric()),
    }),
  })

  .get('/analytics/events/overview', async ({ userId, query }) => {
    return userEventService.getAdminEventsOverview(userId, query.days ? Number(query.days) : 30)
  }, {
    query: t.Object({
      days: t.Optional(t.Numeric()),
    }),
  })

  .get('/analytics/events/funnel', async ({ userId, query }) => {
    const stepList = (query.steps || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    return userEventService.getAdminCustomFunnel(userId, stepList, query.days ? Number(query.days) : 30)
  }, {
    query: t.Object({
      steps: t.String(),
      days: t.Optional(t.Numeric()),
    }),
  })

  .get('/analytics/events', async ({ userId, query }) => {
    return userEventService.listAdminEvents(userId, {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 30,
      event: query.event as string | undefined,
      category: query.category as ProductEventCategory | 'all' | undefined,
      userId: query.targetUserId ? Number(query.targetUserId) : undefined,
    })
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
      event: t.Optional(t.String()),
      category: t.Optional(t.String()),
      targetUserId: t.Optional(t.Numeric()),
    }),
  })

  .post('/analytics/events/cleanup', async ({ userId, body }) => {
    await adminService.assertAdmin(userId)

    return userEventService.cleanupExpiredEvents(body?.retentionDays)
  }, {
    body: t.Optional(t.Object({
      retentionDays: t.Optional(t.Number({ minimum: 7, maximum: 365 })),
    })),
  })

  .get('/users', async ({ userId, query }) => {
    return adminAnalyticsService.listUsersWithAnalytics(userId, {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      search: query.search as string | undefined,
      segment: query.segment as UserLifecycleSegment | 'all' | undefined,
      sortBy: query.sortBy as AdminUserSortBy | undefined,
      sortDir: query.sortDir as SortDirection | undefined,
    })
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
      search: t.Optional(t.String()),
      segment: t.Optional(t.Union([
        t.Literal('all'),
        t.Literal('active'),
        t.Literal('cooling'),
        t.Literal('inactive'),
        t.Literal('never_activated'),
      ])),
      sortBy: t.Optional(t.Union([
        t.Literal('createdAt'),
        t.Literal('lastActiveAt'),
        t.Literal('activeSeconds'),
        t.Literal('pagesRead'),
        t.Literal('usedTokens'),
      ])),
      sortDir: t.Optional(t.Union([
        t.Literal('asc'),
        t.Literal('desc'),
      ])),
    }),
  })

  .get('/users/:id/analytics', async ({ userId, params }) => {
    return adminAnalyticsService.getUserDetailedAnalytics(userId, Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .get('/users/:id/events', async ({ userId, params, query }) => {
    return userEventService.getAdminUserEvents(userId, Number(params.id), {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 30,
      event: query.event as string | undefined,
      category: query.category as ProductEventCategory | 'all' | undefined,
    })
  }, {
    params: t.Object({ id: t.Numeric() }),
    query: t.Object({
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
      event: t.Optional(t.String()),
      category: t.Optional(t.String()),
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

  .get('/books/public', async ({ userId, query }) => {
    return adminService.listPublicBooks(userId, {
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

  .delete('/books/:id', async ({ userId, params }) => {
    return adminService.deleteBook(userId, Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .patch('/books/:id/public-status', async ({ userId, params, body }) => {
    return adminService.setBookPublicStatus(userId, Number(params.id), body.status as 'approved' | 'rejected')
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      status: t.Union([t.Literal('approved'), t.Literal('rejected')]),
    }),
  })

  // ─── Plugin Moderation & Catalog Management ──────
  .get('/plugins', async ({ userId, query }) => {
    const { catalogPluginService } = await import('../services/catalog-plugin.service')
    const status = query.status && query.status !== 'all' ? query.status : undefined

    return catalogPluginService.listPlugins(userId, status)
  }, {
    query: t.Object({
      status: t.Optional(t.Union([
        t.Literal('all'),
        t.Literal('pending'),
        t.Literal('approved'),
        t.Literal('rejected'),
      ])),
    }),
  })

  .get('/plugins/pending', async ({ userId }) => {
    // Reuse the existing catalog plugin service's pending check
    const { catalogPluginService } = await import('../services/catalog-plugin.service')

    return catalogPluginService.getPendingPlugins(userId)
  })

  .patch('/plugins/:id/versions/:version/status', async ({ userId, params, body }) => {
    const { catalogPluginService } = await import('../services/catalog-plugin.service')

    return catalogPluginService.setPluginStatus(
      userId,
      params.id,
      params.version,
      body.status as Extract<CatalogPluginStatus, 'approved' | 'rejected'>,
    )
  }, {
    params: t.Object({ id: t.String(), version: t.String() }),
    body: t.Object({
      status: t.Union([t.Literal('approved'), t.Literal('rejected')]),
    }),
  })

  .patch('/plugins/:id/status', async ({ userId, params, body }) => {
    const { catalogPluginService } = await import('../services/catalog-plugin.service')

    return catalogPluginService.setLatestPluginStatus(userId, params.id, body.status as Extract<CatalogPluginStatus, 'approved' | 'rejected'>)
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      status: t.Union([t.Literal('approved'), t.Literal('rejected')]),
    }),
  })

  .delete('/plugins/:id', async ({ userId, params }) => {
    const { catalogPluginService } = await import('../services/catalog-plugin.service')

    return catalogPluginService.deletePlugin(userId, params.id)
  }, {
    params: t.Object({ id: t.String() }),
  })

  .get('/plugins/:id/versions/:version/download', async ({ userId, params, set }) => {
    const { catalogPluginService } = await import('../services/catalog-plugin.service')
    const archive = await catalogPluginService.downloadPlugin(userId, params.id, params.version)
    set.headers = {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${archive.filename}"`,
    }

    return Buffer.from(archive.buffer)
  }, {
    params: t.Object({ id: t.String(), version: t.String() }),
  })

  .get('/plugins/:id/download', async ({ userId, params, set }) => {
    const { catalogPluginService } = await import('../services/catalog-plugin.service')
    const archive = await catalogPluginService.downloadPlugin(userId, params.id)
    set.headers = {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${archive.filename}"`,
    }

    return Buffer.from(archive.buffer)
  }, {
    params: t.Object({ id: t.String() }),
  })
