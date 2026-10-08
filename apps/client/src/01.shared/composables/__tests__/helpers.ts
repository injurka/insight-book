import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

export function mountComposable<T>(setup: () => T) {
  let api!: T
  const wrapper = mount(defineComponent({
    setup() {
      api = setup()

      return () => h('div')
    },
  }))

  return { api, wrapper }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}
