import { Elysia, t } from 'elysia'
import { CORS_HEADERS } from '../config'
import { CATALOG_PLUGIN_STATUS } from '../constants/catalog-plugin'
import { catalogPluginService, getPluginContentType } from '../services/catalog-plugin.service'
import { authPlugin } from '../utils/auth'
import { cachePlugin } from '../utils/cache'

export const catalogRouter = new Elysia({ prefix: '/api/catalog/plugins' })
  .use(authPlugin)
  .use(cachePlugin)
  .get('/', async () => {
    return catalogPluginService.getPlugins()
  }, { cache: 'mediumPublic' })
  .get('/my', async ({ userId }) => {
    return catalogPluginService.getMyPlugins(userId)
  })
  .get('/pending', async ({ userId }) => {
    return catalogPluginService.getPendingPlugins(userId)
  })
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
    return catalogPluginService.uploadPlugin(userId, body.file)
  }, {
    body: t.Object({
      file: t.File(),
    }),
  })
  .patch('/:id/status', async ({ params, body, userId }) => {
    return catalogPluginService.setPluginStatus(userId, params.id, body.status)
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      status: t.Enum({ approved: CATALOG_PLUGIN_STATUS.APPROVED, rejected: CATALOG_PLUGIN_STATUS.REJECTED }),
    }),
  })
  .delete('/:id', async ({ params, userId }) => {
    return catalogPluginService.deletePlugin(userId, params.id)
  }, {
    params: t.Object({ id: t.String() }),
  })
