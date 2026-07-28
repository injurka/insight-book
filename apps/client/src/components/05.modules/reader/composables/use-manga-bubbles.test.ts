import type { Highlight, OcrBlock, PagePayload } from '~/shared/types/models'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The stores pull in @pinia/colada queries and repository access via DI.
// Replace both with inert stubs — these tests exercise the composable's
// interaction with Pinia state, not the network layer.
vi.mock('@pinia/colada', async () => {
  const { ref } = await import('vue')
  return {
    useQuery: () => ({
      data: ref(null),
      isLoading: ref(false),
      refetch: vi.fn().mockResolvedValue(undefined),
    }),
    useMutation: () => ({ mutateAsync: vi.fn() }),
    useQueryCache: () => ({ invalidateQueries: vi.fn() }),
  }
})

vi.mock('~/shared/plugins/di', () => ({
  useRepos: () => ({}),
  defaultRepositories: {},
}))

vi.mock('~/shared/composables/use-umami', () => ({
  useUmami: () => ({ trackEvent: vi.fn() }),
}))

const { useMangaBubbles } = await import('./use-manga-bubbles')
const { useAnalysisStore } = await import('~/shared/store/analysis/analysis.store')
const { useGlobalSettingsStore } = await import('~/shared/store/settings.store')
const { useHighlightsStore } = await import('../store/highlights.store')
const { useReaderStore } = await import('../store/reader.store')

function makeBox(overrides: Partial<OcrBlock> = {}): OcrBlock {
  return {
    id: 1,
    text: 'こんにちは',
    x: 100,
    y: 200,
    w: 50,
    h: 100,
    ...overrides,
  }
}

function makePage(overrides: Partial<PagePayload> = {}): PagePayload {
  return {
    bookId: 1,
    pageNum: 5,
    totalPages: 100,
    content: '',
    type: 'manga',
    imageWidth: 1000,
    imageHeight: 2000,
    ...overrides,
  }
}

function setup() {
  const onPointerDown = vi.fn()
  const onWordClick = vi.fn()
  const bubbles = useMangaBubbles(onPointerDown, onWordClick)
  return {
    bubbles,
    onPointerDown,
    onWordClick,
    analysisStore: useAnalysisStore(),
    settingsStore: useGlobalSettingsStore(),
    highlightsStore: useHighlightsStore(),
    readerStore: useReaderStore(),
  }
}

