import { Elysia, t } from 'elysia'
import { highlightService } from '../services/highlight.service'
import { authPlugin } from '../utils/auth'

export const highlightRouter = new Elysia({ prefix: '/api/highlights' })
  .use(authPlugin)
  .get('/', async ({ query, userId }: any) => {
    const bookId = query.bookId ? Number(query.bookId) : undefined
    return highlightService.getHighlights(userId, bookId)
  }, {
    query: t.Optional(t.Object({
      bookId: t.Optional(t.String()),
    })),
  })
  .post('/', async ({ body, userId }: any) => {
    return highlightService.createHighlight(userId, body)
  }, {
    body: t.Object({
      bookId: t.Number(),
      text: t.String(),
      translation: t.Optional(t.String()),
      note: t.Optional(t.String()),
      color: t.Optional(t.String()),
      chapter: t.Optional(t.String()),
      pageNum: t.Optional(t.Number()),
      analysisData: t.Optional(t.Any()),
    }),
  })
  .put('/:id', async ({ params, body, userId }: any) => {
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
  .delete('/:id', async ({ params, userId }: any) => {
    return highlightService.deleteHighlight(Number(params.id), userId)
  }, {
    params: t.Object({ id: t.String() }),
  })
