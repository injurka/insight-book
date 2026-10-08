import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const engine = vi.hoisted(() => ({ create: vi.fn(), highlight: vi.fn() }))
vi.mock('./highlight-engine', () => ({ HighlightEngine: { create: engine.create } }))
beforeEach(() => {
  vi.resetModules()
  engine.create.mockReset().mockResolvedValue(engine)
  engine.highlight.mockReset().mockImplementation((text: string) => ({ value: `<span>${text}</span>` }))
})
afterEach(() => vi.restoreAllMocks())

function container(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html

  return root
}

describe('highlightCodeBlocks', () => {
  it('does not load the engine without code blocks', async () => {
    const { highlightCodeBlocks } = await import('./code-highlighter')
    await highlightCodeBlocks(container('<p>text</p>'))
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('preserves code wrappers, processes each pre once and supports repeated theme changes', async () => {
    const { highlightCodeBlocks } = await import('./code-highlighter')
    const root = container('<pre class="language-js"><code>const x = 1</code></pre>')
    await highlightCodeBlocks(root, true)
    expect(root.querySelector('code span')?.textContent).toBe('const x = 1')
    expect(root.querySelector('pre')?.classList.contains('hljs-dark')).toBe(true)
    expect(engine.highlight).toHaveBeenCalledExactlyOnceWith('const x = 1', 'js')
    await highlightCodeBlocks(root, false)
    expect(root.querySelector('pre')?.classList.contains('hljs-dark')).toBe(false)
    expect(engine.create).toHaveBeenCalledTimes(1)
    expect(engine.highlight).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['<pre><code class="language-c++">code</code></pre>', 'c++'],
    ['<pre class="lang-python">code</pre>', 'python'],
    ['<pre><code class="language-undefined">code</code></pre>', undefined],
    ['<pre><code>code</code></pre>', undefined],
  ])('extracts languages from %s', async (html, language) => {
    const { highlightCodeBlocks } = await import('./code-highlighter')
    await highlightCodeBlocks(container(html))
    expect(engine.highlight).toHaveBeenCalledWith('code', language)
  })

  it('skips whitespace and leaves blocks unchanged without a result', async () => {
    const { highlightCodeBlocks } = await import('./code-highlighter')
    engine.highlight.mockReturnValue(null)
    const root = container('<pre><code>  </code></pre><pre><code>text</code></pre>')
    const html = root.innerHTML
    await highlightCodeBlocks(root)
    expect(root.innerHTML).toBe(html)
    expect(engine.highlight).toHaveBeenCalledTimes(1)
  })

  it('isolates a failed block so the following block still gets highlighted', async () => {
    const { highlightCodeBlocks } = await import('./code-highlighter')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    engine.highlight.mockImplementationOnce(() => {
      throw new Error('bad block')
    })
    const root = container('<pre><code>bad</code></pre><pre><code>good</code></pre>')
    await highlightCodeBlocks(root)
    expect(root.querySelectorAll('code')[0].textContent).toBe('bad')
    expect(root.querySelectorAll('code')[1].innerHTML).toBe('<span>good</span>')
  })

  it('retries initialization after failure and shares concurrent initialization', async () => {
    const { highlightCodeBlocks } = await import('./code-highlighter')
    engine.create.mockRejectedValueOnce(new Error('chunk offline'))
    await expect(highlightCodeBlocks(container('<pre><code>x</code></pre>'))).rejects.toThrow('chunk offline')
    await Promise.all([highlightCodeBlocks(container('<pre><code>x</code></pre>')), highlightCodeBlocks(container('<pre><code>y</code></pre>'))])
    expect(engine.create).toHaveBeenCalledTimes(2)
  })
})
