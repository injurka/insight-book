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
        <h1>Публичная оферта</h1>
        <p>Условия предоставления услуг</p>
      </div>
    </header>

    <div class="content">
      <div class="card">
        <h2>1. Общие положения</h2>
        <p>
          Данный документ является публичной офертой в соответствии со ст. 437 Гражданского кодекса РФ.
          Настоящая Оферта устанавливает порядок продажи цифровых товаров и оказания услуг на сайте InsightBook.
        </p>

        <h2>2. Предмет оферты</h2>
        <p>
          Исполнитель предоставляет Пользователю доступ к премиум-функциям платформы (цифровым товарам) за плату согласно установленным тарифам.
        </p>

        <h2>3. Порядок оплаты и доставки</h2>
        <p>
          Доступ к услугам предоставляется автоматически сразу после зачисления денежных средств Исполнителю. Услуги считаются оказанными в полном объеме в момент предоставления доступа к цифровому контенту или начисления виртуальных лимитов.
        </p>

        <h2>4. Возврат средств</h2>
        <p>
          В связи с тем, что предметом оферты являются цифровые товары и услуги, предоставление которых происходит моментально, возврат денежных средств после получения доступа не предусмотрен (в соответствии с Законом РФ "О защите прав потребителей").
        </p>

        <h2>5. Реквизиты исполнителя</h2>
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
  height: 100%;
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
    margin-top: 32px;
    margin-bottom: 16px;
    color: var(--fg-primary-color);

    &:first-child {
      margin-top: 0;
    }
  }

  p {
    margin-bottom: 16px;
    color: var(--fg-secondary-color);

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
