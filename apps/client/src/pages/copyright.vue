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
        <h1>Для правообладателей</h1>
        <p>Информация о защите авторских прав (DMCA)</p>
      </div>
    </header>

    <div class="content">
      <div class="card">
        <h2>Отказ от ответственности</h2>
        <p>
          Платформа <strong>InsightBook</strong> является инструментом (ридером) для чтения текстов
          и изучения иностранных языков. Сайт не хранит, не распространяет и не публикует
          материалы, защищенные авторским правом. Все тексты, доступные для чтения, загружаются
          исключительно самими пользователями для личного использования (в соответствии с
          доктриной добросовестного использования).
        </p>

        <h2>Политика в отношении нарушений (DMCA)</h2>
        <p>
          Если вы являетесь правообладателем или его представителем и считаете, что какой-либо контент на сайте
          нарушает ваши авторские права, свяжитесь с нами для урегулирования ситуации.
        </p>

        <h2>Как подать жалобу</h2>
        <p>
          Для подачи уведомления о нарушении авторских прав, пожалуйста, предоставьте следующую информацию:
        </p>
        <ul>
          <li>Физическая или электронная подпись лица, уполномоченного действовать от имени правообладателя;</li>
          <li>Идентификация материала, защищенного авторским правом, или, если жалоба касается нескольких материалов, репрезентативный список таких произведений;</li>
          <li>Идентификация материала, который предположительно нарушает права (включая URL или другие данные, достаточные для нахождения материала);</li>
          <li>Контактная информация заявителя (адрес, телефон, email);</li>
          <li>Заявление о том, что вы добросовестно полагаете, что использование материала не разрешено правообладателем;</li>
          <li>Заявление о точности предоставленной информации и о ваших полномочиях действовать от имени правообладателя под страхом наказания за лжесвидетельство.</li>
        </ul>

        <h2>Связь с нами</h2>
        <p>
          Жалобы и уведомления о нарушении авторских прав следует направлять по электронной почте:<br>
          <strong>limiteddissolve@gmail.com</strong>
        </p>
        <p>
          Мы обязуемся рассмотреть ваше обращение в кратчайшие сроки и принять соответствующие меры
          вплоть до блокировки контента или аккаунтов пользователей, систематически нарушающих правила.
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
      padding-left: 4px;

      &::marker {
        color: var(--fg-accent-color);
      }
    }
  }
}
</style>
