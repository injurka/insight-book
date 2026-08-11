import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, markRaw } from 'vue'
import { KitViewSwitcher } from '~/02.kit/molecules/kit-view-switcher/ui'
import KitTabs from './kit-tabs.vue'

const DummyComponent1 = defineComponent({
  name: 'DummyComponent1',
  render: () => h('div', { class: 'dummy-1' }, 'Component 1 Content'),
})

const DummyComponent2 = defineComponent({
  name: 'DummyComponent2',
  props: ['text'],
  render: (props: { text?: string }) => h('div', { class: 'dummy-2' }, `Component 2: ${props.text}`),
})

describe('kit-tabs', () => {
  const defaultItems = [
    { id: 'tab1', name: 'Tab 1' },
    { id: 'tab2', name: 'Tab 2' },
    { id: 'tab3', name: 'Tab 3' },
  ]

  it('renders correctly with required props', () => {
    const wrapper = mount(KitTabs, {
      props: {
        modelValue: 'tab1',
        items: defaultItems,
      },
      global: {
        components: { KitViewSwitcher },
      },
    })

    expect(wrapper.exists()).toBe(true)
    const switcher = wrapper.findComponent(KitViewSwitcher)
    expect(switcher.exists()).toBe(true)
    expect(switcher.props('items')).toEqual(defaultItems)
    expect(switcher.props('modelValue')).toBe('tab1')
  })

  it('adds "single" class when there is only one item', () => {
    const wrapper = mount(KitTabs, {
      props: {
        modelValue: 'tab1',
        items: [{ id: 'tab1', name: 'Tab 1' }],
      },
      global: {
        components: { KitViewSwitcher },
      },
    })

    expect(wrapper.classes()).toContain('single')
  })

  it('renders slot content based on modelValue when cache is false', () => {
    const wrapper = mount(KitTabs, {
      props: {
        modelValue: 'tab2',
        items: defaultItems,
        cache: false,
      },
      slots: {
        tab1: '<div class="slot-1">Slot 1</div>',
        tab2: '<div class="slot-2">Slot 2</div>',
      },
      global: {
        components: { KitViewSwitcher },
      },
    })

    expect(wrapper.find('.slot-2').exists()).toBe(true)
    expect(wrapper.find('.slot-1').exists()).toBe(false)
  })

  it('updates slot content when modelValue changes', async () => {
    const wrapper = mount(KitTabs, {
      props: {
        modelValue: 'tab1',
        items: defaultItems,
        cache: false,
      },
      slots: {
        tab1: '<div class="slot-1">Slot 1</div>',
        tab2: '<div class="slot-2">Slot 2</div>',
      },
      global: {
        components: { KitViewSwitcher },
      },
    })

    expect(wrapper.find('.slot-1').exists()).toBe(true)

    await wrapper.setProps({ modelValue: 'tab2' })

    expect(wrapper.find('.slot-1').exists()).toBe(false)
    expect(wrapper.find('.slot-2').exists()).toBe(true)
  })

  it('renders components with props when cache is true', () => {
    const componentItems = [
      { id: 'tab1', name: 'Tab 1', component: markRaw(DummyComponent1) },
      { id: 'tab2', name: 'Tab 2', component: markRaw(DummyComponent2), props: { text: 'Hello' } },
    ]

    const wrapper = mount(KitTabs, {
      props: {
        modelValue: 'tab2',
        items: componentItems,
        cache: true,
      },
      global: {
        components: { KitViewSwitcher },
      },
    })

    const dummy2 = wrapper.findComponent(DummyComponent2)
    expect(dummy2.exists()).toBe(true)
    expect(dummy2.text()).toContain('Component 2: Hello')
  })

  it('updates transition name based on tab index change', async () => {
    const wrapper = mount(KitTabs, {
      props: {
        modelValue: 'tab1',
        items: defaultItems,
      },
      slots: {
        tab1: '<div>1</div>',
        tab2: '<div>2</div>',
        tab3: '<div>3</div>',
      },
      global: {
        components: { KitViewSwitcher },
        stubs: {
          Transition: false,
        },
      },
    })

    await wrapper.setProps({ modelValue: 'tab3' })
    expect((wrapper.vm).transitionName).toBe('slide-left')

    await wrapper.setProps({ modelValue: 'tab2' })
    expect((wrapper.vm).transitionName).toBe('slide-right')
  })

  it('updates model when KitViewSwitcher emits update:modelValue', async () => {
    const wrapper = mount(KitTabs, {
      props: {
        modelValue: 'tab1',
        items: defaultItems,
      },
      global: {
        components: { KitViewSwitcher },
      },
    })

    const switcher = wrapper.findComponent(KitViewSwitcher)
    await switcher.vm.$emit('update:modelValue', 'tab2')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['tab2'])
  })
})
