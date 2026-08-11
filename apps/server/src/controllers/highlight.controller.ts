import { Elysia, t } from 'elysia'
import { highlightService } from '../services/highlight.service'
import { authPlugin } from '../utils/auth'

import { cachePlugin } from '../utils/cache'

export const highlightRouter = new Elysia({ prefix: '/api/highlights' })
  .use(authPlugin)
  .use(cachePlugin)
  .get('/', async ({ query, userId }) => {
    const bookId = query.bookId ? Number(query.bookId) : undefined
    return highlightService.getHighlights(userId, bookId)
  }, {
    cache: 'shortPrivate',
    query: t.Optional(t.Object({
      bookId: t.Optional(t.String()),
    })),
  })
  .post('/', async ({ body, userId }) => {
    return highlightService.createHighlight(userId, body)
  }, {
    body: t.Object({
      bookId: t.Number(),
      text: t.String(),
      translation: t.Optional(t.String()),
      note: t.Optional(t.String()),
      color: t.Optional(t.String()),
      chapter: t.Optional(t.String()),
      pageNum: t.Number(),
      analysisData: t.Optional(t.Any()),
    }),
  })
  .put('/:id', async ({ params, body, userId }) => {
    return highlightService.updateHighlight(Number(params.id), userId, body)
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      text: t.Optional(t.String()),
      translation: t.Optional(t.String()),
      note: t.Optional(t.String()),
      color: t.Optional(t.String()),
      chapter: t.Optional(t.String()),
      pageNum: t.Optional(t.Number()),
      analysisData: t.Optional(t.Any()),
    }),
  })
  .delete('/:id', async ({ params, userId }) => {
    return highlightService.deleteHighlight(Number(params.id), userId)
  }, {
    params: t.Object({ id: t.String() }),
  })
