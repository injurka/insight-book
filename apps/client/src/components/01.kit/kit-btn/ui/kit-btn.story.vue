<script setup lang="ts">
import KitBtn from './kit-btn.vue'
</script>

<template>
  <Story title="KitBtn" group="kit">
    <Variant title="Variants">
      <div style="display: flex; gap: 12px; padding: 16px; background: var(--bg-primary-color);">
        <KitBtn variant="solid">
          Solid
        </KitBtn>
        <KitBtn variant="tonal">
          Tonal
        </KitBtn>
        <KitBtn variant="outlined">
          Outlined
        </KitBtn>
        <KitBtn variant="text">
          Text
        </KitBtn>
      </div>
    </Variant>

    <Variant title="Colors (Solid)">
      <div style="display: flex; gap: 12px; padding: 16px; background: var(--bg-primary-color);">
        <KitBtn color="primary">
          Primary
        </KitBtn>
        <KitBtn color="secondary">
          Secondary
        </KitBtn>
        <KitBtn color="accent">
          Accent
        </KitBtn>
        <KitBtn color="error">
          Error
        </KitBtn>
        <KitBtn color="success">
          Success
        </KitBtn>
        <KitBtn color="warning">
          Warning
        </KitBtn>
        <KitBtn color="info">
          Info
        </KitBtn>
      </div>
    </Variant>

    <Variant title="With Icons">
      <div style="display: flex; gap: 12px; padding: 16px; background: var(--bg-primary-color);">
        <KitBtn prepend-icon="mdi:home">
          Home
        </KitBtn>
        <KitBtn append-icon="mdi:arrow-right">
          Next
        </KitBtn>
        <KitBtn icon="mdi:robot-outline" />
      </div>
    </Variant>
  </Story>
</template>
