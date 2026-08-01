<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  activeWidget: any
}

defineProps<Props>()
</script>

<template>
  <div class="stage-wrapper">
    <!-- ── dictionary:training-modes ── -->
    <template v-if="activeWidget.position === 'dictionary:training-modes'">
      <div class="ctx-label">
        <Icon icon="mdi:book-open-page-variant-outline" />
        Контекст: Настройка тренировки → Выбор режимов
      </div>
      <div class="dialog-backdrop-mock">
        <div class="dialog-card-mock">
          <div class="dialog-header-mock">
            <h2 class="dialog-title-mock">
              Настройка SRS тренировки
            </h2>
          </div>
          <div class="setup-state mock-training-setup">
            <p class="setup-desc">
              Настройте параметры перед началом тренировки
            </p>

            <div class="settings-group filters-group">
              <div class="form-row">
                <div class="form-col">
                  <label>Колода</label>
                  <div class="mock-select">
                    Все колоды
                  </div>
                </div>
                <div class="form-col">
                  <label>Сложность</label>
                  <div class="mock-select">
                    Все уровни
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-group">
              <label class="group-label">Режимы тренировки</label>
              <div class="modes-grid">
                <div class="mode-card">
                  <Icon icon="mdi:card-text-outline" class="mode-icon" />
                  <span class="mode-title">Чтение</span>
                  <span class="mode-desc">Классические карточки</span>
                </div>
                <div class="mode-card">
                  <Icon icon="mdi:keyboard-outline" class="mode-icon" />
                  <span class="mode-title">Печать</span>
                  <span class="mode-desc">Напишите по памяти</span>
                </div>
                <div class="mode-card">
                  <Icon icon="mdi:format-list-checks" class="mode-icon" />
                  <span class="mode-title">Тест</span>
                  <span class="mode-desc">Несколько вариантов</span>
                </div>
                <div class="mode-card">
                  <Icon icon="mdi:headphones" class="mode-icon" />
                  <span class="mode-title">Слух</span>
                  <span class="mode-desc">AI синтез речи</span>
                </div>
                <!-- Dynamic plugin training mode widgets slot -->
                <slot />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── reader:header-actions ── -->
    <template v-else-if="activeWidget.position === 'reader:header-actions'">
      <div class="ctx-label">
        <Icon icon="mdi:view-split-vertical" />
        Контекст: Шапка читалки (floating header)
      </div>
      <div class="mock-reader-scene">
        <div class="mock-reader-text">
          <p>君不見黃河之水天上來，奔流到海不復回。</p>
          <p>君不見高堂明鏡悲白髮，朝如青絲暮成雪。</p>
          <p>人生得意須盡歡，莫使金樽空對月。</p>
        </div>
        <header class="reader-header">
          <button class="mock-header-btn">
            <Icon icon="mdi:arrow-left" />
          </button>
          <span class="book-title">将进酒 · 李白</span>
          <div class="spacer" />
          <button class="mock-header-btn">
            <Icon icon="mdi:view-split-vertical" />
          </button>
          <button class="mock-header-btn">
            <Icon icon="mdi:format-list-bulleted" />
          </button>
          <!-- Plugin widget slot -->
          <slot />
          <button class="mock-header-btn">
            <Icon icon="mdi:cog-outline" />
          </button>
        </header>
      </div>
    </template>

    <!-- ── settings:custom-tab ── -->
    <template v-else-if="activeWidget.position === 'settings:custom-tab'">
      <div class="ctx-label">
        <Icon icon="mdi:cog-outline" />
        Контекст: Страница настроек → Вкладки
      </div>
      <div class="settings-page mock-settings-layout">
        <div class="content-wrapper">
          <div class="kit-tabs-mock">
            <div class="tabs-nav-sidebar">
              <div class="tab-nav-item">
                <Icon icon="mdi:palette-outline" />
                <span>Интерфейс</span>
              </div>
              <div class="tab-nav-item">
                <Icon icon="mdi:robot-outline" />
                <span>ИИ</span>
              </div>
              <div class="tab-nav-item">
                <Icon icon="mdi:puzzle-outline" />
                <span>Плагины</span>
              </div>
              <div class="tab-nav-item">
                <Icon icon="mdi:cog-outline" />
                <span>Система</span>
              </div>
              <!-- Custom tab trigger from plugin slot -->
              <div class="plugin-tab-slot">
                <slot />
              </div>
            </div>
            <div class="tab-pane-content">
              <div class="mock-settings-panel">
                <h3>Настройки интерфейса</h3>
                <div class="mock-settings-row">
                  <label>Язык интерфейса</label>
                  <div class="mock-select">
                    Русский
                  </div>
                </div>
                <div class="mock-settings-row">
                  <label>Язык изучения</label>
                  <div class="mock-select">
                    中文
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Unknown / custom position ── -->
    <template v-else>
      <div class="ctx-label ctx-label--unknown">
        <Icon icon="mdi:help-circle-outline" />
        Кастомная позиция: <code>{{ activeWidget.position }}</code>
      </div>
      <div class="widget-container">
        <slot />
      </div>
    </template>
  </div>
