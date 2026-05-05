/* eslint-disable no-console */
import type { ServeOptionsRoutes } from 'bun'
import { CORS_HEADERS, PORT } from './config'
import {
  handleAnalyzeBookStats,
  handleAnalyzeSentence,
  handleDeleteBook,
  handleGenerateTts,
  handleGetBookInfo,
  handleGetBooks,
  handleGetPage,
  handleGetToc,
  handleGetUserDict,
  handleGetWordFromUserDict,
  handleLookupWord,
  handleRemoveFromUserDict,
  handleUpdateBook,
  handleUpdateCover,
  handleUpdateStats,
  handleUploadBook,
  handleUpsertToUserDict,
} from './handlers/books'
import { withCors } from './utils/cors'
import { logRoutes } from './utils/print-routes'
import './db'

function corsOk() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const apiRoutes: ServeOptionsRoutes = {
  '/health': {
    GET: () => new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }),
  },
  '/api/books': {
    OPTIONS: corsOk,
    GET: handleGetBooks,
    POST: handleUploadBook,
  },
  '/api/books/upload': {
    OPTIONS: corsOk,
    POST: handleUploadBook,
  },
  '/api/books/:id': {
    OPTIONS: corsOk,
    PATCH: req => handleUpdateBook(req as Request, Number((req as any).params.id)),
    DELETE: req => handleDeleteBook(Number((req as any).params.id)),
  },
  '/api/books/:id/info': {
    OPTIONS: corsOk,
    GET: req => handleGetBookInfo(Number((req as any).params.id)),
  },
  '/api/books/:id/cover': {
    OPTIONS: corsOk,
    PATCH: req => handleUpdateCover(req as Request, Number((req as any).params.id)),
  },
  '/api/books/:id/tts': {
    OPTIONS: corsOk,
    POST: req => handleGenerateTts(req as Request, Number((req as any).params.id)),
  },
  '/api/books/:id/stats': {
    OPTIONS: corsOk,
    PATCH: req => handleUpdateStats(req as Request, Number((req as any).params.id)),
  },
  '/api/books/:id/analyze-book': {
    OPTIONS: corsOk,
    POST: req => handleAnalyzeBookStats(Number((req as any).params.id)),
  },
  '/api/books/:id/toc': {
    OPTIONS: corsOk,
    GET: req => handleGetToc(Number((req as any).params.id)),
  },
  '/api/books/:id/page/:pageNum': {
    OPTIONS: corsOk,
    GET: req => handleGetPage(
      Number((req as any).params.id),
      Number((req as any).params.pageNum),
    ),
  },
  '/api/books/:id/word/:word': {
    OPTIONS: corsOk,
    GET: req => handleLookupWord(Number((req as any).params.id), (req as any).params.word),
  },
  '/api/books/:id/analyze': {
    OPTIONS: corsOk,
    POST: handleAnalyzeSentence,
  },
  '/api/dictionary': {
    OPTIONS: corsOk,
    GET: handleGetUserDict,
    POST: handleUpsertToUserDict,
  },
  '/api/dictionary/:word': {
    OPTIONS: corsOk,
    GET: req => handleGetWordFromUserDict((req as any).params.word),
    DELETE: req => handleRemoveFromUserDict((req as any).params.word),
  },
}

Bun.serve({
  port: PORT,
  routes: apiRoutes,
  fetch() {
    return withCors(new Response('Not Found', { status: 404 }))
  },
  error(err: any) {
    console.error('[Server Error]', err)
    return withCors(new Response('Internal Server Error', { status: 500 }))
  },
})

console.log(`✅ Server running on port ${PORT}`)
logRoutes(apiRoutes, PORT)
