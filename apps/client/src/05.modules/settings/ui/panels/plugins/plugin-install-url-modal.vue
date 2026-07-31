<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { KitBtn, KitDialog, KitInput } from '~/02.kit'
import { usePluginsStore } from '../../../store/plugins.store'

const visible = defineModel<boolean>('visible', { required: true })

const { t } = useI18n()
const toast = useToast()
const pluginsStore = usePluginsStore()

const inputManifestUrl = ref('')

watch(visible, (isOpen) => {
  if (isOpen)
    inputManifestUrl.value = ''
})

async function confirmInstall() {
  const url = inputManifestUrl.value.trim()
  if (!url) {
    toast.error(t('settings.plugins.emptyUrl', 'Укажите URL манифеста плагина'))
    return
  }

  const success = await pluginsStore.installPluginByUrl(url)
  if (success) {
    visible.value = false
    inputManifestUrl.value = ''
  }
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('settings.installPluginModalTitle', 'Установка динамического плагина')"
    :max-width="540"
  >
    <div class="install-dialog-content">
      <div class="warning-banner">
        <Icon icon="mdi:alert-decagram-outline" class="warning-icon" />
        <div>
          <strong>{{ t('settings.securityWarningTitle', 'Предупреждение по безопасности') }}</strong>
          <p>
            {{ t('settings.securityWarningText', 'Плагины сторонних разработчиков выполняют JavaScript-код в контексте вашей сессии. Устанавливайте плагины только из проверенных и надежных источников.') }}
          </p>
        </div>
      </div>

      <div class="field-group">
        <label>{{ t('settings.manifestUrlLabel', 'URL манифеста плагина (JSON):') }}</label>
        <KitInput
          v-model="inputManifestUrl"
          placeholder="https://example.com/my-plugin/manifest.json"
        />
      </div>

      <div class="dialog-actions">
        <KitBtn variant="tonal" size="sm" @click="visible = false">
          {{ t('common.cancel', 'Отмена') }}
        </KitBtn>
        <KitBtn
          color="primary"
          size="sm"
          :loading="pluginsStore.isInstallingPlugin"
          @click="confirmInstall"
        >
          {{ t('settings.installConfirm', 'Подтвердить и установить') }}
        </KitBtn>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.install-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.warning-banner {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  background: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.1);
  border: 1px solid var(--border-error-color);
  border-radius: 10px;
  color: var(--fg-primary-color);
  font-size: 0.85rem;
  line-height: 1.4;

  .warning-icon {
    font-size: 1.8rem;
    color: var(--fg-error-color);
    flex-shrink: 0;
  }

  strong {
    display: block;
    margin-bottom: 4px;
    color: var(--fg-error-color);
  }

  p {
    margin: 0;
  }
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
