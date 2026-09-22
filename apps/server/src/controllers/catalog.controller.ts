import { Elysia, t } from 'elysia'
import { CORS_HEADERS } from '../config'
import { CATALOG_PLUGIN_STATUS } from '../constants/catalog-plugin'
import { ERROR_CODES } from '../constants/error-codes'
import { catalogPluginService, getPluginContentType } from '../services/catalog-plugin.service'
import { optionalAuthPlugin } from '../utils/auth'
import { cachePlugin } from '../utils/cache'
import { AppError } from '../utils/errors'

function requireUserId(userId: number | null): number {
  if (!userId) {
    throw new AppError(401, ERROR_CODES.AUTH.UNAUTHORIZED, 'Unauthorized')
  }

  return userId
}

export const catalogRouter = new Elysia({ prefix: '/api/catalog/plugins' })
  // Публичные записи каталога и файлы одобренных плагинов должны быть
  // доступны без Authorization: Module Federation загружает remoteEntry.js
  // отдельным script-запросом и не может передать Bearer-токен приложения.
  .use(optionalAuthPlugin)
  .use(cachePlugin)
  .get('/', async () => {
    return catalogPluginService.getPlugins()
  }, { cache: 'mediumPublic' })
  .get('/my', async ({ userId }) => {
    return catalogPluginService.getMyPlugins(requireUserId(userId))
  }, { cache: 'shortPrivate' })
  .get('/pending', async ({ userId }) => {
    return catalogPluginService.getPendingPlugins(requireUserId(userId))
  }, { cache: 'shortPrivate' })
  .get('/files/*', async ({ params, set }) => {
    const storageKey = `plugins/${params['*']}`
    const fileData = await catalogPluginService.getPluginFile(storageKey)
    if (!fileData) {
      set.status = 404
      return 'Not found'
    }
    set.headers = {
      ...CORS_HEADERS,
      'Content-Type': getPluginContentType(storageKey),
    }
    return Buffer.from(fileData.buffer)
  }, { cache: 'hourPublic' })
  .get('/:id', async ({ params }) => {
    return catalogPluginService.getPlugin(params.id)
  }, {
    params: t.Object({ id: t.String() }),
    cache: 'mediumPublic',
  })
  .post('/upload', async ({ body, userId }) => {
    return catalogPluginService.uploadPlugin(requireUserId(userId), body.file)
  }, {
    body: t.Object({
      file: t.File(),
    }),
  })
  .patch('/:id/status', async ({ params, body, userId }) => {
    return catalogPluginService.setPluginStatus(requireUserId(userId), params.id, body.status)
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      status: t.Enum({ approved: CATALOG_PLUGIN_STATUS.APPROVED, rejected: CATALOG_PLUGIN_STATUS.REJECTED }),
    }),
  })
  .delete('/:id', async ({ params, userId }) => {
    return catalogPluginService.deletePlugin(requireUserId(userId), params.id)
  }, {
    params: t.Object({ id: t.String() }),
  })
