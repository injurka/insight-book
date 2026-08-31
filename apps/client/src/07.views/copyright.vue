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

        <h2>Используемые технологии и открытые лицензии</h2>
        <p>
          InsightBook использует программное обеспечение, шрифты и данные с открытым исходным кодом. В соответствии с требованиями их лицензий (MIT, Apache 2.0, SIL OFL, CC BY 4.0), ниже приводится список используемых ключевых технологий и правообладателей:
        </p>
        <ul>
          <li>
            <strong>Vue.js, Vue Router, Pinia, VueUse</strong> —
            распространяются под лицензией <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">MIT License</a> (Copyright © Evan You и участники проекта).
          </li>
          <li>
            <strong>Material Design Icons (MDI)</strong> —
            распространяются под лицензией <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">Apache License 2.0</a> (Copyright © Google LLC / Pictogrammers).
          </li>
          <li>
            <strong>Maple Mono Font</strong> —
            распространяется под лицензией <a href="https://scripts.sil.org/OFL" target="_blank" rel="noopener noreferrer">SIL Open Font License 1.1</a> (Copyright © Subframe7536).
          </li>
          <li>
            <strong>HanziWriter</strong> —
            библиотека распространяется под лицензией <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">MIT License</a> (Copyright © Chanind). Данные порядка написания иероглифов основаны на <strong>MakeMeAHanzi</strong> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>).
          </li>
          <li>
            <strong>DOMPurify</strong> —
            распространяется под лицензиями <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">Apache License 2.0</a> / MPL 2.0 (Copyright © Cure53).
          </li>
          <li>
            <strong>Shiki</strong> —
            подсветка синтаксиса, распространяется под лицензией <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">MIT License</a> (Copyright © Pine Wu, Anthony Fu и участники).
          </li>
          <li>
            <strong>ts-fsrs</strong> —
            реализация алгоритма интервальных повторений FSRS, распространяется под лицензией <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">MIT License</a> (Copyright © OpenSpacedRepetition).
          </li>
          <li>
            <strong>Tauri Framework</strong> —
            распространяется под лицензиями <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">MIT</a> / <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">Apache 2.0</a> (Copyright © Tauri Programme Inc).
          </li>
          <li>
            <strong>Kuromoji & IPADIC</strong> —
            морфологический анализ японского языка, распространяется под лицензией <a href="https://opensource.org/licenses/BSD-3-Clause" target="_blank" rel="noopener noreferrer">BSD License</a>.
          </li>
          <li>
            <strong>OpenTelemetry JS</strong> —
            распространяется под лицензией <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">Apache License 2.0</a> (Copyright © The OpenTelemetry Authors).
          </li>
        </ul>
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
      padding-left: 4px;

      &::marker {
        color: var(--fg-accent-color);
      }
    }
  }
}
</style>
