/* eslint-disable no-console */
import { CORS_HEADERS, PORT } from './config'
import { handleGetHeatmapData, handleGetTokenUsage } from './handlers/activity'
import { handleGetAvatarImage, handleGetMe, handleLogin, handleUpdateAvatar, handleUpdateUsername, handleYandexAuth, handleYandexCallback } from './handlers/auth'
import {
  handleAnalyzeBatch,
  handleAnalyzeBookStats,
  handleAnalyzeSentence,
  handleAnalyzeVocabulary,
  handleAppendMangaChapter,
  handleCheckCache,
  handleCreateCustomBook,
  handleDeleteBook,
  handleGenerateTts,
  handleGetBookInfo,
  handleGetBooks,
  handleGetCoverImage,
  handleGetPage,
  handleGetPageDictionary,
  handleGetPageImage,
  handleGetToc,
  handleLookupWord,
  handleStandaloneTts,
  handleStartReading,
  handleUpdateBook,
  handleUpdateCover,
  handleUpdateStats,
  handleUploadBook,
} from './handlers/books'
import {
  handleAutoFillWord,
  handleBulkDeleteDict,
  handleBulkMoveDict,
  handleCheckPronunciation,
  handleCloneCatalogDeck,
  handleCreateDeck,
  handleDeleteDeck,
  handleGenerateDeepDive,
  handleGenerateExamples,
  handleGetCatalogDecks,
  handleGetCatalogWords,
  handleGetDecks,
  handleGetReviewQueue,
  handleGetUserDict,
  handleGetWordFromUserDict,
  handleImportCsv,
  handleRemoveFromUserDict,
  handleSrsReview,
  handleUpdateDeck,
  handleUpsertToUserDict,
} from './handlers/dictionary'
import {
  handleCreateHighlight,
  handleDeleteHighlight,
  handleGetHighlights,
  handleUpdateHighlight,
} from './handlers/highlights'
import {
  handleAddCatalog,
  handleBrowseOpds,
  handleDeleteCatalog,
  handleDownloadOpdsBook,
  handleGetCatalogs,
} from './handlers/opds'
import { handleGetVapidKey, handleSubscribe, handleUnsubscribe } from './handlers/push'

import { initScheduler } from './services/scheduler.service'
import { authWrapper, optionalAuthWrapper } from './utils/auth'
import { withCors } from './utils/cors'
import { apiWrapper } from './utils/errors'
import { corsOk } from './utils/helpers'
import { logRoutes } from './utils/print-routes'

import './db'