</template>

<style scoped>
.stage-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;

  --bg-primary-color: var(--bg-surface);
  --bg-secondary-color: var(--bg-base);
  --bg-hover-color: var(--bg-card);
  --border-primary-color: var(--border-subtle);
  --border-secondary-color: var(--border);
  --fg-primary-color: var(--text-primary);
  --fg-secondary-color: var(--text-secondary);
  --fg-muted-color: var(--text-muted);
  --fg-accent-color: var(--accent);
}

.ctx-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.7px;
  padding: 8px 16px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.ctx-label--unknown {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.06);
  border-bottom-color: rgba(245, 158, 11, 0.2);
}

.mock-select {
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--fg-primary-color);
  cursor: pointer;
  user-select: none;
  min-width: 120px;
  transition: all 0.2s ease;
}

.dialog-backdrop-mock {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 8px;
  flex: 1;
  overflow-y: auto;
}

.dialog-card-mock {
  width: 100%;
  max-width: 650px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modal-zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-header-mock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-primary-color);
  background: var(--bg-secondary-color);
}

.dialog-title-mock {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--fg-primary-color);
}

@keyframes modal-zoom {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.setup-state {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
}

.setup-desc {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.95rem;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-secondary-color);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
}

.filters-group .form-row {
  display: flex;
  gap: 12px;
}

.filters-group .form-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filters-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.group-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin-bottom: 4px;
}

.modes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.mode-card:hover {
  border-color: var(--border-secondary-color);
  background: var(--bg-hover-color);
}

.mode-icon {
  font-size: 2rem;
  color: var(--fg-secondary-color);
}

.mode-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--fg-primary-color);
}

.mode-desc {
  font-size: 0.75rem;
  color: var(--fg-muted-color);
  line-height: 1.3;
}

.mock-reader-scene {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--bg-secondary-color);
  min-height: 360px;
  display: flex;
  flex-direction: column;
}

.mock-reader-text {
  flex: 1;
  padding: 90px 40px 40px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-size: 1.3rem;
  line-height: 2.4;
  color: var(--fg-primary-color);
  opacity: 0.35;
  text-align: center;
  pointer-events: none;
}

.mock-reader-text p {
  margin: 0;
}

.reader-header {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 680px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 20px;
  background: rgba(33, 38, 45, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.book-title {
  font-weight: 500;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--fg-secondary-color);
  flex-shrink: 1;
  min-width: 0;
  margin-left: 8px;
}

.spacer {
  flex-grow: 1;
}

.mock-header-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.mock-header-btn:hover {
  background: var(--bg-hover-color);
  color: var(--fg-primary-color);
}

.settings-page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.kit-tabs-mock {
  display: flex;
  gap: 24px;
  flex: 1;
}

.tabs-nav-sidebar {
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-secondary-color);
  padding-right: 16px;
}

.tab-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.tab-nav-item:hover {
  background: var(--bg-hover-color);
  color: var(--fg-primary-color);
}

.tab-nav-item.active {
  background: var(--bg-hover-color);
  color: var(--fg-accent-color);
}

.plugin-tab-slot {
  margin-top: 8px;
  border-top: 1px solid var(--border-primary-color);
  padding-top: 8px;
}

.tab-pane-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mock-settings-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mock-settings-panel h3 {
  margin: 0 0 8px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.mock-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-primary-color);
}

.mock-settings-row label {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
}

.widget-container {
  background: var(--bg-elevated);
  padding: 20px;
  border-radius: 8px;
  border: 1px dashed var(--border);
}
</style>
