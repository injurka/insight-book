<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitDialog } from '~/02.kit'

interface MenuItem {
  id: string
  label: string
  icon: string
}

interface Props {
  items: MenuItem[]
  currentView: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const { t } = useI18n()
const isMobileMenuOpen = defineModel<boolean>('isMobileMenuOpen', { required: true })

function onMenuClick(id: string) {
  isMobileMenuOpen.value = false
  setTimeout(() => {
    emit('select', id)
  }, 100)
}
</script>

<template>
  <!-- Desktop Sidebar -->
  <aside v-if="items.length > 1" class="library-sidebar desktop-only">
    <ul class="nav-menu">
      <li
        v-for="item in items"
        :key="item.id"
        class="nav-item"
        :class="{ active: currentView === item.id }"
        @click="onMenuClick(item.id)"
      >
        <Icon :icon="item.icon" /> {{ item.label }}
      </li>
    </ul>
  </aside>

  <!-- Mobile Menu -->
  <KitDialog
    v-model:visible="isMobileMenuOpen"
    :title="t('library.menuTitle')"
    :max-width="400"
    :floating="false"
  >
    <ul class="nav-menu mobile-menu">
      <li
        v-for="item in items"
        :key="item.id"
        class="nav-item"
        :class="{ active: currentView === item.id }"
        @click="onMenuClick(item.id)"
      >
        <Icon :icon="item.icon" /> {{ item.label }}
      </li>
    </ul>
  </KitDialog>
</template>

<style lang="scss" scoped>
.library-sidebar {
  width: 220px;
  position: sticky;
  top: 204px;
  border-radius: 12px;
  flex-shrink: 0;

  &.desktop-only {
    @include media-down(md) {
      display: none;
    }
  }
}

.nav-menu {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.mobile-menu {
    padding: 8px 0;
  }
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--fg-secondary-color);
  transition: all 0.2s;
  font-size: 0.95rem;
  font-weight: 500;

  svg {
    font-size: 1.3rem;
  }

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.active {
    background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.15);
    color: var(--fg-accent-color);
  }
}
</style>
