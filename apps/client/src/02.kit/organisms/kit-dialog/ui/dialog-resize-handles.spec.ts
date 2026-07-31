import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DialogResizeHandles from './dialog-resize-handles.vue'

describe('dialog-resize-handles.vue', () => {
  it('emits resize event with correct handle and mouse event', async () => {
    const wrapper = mount(DialogResizeHandles)

    const handles = [
      'top',
      'right',
      'bottom',
      'left',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ]

    for (const handle of handles) {
      const el = wrapper.find(`.resize-handle.${handle}`)
      expect(el.exists()).toBe(true)

      const evt = new MouseEvent('mousedown')
      await el.trigger('mousedown', evt)

      const emitted = wrapper.emitted('resize')
      expect(emitted).toBeTruthy()
      const lastEmission = emitted![emitted!.length - 1] as [string, MouseEvent]
      expect(lastEmission[0]).toBe(handle)
      expect(lastEmission[1]).toBeInstanceOf(MouseEvent)
    }
  })
})
