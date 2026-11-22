import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultCatalogPluginRepository } from './catalog-plugin.repository'

const mocks = vi.hoisted(() => ({
  getApproved: vi.fn(),
  getMy: vi.fn(),
  getPending: vi.fn(),
  upload: vi.fn(),
  updateStatus: vi.fn(),
  delete: vi.fn(),
  deleteVersion: vi.fn(),
}))

vi.mock('~/01.shared/services/api.service', () => ({
  api: { catalogPlugins: mocks },
}))

const rawRecord = {
  id: 'grammar-rules',
  name: 'Grammar Rules',
  version: '1.0.0',
  manifestUrl: 'https://cdn.example.test/manifest.json',
  status: 'approved',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-02T00:00:00Z',
}

describe('catalog plugin repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates approved, my, and pending plugin lists with ACL defaults', async () => {
    mocks.getApproved.mockResolvedValue([rawRecord])
    mocks.getMy.mockResolvedValue([{ ...rawRecord, status: 'unexpected-status' }])
    mocks.getPending.mockResolvedValue([{ ...rawRecord, status: 'pending' }])

    const repo = new DefaultCatalogPluginRepository()

    const approved = await repo.getApproved()
    expect(approved[0]).toMatchObject({
      id: 'grammar-rules',
      description: null,
      icon: null,
      author: null,
      sourceUrl: null,
      uploadedBy: null,
      status: 'approved',
    })

    const my = await repo.getMy()
    expect(my[0].status).toBe('pending')

    const pending = await repo.getPending()
    expect(pending[0].status).toBe('pending')
  })

  it('delegates upload, updateStatus, delete, and deleteVersion to api.catalogPlugins', async () => {
    const file = new File(['zip'], 'plugin.zip', { type: 'application/zip' })
    const onProgress = vi.fn()
    mocks.upload.mockResolvedValue(rawRecord)
    mocks.updateStatus.mockResolvedValue({ ...rawRecord, status: 'rejected' })
    mocks.delete.mockResolvedValue({ success: true })
    mocks.deleteVersion.mockResolvedValue({ success: true })

    const repo = new DefaultCatalogPluginRepository()

    await expect(repo.upload(file, 'grammar-rules', onProgress)).resolves.toEqual(rawRecord)
    expect(mocks.upload).toHaveBeenCalledWith(file, 'grammar-rules', onProgress)

    await expect(repo.updateStatus('grammar-rules', '1.0.0', 'rejected')).resolves.toEqual({ ...rawRecord, status: 'rejected' })
    expect(mocks.updateStatus).toHaveBeenCalledWith('grammar-rules', '1.0.0', 'rejected')

    await expect(repo.delete('grammar-rules')).resolves.toEqual({ success: true })
    expect(mocks.delete).toHaveBeenCalledWith('grammar-rules')

    await expect(repo.deleteVersion('grammar-rules', '1.0.0')).resolves.toEqual({ success: true })
    expect(mocks.deleteVersion).toHaveBeenCalledWith('grammar-rules', '1.0.0')
  })
})
