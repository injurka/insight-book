import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { applyAcl } from './acl'

const { trackError } = vi.hoisted(() => ({ trackError: vi.fn() }))
vi.mock('~/01.shared/services/monitoring.service', () => ({ trackError }))
afterEach(() => vi.restoreAllMocks())

describe('applyAcl', () => {
  it('returns parsed, transformed data and defaults', () => {
    expect(applyAcl(z.object({ count: z.coerce.number(), label: z.string().default('default') }), { count: '12' }, 'test')).toEqual({ count: 12, label: 'default' })
    expect(trackError).not.toHaveBeenCalled()
  })

  it('reports a contextual contract error with validation details', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => applyAcl(z.object({ count: z.number() }), { count: 'wrong' }, 'book')).toThrow('[ACL Error] Contract mismatch in book')
    expect(trackError).toHaveBeenCalledWith(expect.any(Error), { context: 'book', details: expect.stringContaining('count') })
  })
})
