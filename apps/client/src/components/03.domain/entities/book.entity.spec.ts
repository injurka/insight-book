import type { Book } from '../../../shared/types/models'
import { describe, expect, it } from 'vitest'
import { BookEntity } from './book.entity'

function createBook(overrides: Partial<Book> = {}): BookEntity {
  return new BookEntity({
    id: 1,
    title: 'Test Book',
    author: null,
    coverUrl: null,
    filePath: '/books/test.epub',
    language: 'en',
    totalPages: 200,
    currentPage: 100,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  })
}

describe('bookEntity', () => {
  describe('getProgressPercent', () => {
    it('calculates progress for a normal case', () => {
      const book = createBook({ currentPage: 50, totalPages: 200 })

      expect(book.getProgressPercent()).toBe(25)
    })

    it('returns 0 when currentPage is null', () => {
      const book = createBook({ currentPage: null })

      expect(book.getProgressPercent()).toBe(0)
    })

    it('returns 0 when totalPages is 0 (division by zero)', () => {
      const book = createBook({ currentPage: 10, totalPages: 0 })

      expect(book.getProgressPercent()).toBe(0)
    })

    it('clamps progress to 100 when currentPage exceeds totalPages', () => {
      const book = createBook({ currentPage: 250, totalPages: 200 })

      expect(book.getProgressPercent()).toBe(100)
    })

    it('clamps progress to 0 when currentPage is negative', () => {
      const book = createBook({ currentPage: -5, totalPages: 200 })

      expect(book.getProgressPercent()).toBe(0)
    })

    it('rounds progress to the nearest integer', () => {
      const book = createBook({ currentPage: 1, totalPages: 3 })

      expect(book.getProgressPercent()).toBe(33)
    })

    it('rounds progress up at .5 and above', () => {
      const book = createBook({ currentPage: 1, totalPages: 8 })

      expect(book.getProgressPercent()).toBe(13)
    })
  })

  describe('isCompleted', () => {
    it('returns true when progress is 100', () => {
      const book = createBook({ currentPage: 200, totalPages: 200 })

      expect(book.isCompleted()).toBe(true)
    })

    it('returns false when progress is 99', () => {
      const book = createBook({ currentPage: 99, totalPages: 100 })

      expect(book.isCompleted()).toBe(false)
    })
  })

  describe('hasPrevPage', () => {
    it('returns false on the first page', () => {
      const book = createBook({ currentPage: 1 })

      expect(book.hasPrevPage()).toBe(false)
    })

    it('returns true after the first page', () => {
      const book = createBook({ currentPage: 2 })

      expect(book.hasPrevPage()).toBe(true)
    })

    it('returns false when currentPage is null', () => {
      const book = createBook({ currentPage: null })

      expect(book.hasPrevPage()).toBe(false)
    })
  })

  describe('hasNextPage', () => {
    it('returns false on the last page', () => {
      const book = createBook({ currentPage: 200, totalPages: 200 })

      expect(book.hasNextPage()).toBe(false)
    })

    it('returns true before the last page', () => {
      const book = createBook({ currentPage: 199, totalPages: 200 })

      expect(book.hasNextPage()).toBe(true)
    })

    it('returns false when currentPage is null and totalPages is 1', () => {
      const book = createBook({ currentPage: null, totalPages: 1 })

      expect(book.hasNextPage()).toBe(false)
    })

    it('returns true when currentPage is null and totalPages is greater than 1', () => {
      const book = createBook({ currentPage: null, totalPages: 200 })

      expect(book.hasNextPage()).toBe(true)
    })
  })
})