describe('useMangaBubbles', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  describe('getBoxStyle', () => {
    it('converts pixel box coordinates to percentages of the page image', () => {
      const { bubbles, readerStore } = setup()
      readerStore.currentPage = makePage()

      // Coordinates are stored as ratios of the image size, so zooming/panning
      // the image (CSS transform) automatically scales the bubbles with it.
      expect(bubbles.getBoxStyle(makeBox())).toEqual({
        left: '10%',
        top: '10%',
        width: '5%',
        height: '5%',
      })
    })

    it('returns an empty style when image dimensions are missing', () => {
      const { bubbles, readerStore } = setup()
      readerStore.currentPage = makePage({ imageWidth: undefined, imageHeight: undefined })
      expect(bubbles.getBoxStyle(makeBox())).toEqual({})

      readerStore.currentPage = null
      expect(bubbles.getBoxStyle(makeBox())).toEqual({})
    })
  })

  describe('getOuterNumberStyle', () => {
    it('offsets the bubble position by 8px using calc()', () => {
      const { bubbles, readerStore } = setup()
      readerStore.currentPage = makePage()

      expect(bubbles.getOuterNumberStyle(makeBox())).toEqual({
        left: 'calc(10% - 8px)',
        top: 'calc(10% - 8px)',
      })
    })

    it('returns an empty style when image dimensions are missing', () => {
      const { bubbles, readerStore } = setup()
      readerStore.currentPage = makePage({ imageWidth: 0, imageHeight: 0 })
      expect(bubbles.getOuterNumberStyle(makeBox())).toEqual({})
    })
  })

  describe('handleBubbleClick', () => {
    it('opens the active bubble in popover mode', () => {
      const { bubbles, settingsStore } = setup()
      settingsStore.mangaOcrDisplayMode = 'popover'

      const target = document.createElement('div')
      const event = new MouseEvent('click')
      Object.defineProperty(event, 'currentTarget', { value: target })
      const stopSpy = vi.spyOn(event, 'stopPropagation')

      const box = makeBox()
      bubbles.handleBubbleClick(
        event,
        box,
        0,
        1,
      )

      expect(stopSpy).toHaveBeenCalled()
      expect(bubbles.activeBubble.value).toEqual(box)
      expect(bubbles.bubbleReference.value).toBe(target)
    })

    it('ignores clicks after a long drag while zoomed in', () => {
      const { bubbles, settingsStore } = setup()
      settingsStore.mangaOcrDisplayMode = 'popover'

      const event = new MouseEvent('click')
      bubbles.handleBubbleClick(
        event,
        makeBox(),
        11,
        2,
      )
      expect(bubbles.activeBubble.value).toBeNull()

      // short drag is still treated as a click
      bubbles.handleBubbleClick(
        event,
        makeBox(),
        10,
        2,
      )
      expect(bubbles.activeBubble.value).not.toBeNull()

      // at scale 1 the drag distance does not matter
      bubbles.activeBubble.value = null
      bubbles.handleBubbleClick(
        event,
        makeBox(),
        50,
        1,
      )
      expect(bubbles.activeBubble.value).not.toBeNull()
    })

    it('does not open the bubble popover in hover mode', () => {
      const { bubbles, settingsStore } = setup()
      settingsStore.mangaOcrDisplayMode = 'hover'

      bubbles.handleBubbleClick(
        new MouseEvent('click'),
        makeBox(),
        0,
        1,
      )
      expect(bubbles.activeBubble.value).toBeNull()
    })

    it('closes an open word popover before activating a bubble', () => {
      const { bubbles, analysisStore, settingsStore } = setup()
      settingsStore.mangaOcrDisplayMode = 'popover'
      analysisStore.wordPopover = { word: 'test' } as never

      bubbles.handleBubbleClick(
        new MouseEvent('click'),
        makeBox(),
        0,
        1,
      )
      expect(analysisStore.wordPopover).toBeNull()
      expect(bubbles.activeBubble.value).not.toBeNull()
    })
  })

  describe('handleBubblePointerDown', () => {
    it('forwards the event and bubble text in hover mode', () => {
      const { bubbles, onPointerDown, settingsStore } = setup()
      settingsStore.mangaOcrDisplayMode = 'hover'

      const event = new MouseEvent('pointerdown')
      const box = makeBox({ text: 'テキスト' })
      bubbles.handleBubblePointerDown(event, box)

      expect(onPointerDown).toHaveBeenCalledWith(event, 'テキスト')
    })

    it('does nothing in popover mode', () => {
      const { bubbles, onPointerDown, settingsStore } = setup()
      settingsStore.mangaOcrDisplayMode = 'popover'

      bubbles.handleBubblePointerDown(new MouseEvent('pointerdown'), makeBox())
      expect(onPointerDown).not.toHaveBeenCalled()
    })
  })

  describe('closeBubblePopover', () => {
    it('clears the active bubble and its reference', () => {
      const { bubbles, settingsStore } = setup()
      settingsStore.mangaOcrDisplayMode = 'popover'
      bubbles.handleBubbleClick(
        new MouseEvent('click'),
        makeBox(),
        0,
        1,
      )

      bubbles.closeBubblePopover()
      expect(bubbles.activeBubble.value).toBeNull()
      expect(bubbles.bubbleReference.value).toBeNull()
    })

    it('keeps the popover when the click lands inside a word popover', () => {
      const { bubbles, settingsStore } = setup()
      settingsStore.mangaOcrDisplayMode = 'popover'
      bubbles.handleBubbleClick(
        new MouseEvent('click'),
        makeBox(),
        0,
        1,
      )

      const popover = document.createElement('div')
      popover.className = 'word-popover'
      const inner = document.createElement('span')
      popover.appendChild(inner)
      document.body.appendChild(popover)

      bubbles.closeBubblePopover(new MouseEvent('click', { bubbles: true }))
      expect(bubbles.activeBubble.value).toBeNull() // no target on a synthetic event -> closes

      bubbles.handleBubbleClick(
        new MouseEvent('click'),
        makeBox(),
        0,
        1,
      )
      const event = new MouseEvent('click')
      Object.defineProperty(event, 'target', { value: inner })
      bubbles.closeBubblePopover(event)
      expect(bubbles.activeBubble.value).not.toBeNull()
      popover.remove()
    })
  })

  describe('handleBubblePopoverClick', () => {
    it('closes the word popover when the click is not on a word', () => {
      const { bubbles, analysisStore, onWordClick } = setup()
      const closeSpy = vi.spyOn(analysisStore, 'closePopover')

      const event = new MouseEvent('click')
      Object.defineProperty(event, 'target', { value: document.createElement('div') })
      bubbles.handleBubblePopoverClick(event)

      expect(closeSpy).toHaveBeenCalled()
      expect(onWordClick).not.toHaveBeenCalled()
    })

    it('closes the word popover for words with pos "x"', () => {
      const { bubbles, analysisStore, onWordClick } = setup()
      const closeSpy = vi.spyOn(analysisStore, 'closePopover')

      const word = document.createElement('span')
      word.className = 'word'
      word.dataset.pos = 'x'
      const event = new MouseEvent('click')
      Object.defineProperty(event, 'target', { value: word })
      bubbles.handleBubblePopoverClick(event)

      expect(closeSpy).toHaveBeenCalled()
      expect(onWordClick).not.toHaveBeenCalled()
    })

    it('delegates clicks on regular words to onWordClick', () => {
      const { bubbles, analysisStore, onWordClick } = setup()
      const closeSpy = vi.spyOn(analysisStore, 'closePopover')

      const word = document.createElement('span')
      word.className = 'word'
      word.dataset.pos = 'n'
      const event = new MouseEvent('click')
      Object.defineProperty(event, 'target', { value: word })
      bubbles.handleBubblePopoverClick(event)

      expect(onWordClick).toHaveBeenCalledWith(event)
      expect(closeSpy).not.toHaveBeenCalled()
    })
  })

  describe('getBubbleHighlightStyle', () => {
    function makeHighlight(overrides: Partial<Highlight> = {}): Highlight {
      return {
        id: 1,
        userId: 1,
        bookId: 1,
        text: 'こんにちは',
        translation: null,
        note: null,
        color: '#fde047',
        chapter: null,
        pageNum: 5,
        createdAt: '',
        ...overrides,
      }
    }

    it('returns an empty style when the bubble has no text or highlights are disabled', () => {
      const { bubbles, readerStore, settingsStore } = setup()
      readerStore.currentPage = makePage()

      expect(bubbles.getBubbleHighlightStyle(makeBox({ text: '' }))).toEqual({})

      settingsStore.highlightSavedQuotes = false
      expect(bubbles.getBubbleHighlightStyle(makeBox())).toEqual({})
    })

    it('returns highlight colors when the bubble text matches a saved quote on the page', () => {
      const { bubbles, highlightsStore, readerStore } = setup()
      readerStore.currentPage = makePage()
      highlightsStore.highlights = [makeHighlight()]

      expect(bubbles.getBubbleHighlightStyle(makeBox())).toEqual({
        '--hl-bg': 'rgba(253, 224, 71, 0.25)',
        '--hl-border': 'rgba(253, 224, 71, 0.8)',
      })
    })

    it('ignores highlights saved on other pages', () => {
      const { bubbles, highlightsStore, readerStore } = setup()
      readerStore.currentPage = makePage()
      highlightsStore.highlights = [makeHighlight({ pageNum: 9 })]

      expect(bubbles.getBubbleHighlightStyle(makeBox())).toEqual({})
    })

    it('matches normalized text (punctuation/whitespace/case-insensitive)', () => {
      const { bubbles, highlightsStore, readerStore } = setup()
      readerStore.currentPage = makePage()
      highlightsStore.highlights = [makeHighlight({ text: 'こんにちは！' })]

      expect(bubbles.getBubbleHighlightStyle(makeBox({ text: ' こんにちは ' }))).toEqual({
        '--hl-bg': 'rgba(253, 224, 71, 0.25)',
        '--hl-border': 'rgba(253, 224, 71, 0.8)',
      })
    })
  })
})
