import { ESLint } from 'eslint'
import vueSetupOrder from 'eslint-plugin-vue-setup-order'
import { describe, expect, it } from 'vitest'

const projectLint = new ESLint()
const config = await projectLint.calculateConfigForFile('src/app.vue')
const lint = new ESLint({
  overrideConfigFile: true,
  fix: true,
  overrideConfig: {
    files: ['**/*.vue'],
    languageOptions: config.languageOptions,
    plugins: {
      'vue-setup-order': vueSetupOrder,
      'ts': config.plugins.ts,
    },
    rules: {
      'vue-setup-order/order': 'error',
      'ts/no-use-before-define': config.rules['ts/no-use-before-define'],
    },
  },
})

async function fix(script: string) {
  const code = `<script setup lang="ts">\n${script}\n</script>\n`
  const [result] = await lint.lintText(code, { filePath: 'src/order-fixture.vue' })
  expect(result.messages).toEqual([])
  const output = result.output ?? code
  const [secondPass] = await lint.lintText(output, { filePath: 'src/order-fixture.vue' })
  expect(secondPass.messages).toEqual([])
  expect(secondPass.output).toBeUndefined()

  return output
}

describe('vue setup order patch', () => {
  it('keeps refs and computed state before dependent composables and expose', async () => {
    const output = await fix(`import { computed, ref } from 'vue'
import { useFloating } from '@floating-ui/vue'
defineExpose({ open: () => isOpen.value = true })
const { x } = useFloating(reference, floating, { open: isOpen })
const reference = ref(null)
const floating = ref(null)
const internalOpen = ref(false)
const isOpen = computed(() => internalOpen.value)
`)
    expect(output.indexOf('const reference')).toBeLessThan(output.indexOf('const { x }'))
    expect(output.indexOf('const isOpen')).toBeLessThan(output.indexOf('const { x }'))
    expect(output.indexOf('const isOpen')).toBeLessThan(output.indexOf('defineExpose'))
  })

  it('preserves exported types when replacing the sorted script', async () => {
    const output = await fix(`import { ref } from 'vue'
const count = ref(0)
export interface Item { label: string }
interface Props { items: Item[] }
const props = defineProps<Props>()
`)
    expect(output).toContain('export interface Item { label: string }')
    expect(output).toContain('interface Props { items: Item[] }')
    expect(output.indexOf('export interface Item')).toBeLessThan(output.indexOf('const props'))
  })

  it('resolves shadowed identifiers to their own declaration', async () => {
    const output = await fix(`import { computed, ref } from 'vue'
const label = computed(() => { const value = 'local'; return value })
const value = ref('outer')
`)
    expect(output.indexOf('const value = ref')).toBeLessThan(output.indexOf('const label'))
  })

  it('allows hoisted functions to use state declared earlier than their invocation', async () => {
    const output = await fix(`import { ref, watch } from 'vue'
function update() { value.value++ }
const value = ref(0)
watch(value, update)
`)
    expect(output).toContain('function update()')
    expect(output.indexOf('const value')).toBeLessThan(output.indexOf('watch(value'))
  })
})
