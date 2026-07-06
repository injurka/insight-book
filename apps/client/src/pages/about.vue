<script setup lang="ts">
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { AppRoutePaths } from '~/shared/constants/routes'

const router = useRouter()
</script>

<template>
  <div class="legal-page">
    <HoverRevealBg />

    <header class="page-header">
      <KitBtn icon="mdi:arrow-left" variant="text" @click="router.push(AppRoutePaths.Home)" />
      <div class="header-title">
        <h1>О сайте</h1>
        <p>Информация о проекте InsightBook</p>
      </div>
    </header>

    <div class="content">
      <div class="card">
        <h2>Что такое InsightBook?</h2>
        <p>
          InsightBook — это платформа для чтения книг и изучения иностранных языков.
          Проект создан для облегчения процесса погружения в языковую среду через чтение литературы.
        </p>

        <h2>Возможности</h2>
        <ul>
          <li><strong>Ридер:</strong> Чтение книг с поддержкой встроенного словаря.</li>
          <li><strong>Словарный запас:</strong> Сохранение незнакомых слов для повторения.</li>
          <li><strong>Анализ текста:</strong> Использование ИИ для понимания контекста и грамматики.</li>
        </ul>

        <h2>Цель</h2>
        <p>
          Предоставить удобные инструменты для тех, кто хочет изучать языки через литературу.
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.legal-page {
  position: relative;
  z-index: 1;
  max-width: 900px;
  margin: 0 auto;
  padding: 32px;
  padding-top: calc(32px + var(--safe-area-top));
  width: 100%;
  height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-y: auto;

  @include media-down(md) {
    padding: 16px;
    padding-top: calc(16px + var(--safe-area-top));
  }
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;

  .header-title {
    h1 {
      margin: 0 0 4px;
      font-size: 1.8rem;
      color: var(--fg-primary-color);
    }
    p {
      margin: 0;
      color: var(--fg-secondary-color);
    }
  }
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 32px;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
  color: var(--fg-primary-color);
  line-height: 1.6;

  h2 {
    font-size: 1.4rem;
    margin-top: 0;
    margin-bottom: 16px;
    color: var(--fg-primary-color);

    &:not(:first-child) {
      margin-top: 32px;
    }
  }

  p {
    margin-bottom: 16px;
    color: var(--fg-secondary-color);

    &:last-child {
      margin-bottom: 0;
    }
  }

  ul {
    padding-left: 20px;
    color: var(--fg-secondary-color);

    li {
      margin-bottom: 12px;

      strong {
        color: var(--fg-primary-color);
      }
    }
  }
}
</style>