const apiRoutes = {
  '/health': { GET: apiWrapper(() => new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })) },

  // --- Auth ---
  '/api/auth/login': { OPTIONS: corsOk, POST: apiWrapper(handleLogin) },
  '/api/auth/yandex': { OPTIONS: corsOk, GET: apiWrapper(handleYandexAuth) },
  '/api/auth/yandex/callback': { OPTIONS: corsOk, GET: apiWrapper(handleYandexCallback) },
  '/api/auth/me': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetMe)) },
  '/api/auth/me/avatar': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateAvatar)) },
  '/api/auth/me/username': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateUsername)) },
  '/api/uploads/avatars/:filename': { OPTIONS: corsOk, GET: apiWrapper(handleGetAvatarImage) },

  // --- Books API ---
  '/api/books': { OPTIONS: corsOk, GET: apiWrapper(optionalAuthWrapper(handleGetBooks)), POST: apiWrapper(authWrapper(handleUploadBook)) },
  '/api/books/upload': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleUploadBook)) },
  '/api/books/custom': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleCreateCustomBook)) },
  '/api/books/:id/start': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleStartReading)) },
  '/api/books/:id/manga-chapter': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleAppendMangaChapter)) },
  '/api/books/:id': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateBook)), DELETE: apiWrapper(authWrapper(handleDeleteBook)) },
  '/api/books/:id/info': { OPTIONS: corsOk, GET: apiWrapper(optionalAuthWrapper(handleGetBookInfo)) },
  '/api/books/:id/cover': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateCover)) },
  '/api/uploads/covers/:filename': { OPTIONS: corsOk, GET: apiWrapper(handleGetCoverImage) },
  '/api/books/:id/tts': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleGenerateTts)) },
  '/api/books/:id/stats': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateStats)) },
  '/api/books/:id/analyze-book': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleAnalyzeBookStats)) },
  '/api/books/:id/analyze-vocabulary': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleAnalyzeVocabulary)) },
  '/api/books/:id/cache-check': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleCheckCache)) },
  '/api/books/:id/analyze-batch': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleAnalyzeBatch)) },
  '/api/books/:id/toc': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetToc)) },
  '/api/books/:id/page/:pageNum': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetPage)) },
  '/api/books/:id/page/:pageNum/dict': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetPageDictionary)) },
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
  '/api/dictionary/auto-fill': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleAutoFillWord)) },
  '/api/dictionary/deep-dive': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleGenerateDeepDive)) },

  // Decks
  '/api/dictionary/decks': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetDecks)), POST: apiWrapper(authWrapper(handleCreateDeck)) },
  '/api/dictionary/decks/:id': { OPTIONS: corsOk, PATCH: apiWrapper(authWrapper(handleUpdateDeck)), DELETE: apiWrapper(authWrapper(handleDeleteDeck)) },

  // Catalog & Import
  '/api/dictionary/catalog': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetCatalogDecks)) },
  '/api/dictionary/catalog/:id/words': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetCatalogWords)) },
  '/api/dictionary/catalog/:id/clone': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleCloneCatalogDeck)) },
  '/api/dictionary/import': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleImportCsv)) },

  // Review & SRS
  '/api/dictionary/review': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetReviewQueue)), POST: apiWrapper(authWrapper(handleSrsReview)) },
  '/api/dictionary/pronunciation': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleCheckPronunciation)) },

  // --- Activity API ---
  '/api/activity/heatmap': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetHeatmapData)) },
  '/api/activity/tokens': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetTokenUsage)) },

  // Words
  '/api/dictionary/:word': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetWordFromUserDict)), DELETE: apiWrapper(authWrapper(handleRemoveFromUserDict)) },

  // --- OPDS API ---
  '/api/opds/catalogs': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetCatalogs)), POST: apiWrapper(authWrapper(handleAddCatalog)) },
  '/api/opds/catalogs/:id': { OPTIONS: corsOk, DELETE: apiWrapper(authWrapper(handleDeleteCatalog)) },
  '/api/opds/browse': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleBrowseOpds)) },
  '/api/opds/download': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleDownloadOpdsBook)) },

  // --- Highlights API ---
  '/api/highlights': { OPTIONS: corsOk, GET: apiWrapper(authWrapper(handleGetHighlights)), POST: apiWrapper(authWrapper(handleCreateHighlight)) },
  '/api/highlights/:id': { OPTIONS: corsOk, PUT: apiWrapper(authWrapper(handleUpdateHighlight)), DELETE: apiWrapper(authWrapper(handleDeleteHighlight)) },

  // --- Push ---
  '/api/push/vapid-public-key': { OPTIONS: corsOk, GET: apiWrapper(handleGetVapidKey) },
  '/api/push/subscribe': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleSubscribe)) },
  '/api/push/unsubscribe': { OPTIONS: corsOk, POST: apiWrapper(authWrapper(handleUnsubscribe)) },

}

Bun.serve({
  port: PORT,
  idleTimeout: 255,
  routes: apiRoutes,
  maxRequestBodySize: 5000 * 1024 * 1024,
  fetch() { return withCors(new Response('Not Found', { status: 404 })) },
  error(err: any) {
    console.error('[Server Error]', err)
    return withCors(new Response('Internal Server Error', { status: 500 }))
  },
})

console.log(`✅ Server running on port ${PORT}`)
logRoutes(apiRoutes, PORT)

initScheduler()
