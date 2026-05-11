/* eslint-disable no-console */
import type { ServeOptionsRoutes } from 'bun'
import { CORS_HEADERS, PORT } from './config'
import {
  handleAnalyzeBookStats,
  handleAnalyzeSentence,
  handleAnalyzeVocabulary,
  handleDeleteBook,
  handleGenerateTts,
  handleGetBookInfo,
  handleGetBooks,
  handleGetCoverImage,
  handleGetPage,
  handleGetPageImage,
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
import { apiWrapper } from './utils/errors'
import { logRoutes } from './utils/print-routes'

import './db'

function corsOk() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const apiRoutes: ServeOptionsRoutes = {
  '/health': {
    GET: apiWrapper(() => new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })),
  },
  '/api/books': {
    OPTIONS: corsOk,
    GET: apiWrapper(handleGetBooks),
    POST: apiWrapper(handleUploadBook),
  },
  '/api/books/upload': {
    OPTIONS: corsOk,
    POST: apiWrapper(handleUploadBook),
  },
  '/api/books/:id': {
    OPTIONS: corsOk,
    PATCH: apiWrapper(handleUpdateBook),
    DELETE: apiWrapper(handleDeleteBook),
  },
  '/api/books/:id/info': {
    OPTIONS: corsOk,
    GET: apiWrapper(handleGetBookInfo),
  },
  '/api/books/:id/cover': {
    OPTIONS: corsOk,
    PATCH: apiWrapper(handleUpdateCover),
  },
  '/api/uploads/covers/:filename': {
    OPTIONS: corsOk,
    GET: apiWrapper(handleGetCoverImage),
  },
  '/api/books/:id/tts': {
    OPTIONS: corsOk,
    POST: apiWrapper(handleGenerateTts),
  },
  '/api/books/:id/stats': {
    OPTIONS: corsOk,
    PATCH: apiWrapper(handleUpdateStats),
  },
  '/api/books/:id/analyze-book': {
    OPTIONS: corsOk,
    POST: apiWrapper(handleAnalyzeBookStats),
  },
  '/api/books/:id/analyze-vocabulary': {
    OPTIONS: corsOk,
    POST: apiWrapper(handleAnalyzeVocabulary),
  },
  '/api/books/:id/toc': {
    OPTIONS: corsOk,
    GET: apiWrapper(handleGetToc),
  },
  '/api/books/:id/page/:pageNum': {
    OPTIONS: corsOk,
    GET: apiWrapper(handleGetPage),
  },
  '/api/books/:id/page/:pageNum/image': {
    OPTIONS: corsOk,
    GET: apiWrapper(handleGetPageImage),
  },
  '/api/books/:id/word/:word': {
    OPTIONS: corsOk,
    GET: apiWrapper(handleLookupWord),
  },
  '/api/books/:id/analyze': {
    OPTIONS: corsOk,
    POST: apiWrapper(handleAnalyzeSentence),
  },
  '/api/dictionary': {
    OPTIONS: corsOk,
    GET: apiWrapper(handleGetUserDict),
    POST: apiWrapper(handleUpsertToUserDict),
  },
  '/api/dictionary/:word': {
    OPTIONS: corsOk,
    GET: apiWrapper(handleGetWordFromUserDict),
    DELETE: apiWrapper(handleRemoveFromUserDict),
  },
}

Bun.serve({
  port: PORT,
  idleTimeout: 255,
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
