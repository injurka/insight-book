import type { Meta, StoryObj } from '@storybook/vue3';
import KitBtn from './kit-btn.vue';

const meta: Meta<typeof KitBtn> = {
  title: 'Kit/KitBtn',
  component: KitBtn,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof KitBtn>;

export const Variants: Story = {
  render: () => ({
    components: { KitBtn },
    template: `
      <div style="display: flex; gap: 12px; padding: 16px; background: var(--bg-primary-color, #fff);">
        <KitBtn variant="solid">Solid</KitBtn>
        <KitBtn variant="tonal">Tonal</KitBtn>
        <KitBtn variant="outlined">Outlined</KitBtn>
        <KitBtn variant="text">Text</KitBtn>
      </div>
    `,
  }),
};

export const ColorsSolid: Story = {
  render: () => ({
    components: { KitBtn },
    template: `
      <div style="display: flex; gap: 12px; padding: 16px; background: var(--bg-primary-color, #fff);">
        <KitBtn color="primary">Primary</KitBtn>
        <KitBtn color="secondary">Secondary</KitBtn>
        <KitBtn color="accent">Accent</KitBtn>
        <KitBtn color="error">Error</KitBtn>
        <KitBtn color="success">Success</KitBtn>
        <KitBtn color="warning">Warning</KitBtn>
        <KitBtn color="info">Info</KitBtn>
      </div>
    `,
  }),
};

export const WithIcons: Story = {
  render: () => ({
    components: { KitBtn },
    template: `
      <div style="display: flex; gap: 12px; padding: 16px; background: var(--bg-primary-color, #fff);">
        <KitBtn prepend-icon="mdi:home">Home</KitBtn>
        <KitBtn append-icon="mdi:arrow-right">Next</KitBtn>
        <KitBtn icon="mdi:robot-outline" />
      </div>
    `,
  }),
};
