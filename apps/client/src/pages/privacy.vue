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
        <h1>Политика конфиденциальности</h1>
        <p>Какую информацию мы собираем и используем</p>
      </div>
    </header>

    <div class="content">
      <div class="card">
        <h2>Общие положения</h2>
        <p>
          Настоящая политика описывает, какие данные собирает <strong>InsightBook</strong>,
          как они используются и как обеспечивается их безопасность.
        </p>

        <h2>Сбор и использование информации</h2>
        <p>Для предоставления качественного сервиса мы можем собирать следующую информацию:</p>
        <ul>
          <li><strong>Данные аккаунта:</strong> При регистрации (в том числе через социальные сети и сторонние сервисы, такие как Яндекс ID) мы получаем ваш email-адрес и базовую информацию профиля для идентификации пользователя.</li>
          <li><strong>Пользовательский контент:</strong> Загруженные вами книги, прогресс чтения, сохраненные слова в словаре и личные настройки хранятся на наших серверах исключительно для обеспечения синхронизации между вашими устройствами.</li>
          <li><strong>Технические данные:</strong> Мы можем собирать анонимизированную статистику об использовании приложения (через Umami Analytics) для улучшения стабильности и интерфейса. Эти данные не привязаны к вашей личности.</li>
        </ul>

        <h2>Использование нейросетей (ИИ)</h2>
        <p>
          В приложении реализованы функции анализа текста и перевода с использованием искусственного интеллекта.
          Обратите внимание:
        </p>
        <ul>
          <li>Отрывки текста, которые вы выделяете для перевода или анализа, могут передаваться через API сторонним провайдерам ИИ (например, OpenAI, Anthropic и др.).</li>
          <li>Эти данные передаются анонимно и не используются для обучения моделей без вашего явного согласия.</li>
        </ul>

        <h2>Хранение и защита данных</h2>
        <p>
          Мы применяем современные стандарты шифрования для защиты ваших данных. Ваши пароли (если применимо) не хранятся
          в открытом виде, а доступ к серверной инфраструктуре строго ограничен.
          Мы <strong>не продаем</strong> и не передаем ваши персональные данные третьим лицам в рекламных целях.
        </p>

        <h2>Удаление данных</h2>
        <p>
          Вы являетесь полноправным владельцем своих данных. Вы в любой момент можете удалить загруженные книги,
          словарный запас или полностью удалить свой аккаунт через настройки приложения. При удалении аккаунта все
          связанные с ним данные стираются с наших серверов без возможности восстановления.
        </p>

        <h2>Изменения в политике</h2>
        <p>
          Мы оставляем за собой право вносить изменения в данную политику. Существенные обновления будут
          сопровождаться уведомлением внутри приложения или по электронной почте.
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
