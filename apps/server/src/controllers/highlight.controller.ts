import { Elysia, t } from 'elysia'
import { highlightService } from '../services/highlight.service'
import { authPlugin } from '../utils/auth'
import { cachePlugin } from '../utils/cache'
import { handleElysiaError } from '../utils/errors'

export const highlightRouter = new Elysia({ prefix: '/api/highlights' })
  .use(authPlugin)
  .use(cachePlugin)
  .onError(handleElysiaError)
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
      translation: t.Optional(t.Nullable(t.String())),
      note: t.Optional(t.Nullable(t.String())),
      color: t.Optional(t.Nullable(t.String())),
      chapter: t.Optional(t.Nullable(t.String())),
      pageNum: t.Number(),
      analysisData: t.Optional(t.Nullable(t.Any())),
    }),
  })
  .put('/:id', async ({ params, body, userId }) => {
    return highlightService.updateHighlight(Number(params.id), userId, body)
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      text: t.Optional(t.String()),
      translation: t.Optional(t.Nullable(t.String())),
      note: t.Optional(t.Nullable(t.String())),
      color: t.Optional(t.Nullable(t.String())),
      chapter: t.Optional(t.Nullable(t.String())),
      pageNum: t.Optional(t.Number()),
      analysisData: t.Optional(t.Nullable(t.Any())),
    }),
  })
  .delete('/:id', async ({ params, userId }) => {
    return highlightService.deleteHighlight(Number(params.id), userId)
  }, {
    params: t.Object({ id: t.String() }),
  })
