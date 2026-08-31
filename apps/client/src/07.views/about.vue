<script setup lang="ts">
import { useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitHoverRevealBg } from '~/02.kit/atoms/kit-hover-reveal-bg/ui'

const router = useRouter()
</script>

<template>
  <div class="legal-page">
    <KitHoverRevealBg />

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

        <h2>Услуги, цены и доставка</h2>
        <p>
          Мы предоставляем доступ к премиум-функциям платформы в виде цифровой подписки или разовых покупок виртуальных лимитов (токенов).
          Актуальные цены и тарифы указаны на странице <router-link to="/limits">
            лимитов и подписок
          </router-link>.
        </p>
        <p>
          Доступ к платным функциям (доставка цифрового товара) предоставляется автоматически и моментально сразу после успешной оплаты. Никакой физической доставки не требуется.
        </p>

        <h2>Контакты и реквизиты</h2>
        <p>
          <strong>Статус:</strong> Плательщик налога на профессиональный доход (Самозанятый)<br>
          <strong>ФИО:</strong> Корнилов Иван Алексеевич<br>
          <strong>ИНН:</strong> 732814898811<br>
          <strong>Электронная почта:</strong> <a href="mailto:limiteddissolve@gmail.com">limiteddissolve@gmail.com</a><br>
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
  padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px));
  width: 100%;

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
  background-color: var(--bg-secondary-color);
  background-image:
    linear-gradient(color-mix(in srgb, var(--fg-primary-color) 3%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--fg-primary-color) 3%, transparent) 1px, transparent 1px);
  background-size: 32px 32px;
  background-position: center top;
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 32px;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
  color: var(--fg-primary-color);
  line-height: 1.6;

  a {
    color: var(--fg-accent-color);
    text-decoration: none;
    transition:
      color 0.2s,
      opacity 0.2s;

    &:hover {
      opacity: 0.8;
      text-decoration: underline;
    }
  }

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
