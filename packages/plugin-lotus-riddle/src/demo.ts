import type { PluginLlmGeneratePayload, PluginLlmGenerateResult } from '@injurka/insight-book-plugin-api'
import { createMockPluginContext } from '@injurka/insight-book-plugin-api/testing'
import { createApp, h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import plugin from './index'
import { record } from './shared/contracts'
import RiddlePage from './ui/riddle-page.vue'

// A deterministic preview. This entry is never exposed to the host as ./Plugin.
function demoGenerate(payload: PluginLlmGeneratePayload): PluginLlmGenerateResult<unknown> {
  const input: unknown = JSON.parse(payload.prompt ?? '{}')

  if (!record(input))
    return { success: false }

  if (payload.action === 'lotus_classify' && Array.isArray(input.vocabulary))
    return { success: true, data: { items: input.vocabulary.filter(record).map(word => ({ id: word.id, noun: word.word !== 'run', playable: word.word !== 'run' })) } }

  if (payload.action === 'lotus_mystery')
    return { success: true, data: { introduction: 'В сумерках даже обычная вещь может стать маленьким чудом. Что я загадал?', facts: ['Это неживой предмет.', 'Он создан человеком.', 'Его можно держать в руках.', 'Он даёт свет.'], hints: ['Это вещь, созданная человеком.', 'Её используют, когда темно.', 'У неё есть источник света и защитная оболочка.'] } }

  if (payload.action === 'lotus_answer' && record(input.move))
    return demoAnswer(input.move)

  return { success: false }
}
function demoAnswer(move: Record<string, unknown>): PluginLlmGenerateResult<unknown> {
  const text = String(move.text).toLocaleLowerCase()

  if (move.kind === 'guess')
    return { success: true, data: { verdict: /фонарь|灯笼/u.test(text) ? 'almost' : 'no', direction: 'neutral' } }

  if (/жив|animal|eat|раст/u.test(text))
    return { success: true, data: { verdict: 'no', direction: 'away' } }

  if (/рук|свет|дом|light|hold|house/u.test(text))
    return { success: true, data: { verdict: 'yes', direction: 'closer' } }

  return { success: true, data: { verdict: 'unclear', direction: 'neutral' } }
}
const parameters = new URLSearchParams(location.search)
const mock = createMockPluginContext({
  userProfile: { id: 'lotus-demo' },
  words: parameters.has('empty')
    ? []
    : [
        {
          id: 900001,
          word: 'lantern',
          translation: 'фонарь',
          language: 'en',
          due: '2020-01-01T00:00:00.000Z',
          reps: 3,
        },
        {
          id: 900002,
          word: 'run',
          translation: 'бежать',
          language: 'en',
          due: '2020-01-02T00:00:00.000Z',
          reps: 2,
        },
      ],
  onLlmGenerate: async (payload) => {
    await new Promise(resolve => setTimeout(resolve, 450))

    if (parameters.has('ai-error'))
      return { success: false }

    return demoGenerate(payload)
  },
})
async function bootDemo() {
  await plugin.activate?.(mock.context)
  const app = createApp({
    render: () => [
      h('div', { style: 'background:#24170f;color:#e5c78e;padding:6px 16px;font:12px sans-serif;text-align:center' }, 'Демо · ответы подготовлены заранее · реальные LLM и SRS не подключены'),
      h(RiddlePage),
    ],
  })
  const router = createRouter({ history: createWebHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  app.use(router)
  app.mount('#app')
}
void bootDemo()
