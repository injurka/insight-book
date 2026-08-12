import { Elysia, t } from 'elysia'
import { subscriptionTierService } from '../services/subscription-tier.service'
import { cachePlugin } from '../utils/cache'

/**
 * Публичный API тарифов подписки.
 * Язык передаётся ПУТЁМ (/api/subscription-tiers/en), а не query —
 * у BunnyCDN query не входит в кэш-ключ, а варианты на одном пути подмешивались бы друг в друга.
 */
export const subscriptionRouter = new Elysia({ prefix: '/api/subscription-tiers' })
  .use(cachePlugin)
  .get('/:lang', async ({ params }) => {
    return subscriptionTierService.listLocalized(params.lang)
  }, {
    params: t.Object({
      lang: t.Union([t.Literal('en'), t.Literal('ru'), t.Literal('zh')]),
    }),
    cache: 'shortPublic',
  })
