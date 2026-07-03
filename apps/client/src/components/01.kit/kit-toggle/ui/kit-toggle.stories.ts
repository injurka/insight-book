import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import KitToggle from './kit-toggle.vue'

const meta: Meta<typeof KitToggle> = {
  title: 'Kit/KitToggle',
  component: KitToggle,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof KitToggle>

const defaultOptions = [
  { value: 'list', label: 'List', icon: 'mdi:format-list-bulleted', tooltip: 'Show list view' },
  { value: 'grid', label: 'Grid', icon: 'mdi:view-grid', tooltip: 'Show grid view' },
  { value: 'gallery', label: 'Gallery', icon: 'mdi:image-multiple', tooltip: 'Show gallery view' },
]

export const Interactive: Story = {
  render: args => ({
    components: { KitToggle },
    setup() {
      const val = ref('list')
      return { args, val }
    },
    template: `
      <div style="padding: 16px; background: var(--bg-primary-color, #fff);">
        <div style="margin-bottom: 8px; font-size: 0.9rem; color: var(--fg-secondary-color);">Active value: {{ val }}</div>
        <KitToggle v-model="val" :options="args.options" :size="args.size" />
      </div>
    `,
  }),
  args: {
    options: defaultOptions,
    size: 'sm',
  },
}

export const Sizes: Story = {
  render: () => ({
    components: { KitToggle },
    setup() {
      const valXs = ref('list')
      const valSm = ref('list')
      const valMd = ref('list')
      const valLg = ref('list')
      return {
        options: defaultOptions,
        valXs,
        valSm,
        valMd,
        valLg,
      }
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px; background: var(--bg-primary-color, #fff);">
        <div>
          <div style="margin-bottom: 4px; font-size: 0.8rem; color: var(--fg-secondary-color);">Size: xs</div>
          <KitToggle v-model="valXs" :options="options" size="xs" />
        </div>
        <div>
          <div style="margin-bottom: 4px; font-size: 0.8rem; color: var(--fg-secondary-color);">Size: sm</div>
          <KitToggle v-model="valSm" :options="options" size="sm" />
        </div>
        <div>
          <div style="margin-bottom: 4px; font-size: 0.8rem; color: var(--fg-secondary-color);">Size: md</div>
          <KitToggle v-model="valMd" :options="options" size="md" />
        </div>
        <div>
          <div style="margin-bottom: 4px; font-size: 0.8rem; color: var(--fg-secondary-color);">Size: lg</div>
          <KitToggle v-model="valLg" :options="options" size="lg" />
        </div>
      </div>
    `,
  }),
}

export const IconsOnly: Story = {
  render: () => ({
    components: { KitToggle },
    setup() {
      const val = ref('list')
      const options = [
        { value: 'list', icon: 'mdi:format-list-bulleted', tooltip: 'List view' },
        { value: 'grid', icon: 'mdi:view-grid', tooltip: 'Grid view' },
        { value: 'gallery', icon: 'mdi:image-multiple', tooltip: 'Gallery view' },
      ]
      return { val, options }
    },
    template: `
      <div style="padding: 16px; background: var(--bg-primary-color, #fff);">
        <KitToggle v-model="val" :options="options" />
      </div>
    `,
  }),
}

export const LabelsOnly: Story = {
  render: () => ({
    components: { KitToggle },
    setup() {
      const val = ref('daily')
      const options = [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]
      return { val, options }
    },
    template: `
      <div style="padding: 16px; background: var(--bg-primary-color, #fff);">
        <KitToggle v-model="val" :options="options" />
      </div>
    `,
  }),
}
