import hljs from 'highlight.js/lib/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HighlightEngine } from './highlight-engine'

afterEach(() => vi.restoreAllMocks())

describe('highlightEngine', () => {
  it('returns null before initialization', () => {
    expect(new HighlightEngine().highlight('code')).toBeNull()
  })

  it.each([
    ['js', 'javascript'],
    ['TS', 'typescript'],
    ['py', 'python'],
    ['html', 'xml'],
    ['c++', 'cpp'],
    ['cs', 'csharp'],
    ['golang', 'go'],
    ['rs', 'rust'],
    ['yml', 'yaml'],
    ['md', 'markdown'],
    ['sh', 'bash'],
    ['shell', 'bash'],
  ])('registers and resolves alias %s', async (alias, language) => {
    const engine = await HighlightEngine.create()
    expect(engine.highlight('const value = 1', alias)?.language).toBe(language)
  })

  it('highlights real code and auto-detects unknown or missing languages', async () => {
    const engine = await HighlightEngine.create()
    expect(engine.highlight('const value = 1', 'javascript')?.value).toContain('hljs-keyword')

    for (const language of [undefined, 'unknown', 'constructor']) {
      const result = engine.highlight('const value = 1', language)
      expect(result?.value).toContain('value')
    }
  })

  it('escapes HTML when explicit highlighting or detection fails', async () => {
    const engine = await HighlightEngine.create()
    vi.spyOn(hljs, 'highlight').mockImplementation(() => {
      throw new Error('bad')
    })
    expect(engine.highlight('<script>&', 'js')).toEqual({ value: '&lt;script&gt;&amp;', language: 'javascript' })
    vi.spyOn(hljs, 'highlightAuto').mockImplementation(() => {
      throw new Error('bad')
    })
    expect(engine.highlight('<script>&')).toEqual({ value: '&lt;script&gt;&amp;', language: undefined })
  })
})
