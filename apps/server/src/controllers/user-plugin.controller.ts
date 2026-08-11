import { Elysia, t } from 'elysia'
import { userPluginService } from '../services/user-plugin.service'
import { authPlugin } from '../utils/auth'

import { cachePlugin } from '../utils/cache'

export const pluginRouter = new Elysia({ prefix: '/api/plugins' })
  .use(authPlugin)
  .use(cachePlugin)
  .get('/my', async ({ userId }) => {
    return userPluginService.getUserPlugins(userId)
  }, { cache: 'shortPrivate' })
  .post('/', async ({ body, userId }) => {
    return userPluginService.installPlugin(userId, body)
  }, {
    body: t.Object({
      pluginId: t.String(),
      manifestUrl: t.String(),
      settings: t.Optional(t.Nullable(t.String())),
      isEnabled: t.Optional(t.Boolean()),
    }),
  })
  .patch('/:pluginId', async ({ params, body, userId }) => {
    return userPluginService.updatePlugin(userId, params.pluginId, body)
  }, {
    params: t.Object({ pluginId: t.String() }),
    body: t.Object({
      settings: t.Optional(t.Nullable(t.String())),
      isEnabled: t.Optional(t.Boolean()),
    }),
  })
  .delete('/:pluginId', async ({ params, userId }) => {
    return userPluginService.uninstallPlugin(userId, params.pluginId)
  }, {
    params: t.Object({ pluginId: t.String() }),
  })
