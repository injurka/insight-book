import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { deferred } from './__tests__/helpers'
import { useAppWakeLock } from './use-app-wake-lock'

const mocks = vi.hoisted(() => ({ request: vi.fn(), release: vi.fn() }))
const supported = ref(true)
vi.mock('@vueuse/core', () => ({ useWakeLock: () => ({ isSupported: supported, ...mocks }) }))

beforeEach(() => {
  vi.resetAllMocks()
  supported.value = true
})

describe('useAppWakeLock', () => {
  it('requests for an initially active trigger and releases when it becomes inactive', async () => {
    const source = ref(true)
    const scope = effectScope()
    scope.run(() => useAppWakeLock(() => source.value))
    await flushPromises()
    expect(mocks.request).toHaveBeenCalledWith('screen')
    source.value = false
    await flushPromises()
    expect(mocks.release).toHaveBeenCalledOnce()
    scope.stop()
    await flushPromises()
  })

  it('releases a pending acquisition after disposal', async () => {
    const request = deferred<void>()
    mocks.request.mockReturnValueOnce(request.promise)
    const scope = effectScope()
    scope.run(() => useAppWakeLock(ref(true)))
    await flushPromises()
    scope.stop()
    expect(mocks.release).not.toHaveBeenCalled()
    request.resolve()
    await flushPromises()
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it('ignores unsupported APIs and handles release errors', async () => {
    supported.value = false
    const scope = effectScope()
    scope.run(() => useAppWakeLock(ref(true)))
    await flushPromises()
    expect(mocks.request).not.toHaveBeenCalled()
    supported.value = true
    await flushPromises()
    expect(mocks.request).toHaveBeenCalledOnce()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.release.mockRejectedValueOnce(new Error('denied'))
    scope.stop()
    await flushPromises()
    expect(warning).toHaveBeenCalled()
    warning.mockRestore()
  })
})
