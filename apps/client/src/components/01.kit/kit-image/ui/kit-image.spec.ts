import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KitImage from './kit-image.vue'

describe('kit-image', () => {
  enableAutoUnmount(afterEach)

  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'https://mock-api.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders fallback icon when src is not provided', () => {
    const wrapper = mount(KitImage)
    
    expect(wrapper.find('.fallback').exists()).toBe(true)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('renders loader when src is provided but not loaded yet', () => {
    const wrapper = mount(KitImage, {
      props: {
        src: 'https://example.com/image.jpg',
      },
    })
    
    expect(wrapper.find('.placeholder').exists()).toBe(true)
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('img').classes()).not.toContain('is-loaded')
  })

  it('handles absolute urls correctly', () => {
    const wrapper = mount(KitImage, {
      props: { src: 'https://example.com/image.jpg' },
    })
    
    expect(wrapper.find('img').attributes('src')).toBe('https://example.com/image.jpg')
  })

  it('handles relative urls correctly by appending API URL', () => {
    const wrapper = mount(KitImage, {
      props: { src: '/images/test.jpg' },
    })
    
    expect(wrapper.find('img').attributes('src')).toBe('https://mock-api.com/images/test.jpg')
  })

  it('uses default API URL when VITE_API_URL is not set', () => {
    vi.stubEnv('VITE_API_URL', '')
    const wrapper = mount(KitImage, {
      props: { src: '/images/test.jpg' },
    })
    
    expect(wrapper.find('img').attributes('src')).toBe('https://insight-api.trip-scheduler.ru/images/test.jpg')
  })

  it('handles base64 data urls correctly', () => {
    const wrapper = mount(KitImage, {
      props: { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
    })
    
    expect(wrapper.find('img').attributes('src')).toContain('data:image/png;base64')
  })

  it('handles load event', async () => {
    const wrapper = mount(KitImage, {
      props: { src: '/test.jpg' },
    })
    
    await wrapper.find('img').trigger('load')
    
    expect(wrapper.find('img').classes()).toContain('is-loaded')
    expect(wrapper.find('.placeholder').exists()).toBe(false)
  })

  it('handles error event', async () => {
    const wrapper = mount(KitImage, {
      props: { src: '/test.jpg' },
    })
    
    await wrapper.find('img').trigger('error')
    
    expect(wrapper.find('.fallback').exists()).toBe(true)
    expect(wrapper.find('.placeholder').exists()).toBe(false)
  })

  it('resets state when src changes', async () => {
    const wrapper = mount(KitImage, {
      props: { src: '/first.jpg' },
    })
    
    await wrapper.find('img').trigger('load')
    expect(wrapper.find('img').classes()).toContain('is-loaded')

    await wrapper.setProps({ src: '/second.jpg' })
    
    expect(wrapper.find('img').classes()).not.toContain('is-loaded')
    expect(wrapper.find('.placeholder').exists()).toBe(true)
  })

  it('passes props to img correctly', () => {
    const wrapper = mount(KitImage, {
      props: {
        src: '/test.jpg',
        alt: 'Test Alt',
        lazy: false,
        objectFit: 'contain',
      },
    })
    
    const img = wrapper.find('img')
    expect(img.attributes('alt')).toBe('Test Alt')
    expect(img.attributes('loading')).toBe('eager')
    expect(img.attributes('style')).toContain('object-fit: contain')
  })

  it('renders custom loader and error slots', async () => {
    const wrapper = mount(KitImage, {
      props: { src: '/test.jpg' },
      slots: {
        loader: '<div class="custom-loader">Loading...</div>',
        error: '<div class="custom-error">Error!</div>',
      },
    })
    
    expect(wrapper.find('.custom-loader').exists()).toBe(true)
    
    await wrapper.find('img').trigger('error')
    
    expect(wrapper.find('.custom-error').exists()).toBe(true)
  })
})
