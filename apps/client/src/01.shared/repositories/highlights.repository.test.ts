import type { Highlight } from '~/05.modules/reader'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultHighlightsRepository } from './highlights.repository'

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

const offlineMocks = vi.hoisted(() => ({
  saveHighlights: vi.fn(),
  getHighlights: vi.fn(),
}))

vi.mock('~/01.shared/services/api.service', () => ({
  api: { highlights: apiMocks },
}))

vi.mock('~/01.shared/services/offline.service', () => ({
  offlineService: offlineMocks,
}))

const rawHighlight = {
  id: 1,
  userId: 7,
  bookId: 10,
  text: 'Important passage',
  pageNum: '4',
  createdAt: '2026-11-20T00:00:00Z',
}

const parsedHighlight: Highlight = {
  id: 1,
  userId: 7,
  bookId: 10,
  text: 'Important passage',
  translation: null,
  note: null,
  color: 'yellow',
  chapter: null,
  pageNum: 4,
  createdAt: '2026-11-20T00:00:00Z',
}

describe('highlights repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    offlineMocks.saveHighlights.mockResolvedValue(undefined)
  })

  it('lists highlights for a book, validates via ACL, and persists them offline', async () => {
    apiMocks.list.mockResolvedValue([rawHighlight])
    offlineMocks.saveHighlights.mockRejectedValueOnce(new Error('storage full'))

    const repo = new DefaultHighlightsRepository()
    const items = await repo.list(10)

    expect(apiMocks.list).toHaveBeenCalledWith(10)
    expect(items).toEqual([parsedHighlight])
    expect(offlineMocks.saveHighlights).toHaveBeenCalledWith(10, [parsedHighlight])
  })

  it('does not write offline cache when listing highlights without bookId', async () => {
    apiMocks.list.mockResolvedValue([rawHighlight])

    const repo = new DefaultHighlightsRepository()
    await expect(repo.list()).resolves.toEqual([parsedHighlight])
    expect(offlineMocks.saveHighlights).not.toHaveBeenCalled()
  })

  it('falls back to offline cache on network error when bookId is provided', async () => {
    apiMocks.list.mockRejectedValue(new TypeError('Failed to fetch'))
    offlineMocks.getHighlights.mockResolvedValue([rawHighlight])

    const repo = new DefaultHighlightsRepository()
    await expect(repo.list(10)).resolves.toEqual([parsedHighlight])
    expect(offlineMocks.getHighlights).toHaveBeenCalledWith(10)
  })

  it('rethrows non-offline errors and missing offline cache errors', async () => {
    const authError = Object.assign(new Error('Unauthorized'), { status: 401 })
    apiMocks.list.mockRejectedValueOnce(authError)

    const repo = new DefaultHighlightsRepository()
    await expect(repo.list(10)).rejects.toBe(authError)
    expect(offlineMocks.getHighlights).not.toHaveBeenCalled()

    const networkError = new TypeError('Failed to fetch')
    apiMocks.list.mockRejectedValueOnce(networkError)
    offlineMocks.getHighlights.mockResolvedValueOnce(null)
    await expect(repo.list(10)).rejects.toBe(networkError)

    apiMocks.list.mockRejectedValueOnce(networkError)
    await expect(repo.list()).rejects.toBe(networkError)
  })

  it('delegates create, update, delete and saveLocalHighlights', async () => {
    apiMocks.create.mockResolvedValue(parsedHighlight)
    apiMocks.update.mockResolvedValue({ ...parsedHighlight, note: 'Updated' })
    apiMocks.delete.mockResolvedValue({ success: true })

    const repo = new DefaultHighlightsRepository()

    await expect(repo.create({ bookId: 10, text: 'Important passage', color: 'yellow', pageNum: 4 }))
      .resolves
      .toEqual(parsedHighlight)
    expect(apiMocks.create).toHaveBeenCalledWith({ bookId: 10, text: 'Important passage', color: 'yellow', pageNum: 4 })

    await expect(repo.update(1, { note: 'Updated' })).resolves.toEqual({ ...parsedHighlight, note: 'Updated' })
    expect(apiMocks.update).toHaveBeenCalledWith(1, { note: 'Updated' })

    await expect(repo.delete(1)).resolves.toEqual({ success: true })
    expect(apiMocks.delete).toHaveBeenCalledWith(1)

    await repo.saveLocalHighlights(10, [parsedHighlight])
    expect(offlineMocks.saveHighlights).toHaveBeenCalledWith(10, [parsedHighlight])
  })
})
