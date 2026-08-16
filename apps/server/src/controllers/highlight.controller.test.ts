import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { highlightRouter } from './highlight.controller'

describe('Highlight Router', () => {
  it('accepts payload with note: null and optional fields as null', async () => {
    const app = new Elysia().use(highlightRouter)

    const payload = {
      bookId: 6,
      text: '“It’s said he betrayed a god.”',
      color: '#c4b5fd',
      pageNum: 8,
      chapter: 'Prologue',
      translation: 'Говорят, он предал бога.',
      note: null,
      analysisData: {
        transcription: 'ɪts sɛd hi bɪˈtreɪd ə ɡɒd',
        translation: 'Говорят, он предал бога.',
        grammarRules: [
          {
            pattern: 'It is said that...',
            explanation: 'Безличная конструкция, используемая для передачи слухов или общеизвестных фактов.',
            example: 'It is said that he is rich.',
          },
        ],
        vocabulary: [
          {
            word: 'betray',
            transcription: 'bɪˈtreɪ',
            meaning: 'предавать',
            usageInContext: 'Нарушить верность или доверие.',
          },
        ],
      },
    }

    // Request without auth will be stopped by authPlugin (401), not validation error (400/500)
    const res = await app.handle(
      new Request('http://localhost/api/highlights?targetLang=ru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    )

    // Should not return 500 (validation error previously caused 500)
    expect(res.status).not.toBe(500)
    expect(res.status).toBe(401)
  })
})
