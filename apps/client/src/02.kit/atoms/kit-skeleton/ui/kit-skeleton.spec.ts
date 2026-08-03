import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KitSkeleton from './kit-skeleton.vue'

describe('kitSkeleton', () => {
  it('renders correctly with default props', () => {
    const wrapper = mount(KitSkeleton)

    expect(wrapper.classes()).toContain('kit-skeleton')
    expect(wrapper.classes()).toContain('kit-skeleton--wave')

    const element = wrapper.element as HTMLElement
    expect(element.style.width).toBe('100%')
    expect(element.style.height).toBe('1.2em')
    expect(element.style.borderRadius).toBe('4px')
    expect(element.style.backgroundColor).toBe('var(--bg-secondary-color)')
  })

  it('applies custom string width and height', () => {
    const wrapper = mount(KitSkeleton, {
      props: {
        width: '50%',
        height: '2rem',
      },
    })

    const element = wrapper.element as HTMLElement
    expect(element.style.width).toBe('50%')
    expect(element.style.height).toBe('2rem')
  })

  it('applies custom numeric width and height by appending px', () => {
    const wrapper = mount(KitSkeleton, {
      props: {
        width: 100,
        height: 50,
      },
    })

    const element = wrapper.element as HTMLElement
    expect(element.style.width).toBe('100px')
    expect(element.style.height).toBe('50px')
  })

  it('applies custom border radius and color', () => {
    const wrapper = mount(KitSkeleton, {
      props: {
        borderRadius: '8px',
        color: 'red',
      },
    })

    const element = wrapper.element as HTMLElement
    expect(element.style.borderRadius).toBe('8px')
    expect(element.style.backgroundColor).toBe('red')
  })

  it('does not apply wave class if type is not wave', () => {
    const wrapper = mount(KitSkeleton, {
      props: {
        type: 'none' as unknown as 'pulse' | 'wave',
      },
    })

    expect(wrapper.classes()).not.toContain('kit-skeleton--wave')
  })
})
