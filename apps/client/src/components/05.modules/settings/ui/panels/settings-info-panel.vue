<script setup lang="ts">
import { useRouter } from 'vue-router'
import { AppRoutePaths } from '~/shared/constants/routes'

const router = useRouter()
</script>

<template>
  <div class="settings-panel">
    <div class="panel-section">
      <h2 class="section-title">
        Правовая информация
      </h2>

      <div class="link-list">
        <button class="info-link-btn" @click="router.push(AppRoutePaths.About)">
          <div class="btn-content">
            <span class="icon mdi mdi-information-outline" />
            <span class="text">О сайте</span>
          </div>
          <span class="chevron mdi mdi-chevron-right" />
        </button>

        <button class="info-link-btn" @click="router.push(AppRoutePaths.Privacy)">
          <div class="btn-content">
            <span class="icon mdi mdi-shield-account-outline" />
            <span class="text">Политика конфиденциальности</span>
          </div>
          <span class="chevron mdi mdi-chevron-right" />
        </button>

        <button class="info-link-btn" @click="router.push(AppRoutePaths.Copyright)">
          <div class="btn-content">
            <span class="icon mdi mdi-copyright" />
            <span class="text">Для правообладателей</span>
          </div>
          <span class="chevron mdi mdi-chevron-right" />
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 1.2rem;
  margin: 0;
  color: var(--fg-primary-color);
  font-weight: 600;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-link-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  text-align: left;
  outline: none;

  &:hover {
    border-color: var(--border-accent-color);
    background: var(--bg-tertiary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
  }

  &:active {
    transform: translateY(0);
  }

  .btn-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .icon {
    font-size: 1.4rem;
    color: var(--fg-accent-color);
  }

  .text {
    font-size: 1rem;
    color: var(--fg-primary-color);
    font-weight: 500;
  }

  .chevron {
    font-size: 1.4rem;
    color: var(--fg-secondary-color);
    transition: transform 0.2s ease;
  }

  &:hover .chevron {
    transform: translateX(4px);
    color: var(--fg-primary-color);
  }
}
</style>
