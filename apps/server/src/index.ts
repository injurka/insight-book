/* eslint-disable no-console */
import { CORS_HEADERS, PORT } from './config'
import { handleGetHeatmapData } from './handlers/activity'
import { handleGetMe, handleLogin } from './handlers/auth'
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
  handleLookupWord,
  handleStandaloneTts,
  handleUpdateBook,
  handleUpdateCover,
  handleUpdateStats,
  handleUploadBook,
} from './handlers/books'
import {
  handleBulkDeleteDict,
  handleBulkMoveDict,
  handleCreateDeck,
  handleDeleteDeck,
  handleGenerateExamples,
  handleGetDecks,
  handleGetReviewQueue,
  handleGetUserDict,
  handleGetWordFromUserDict,
  handleRemoveFromUserDict,
  handleSrsReview,
  handleUpdateDeck,
  handleUpsertToUserDict,
} from './handlers/dictionary'
import { authWrapper } from './utils/auth'
import { withCors } from './utils/cors'
import { apiWrapper } from './utils/errors'

import { logRoutes } from './utils/print-routes'
import './db'
import { initScheduler } from './services/scheduler.service'

function corsOk() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const apiRoutes = {
  '/health': { GET: apiWrapper(() => new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })) },

  // --- Auth ---
  '/api/auth/login': { OPTIONS: corsOk, POST: apiWrapper(handleLogin) },
  '/api/auth/me': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetMe)) },

  // --- Books API ---
  '/api/books': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetBooks)), POST: apiWrapper(authWrapper(handleUploadBook)) },
  '/api/books/upload': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleUploadBook)) },
  '/api/books/:id': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateBook)), DELETE: apiWrapper(authWrapper(handleDeleteBook)) },
  '/api/books/:id/info': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetBookInfo)) },
  '/api/books/:id/cover': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateCover)) },
  '/api/uploads/covers/:filename': { OPTIONS: corsOk, GET: apiWrapper(handleGetCoverImage) },
  '/api/books/:id/tts': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleGenerateTts)) },
  '/api/books/:id/stats': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateStats)) },
  '/api/books/:id/analyze-book': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleAnalyzeBookStats)) },
  '/api/books/:id/analyze-vocabulary': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleAnalyzeVocabulary)) },
  '/api/books/:id/toc': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetToc)) },
  '/api/books/:id/page/:pageNum': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetPage)) },
  '/api/books/:id/page/:pageNum/image': { OPTIONS: corsOk, GET: apiWrapper(handleGetPageImage) },
  '/api/books/:id/word/:word': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleLookupWord)) },
  '/api/books/:id/analyze': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleAnalyzeSentence)) },

  // --- Global TTS API ---
  '/api/tts': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleStandaloneTts)) },

  // --- Dictionary API ---
  '/api/dictionary': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetUserDict)), POST: apiWrapper(authWrapper(handleUpsertToUserDict)) },
  '/api/dictionary/bulk/delete': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleBulkDeleteDict)) },
  '/api/dictionary/bulk/move': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleBulkMoveDict)) },
  '/api/dictionary/generate-examples': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleGenerateExamples)) },

  // Decks
  '/api/dictionary/decks': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetDecks)), POST: apiWrapper(authWrapper(handleCreateDeck)) },
  '/api/dictionary/decks/:id': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateDeck)), DELETE: apiWrapper(authWrapper(handleDeleteDeck)) },

  // Review & SRS
  '/api/dictionary/review': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetReviewQueue)), POST: apiWrapper(authWrapper(handleSrsReview)) },

  // --- Activity API ---
  '/api/activity/heatmap': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetHeatmapData)) },

  // Words
  '/api/dictionary/:word': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetWordFromUserDict)), DELETE: apiWrapper(authWrapper(handleRemoveFromUserDict)) },
}

Bun.serve({
  port: PORT,
  idleTimeout: 255,
  routes: apiRoutes,
  fetch() { return withCors(new Response('Not Found', { status: 404 })) },
  error(err: any) {
    console.error('[Server Error]', err)
    return withCors(new Response('Internal Server Error', { status: 500 }))
  },
})

console.log(`✅ Server running on port ${PORT}`)
logRoutes(apiRoutes, PORT)

initScheduler()
