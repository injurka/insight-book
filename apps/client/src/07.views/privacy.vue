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
        <h1>Политика конфиденциальности</h1>
        <p>Какую информацию мы собираем и используем</p>
      </div>
    </header>

    <div class="content">
      <div class="card">
        <h2>1. Общие положения</h2>
        <p>
          Настоящая Политика обработки персональных данных (далее — «Политика») составлена в соответствии с
          требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» и определяет порядок
          сбора, хранения, обработки и защиты персональной информации пользователей сервиса <strong>InsightBook</strong>
          (далее — «Сервис»).
        </p>
        <p>
          Оператором персональных данных является Администрация Сервиса (далее — «Оператор»).
          Использование Сервиса, включая регистрацию и авторизацию, означает безоговорочное согласие
          пользователя с настоящей Политикой и указанными в ней условиями обработки данных.
        </p>

        <h2>2. Состав и цели обработки данных</h2>
        <p>Оператор обрабатывает персональные данные исключительно в целях предоставления и улучшения функционала Сервиса:</p>
        <ul>
          <li>
            <strong>Идентификация и доступ к аккаунту:</strong> адрес электронной почты (email), имя/псевдоним, а также технический идентификатор при авторизации через сторонние сервисы (включая Яндекс ID).
          </li>
          <li>
            <strong>Синхронизация пользовательских данных:</strong> загруженные книги, прогресс чтения, закладки, сохраненный словарный запас и личные настройки хранятся для обеспечения непрерывной синхронизации между вашими устройствами.
          </li>
          <li>
            <strong>Технические и аналитические данные:</strong> файлы cookie, технические заголовки, сведения о версии приложения и анонимизированные данные производительности (через систему мониторинга OpenTelemetry) для обеспечения стабильности и защиты от сбоев.
          </li>
        </ul>

        <h2>3. Использование сторонних сервисов и нейросетей (ИИ)</h2>
        <p>
          В Сервисе предусмотрены функции интеллектуального анализа текста, перевода и генерации контекстных подсказок с использованием искусственного интеллекта.
        </p>
        <ul>
          <li>
            Для работы ИИ-функций сторонним провайдерам (например, OpenAI, Anthropic и др.) направляются <strong>исключительно обезличенные фрагменты текста книг или слова</strong>, выделенные пользователем.
          </li>
          <li>
            Персональные данные пользователей (email, имя, профили) провайдерам искусственного интеллекта <strong>не передаются</strong>.
          </li>
        </ul>

        <h2>4. Хранение, локализация и безопасность</h2>
        <p>
          Оператор обеспечивает безопасность персональных данных в соответствии со статьей 19 Федерального закона № 152-ФЗ:
        </p>
        <ul>
          <li>Базы данных, содержащие персональные данные граждан РФ, размещены на серверных мощностях на территории Российской Федерации.</li>
          <li>Для передачи информации по сети применяется протокол шифрования HTTPS/TLS.</li>
          <li>Пароли и конфиденциальные токены доступа хранятся в защищенном (хэшированном) виде.</li>
          <li>Оператор ни при каких обстоятельствах не продает и не передает персональные данные третьим лицам в маркетинговых или рекламных целях.</li>
        </ul>

        <h2>5. Права пользователя и удаление данных</h2>
        <p>
          Пользователь имеет право:
        </p>
        <ul>
          <li>В любой момент получить информацию об объеме и составе обрабатываемых персональных данных.</li>
          <li>Отредактировать или удалить свой контент (книги, словарные карточки, заметки).</li>
          <li><strong>Полностью удалить свой аккаунт</strong> через интерфейс настроек приложения, что влечет безвозвратное уничтожение всех связанных данных на серверах.</li>
          <li>Отозвать согласие на обработку персональных данных, направив запрос Оператору.</li>
        </ul>

        <h2>6. Контакты и обратная связь</h2>
        <p>
          По всем вопросам, связанным с обработкой персональных данных, отзывом согласия или технической поддержкой, вы можете обращаться по адресу электронной почты:
          <a href="mailto:support@insight-book.ru">support@insight-book.ru</a>.
        </p>

        <h2>7. Изменения в Политике</h2>
        <p>
          Оператор имеет право вносить изменения в настоящую Политику. Новая редакция вступает в силу с момента ее публикации на сайте Сервиса по адресу <code>/privacy</code>.
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
    margin-bottom: 16px;

    li {
      margin-bottom: 12px;

      strong {
        color: var(--fg-primary-color);
      }
    }
  }
}
</style>
