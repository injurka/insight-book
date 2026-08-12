<script setup lang="ts">
import type { SubscriptionTier } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitInput from '~/02.kit/atoms/kit-input.vue'
import KitFormGroup from '~/02.kit/molecules/kit-form-group.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'

interface Props {
  tier?: SubscriptionTier | null
}

const props = withDefaults(defineProps<Props>(), {
  tier: null,
})

const { admin } = useRepos()
const router = useRouter()

const isEdit = computed(() => !!props.tier)

const form = reactive({
  id: '',
  sortOrder: 0,
  icon: 'mdi:star',
  price: 0,
  dailyTokenLimit: 100_000,
  dailyBookLimit: 3,
  isPopular: false,
  gradient: '',
  accentColor: '#94a3b8',
})

const en = reactive({ badge: '', name: '', description: '', features: '' })
const ru = reactive({ badge: '', name: '', description: '', features: '' })
const zh = reactive({ badge: '', name: '', description: '', features: '' })

const langSections = [
  { code: 'En', label: 'English', model: en },
  { code: 'Ru', label: 'Русский', model: ru },
  { code: 'Zh', label: '中文', model: zh },
]

const saving = ref(false)
const error = ref('')
const success = ref('')

function featuresToText(list: string[]): string {
  return (list || []).join('\n')
}

function populate(tier: SubscriptionTier) {
  form.id = tier.id
  form.sortOrder = tier.sortOrder
  form.icon = tier.icon
  form.price = tier.price
  form.dailyTokenLimit = tier.dailyTokenLimit ?? 0
  form.dailyBookLimit = tier.dailyBookLimit ?? 0
  form.isPopular = tier.isPopular
  form.gradient = tier.gradient
  form.accentColor = tier.accentColor
  en.badge = tier.badgeEn
  en.name = tier.nameEn
  en.description = tier.descriptionEn
  en.features = featuresToText(tier.featuresEn)
  ru.badge = tier.badgeRu
  ru.name = tier.nameRu
  ru.description = tier.descriptionRu
  ru.features = featuresToText(tier.featuresRu)
  zh.badge = tier.badgeZh
  zh.name = tier.nameZh
  zh.description = tier.descriptionZh
  zh.features = featuresToText(tier.featuresZh)
}

if (props.tier)
  populate(props.tier)

function toFeatures(text: string): string[] {
  return text.split('\n').map(s => s.trim()).filter(Boolean)
}

function buildPayload() {
  const payload: Record<string, unknown> = {
    sortOrder: Number(form.sortOrder) || 0,
    icon: form.icon.trim(),
    price: Number(form.price) || 0,
    dailyTokenLimit: Number(form.dailyTokenLimit) || 0,
    dailyBookLimit: Number(form.dailyBookLimit) || 0,
    isPopular: form.isPopular,
    gradient: form.gradient.trim(),
    accentColor: form.accentColor.trim(),
    badgeEn: en.badge.trim(),
    badgeRu: ru.badge.trim(),
    badgeZh: zh.badge.trim(),
    nameEn: en.name.trim(),
    nameRu: ru.name.trim(),
    nameZh: zh.name.trim(),
    descriptionEn: en.description.trim(),
    descriptionRu: ru.description.trim(),
    descriptionZh: zh.description.trim(),
    featuresEn: toFeatures(en.features),
    featuresRu: toFeatures(ru.features),
    featuresZh: toFeatures(zh.features),
  }

  if (!isEdit.value)
    payload.id = form.id.trim()

  return payload
}

async function handleSave() {
  saving.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = buildPayload()
    if (isEdit.value) {
      await admin.updateSubscriptionTier(props.tier!.id, payload)
      success.value = 'Сохранено!'

      setTimeout(() => {
        success.value = ''
      }, 2000)
    }
    else {
      await admin.createSubscriptionTier(payload)
      router.push({ name: 'subscriptions' })
    }
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally { saving.value = false }
}

async function handleDelete() {
  if (!confirm(`Удалить тариф "${ru.name || form.id}"?`))
    return
  try {
    await admin.deleteSubscriptionTier(props.tier!.id)
    router.push({ name: 'subscriptions' })
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <div>
    <div class="subscription-tier-form__back">
      <RouterLink to="/subscriptions" class="subscription-tier-form__back-link">
        <Icon icon="mdi:arrow-left" />
        <span>Назад</span>
      </RouterLink>
      <h1 class="subscription-tier-form__title">
        <Icon icon="mdi:card-account-details" class="subscription-tier-form__title-icon" />
        <span>{{ isEdit ? `Тариф: ${ru.name || form.id}` : 'Новый тариф' }}</span>
      </h1>
    </div>

    <KitError v-if="error" :message="error" />

    <form class="subscription-tier-form__card" @submit.prevent="handleSave">
      <!-- Основные параметры -->
      <h2 class="subscription-tier-form__section-title">
        <Icon icon="mdi:tune-variant" />
        <span>Основные параметры</span>
      </h2>

      <div class="subscription-tier-form__grid">
        <KitFormGroup>
          <template #label>
            ID (slug)
          </template>
          <KitInput
            v-model="form.id"
            :disabled="isEdit"
            placeholder="base"
          />
          <div v-if="isEdit" class="subscription-tier-form__hint">
            ID менять нельзя — на него ссылаются пользователи
          </div>
        </KitFormGroup>

        <KitFormGroup>
          <template #label>
            Порядок сортировки
          </template>
          <KitInput v-model.number="form.sortOrder" type="number" />
        </KitFormGroup>

        <KitFormGroup>
          <template #label>
            Иконка (mdi:)
          </template>
          <KitInput v-model="form.icon" placeholder="mdi:star" />
        </KitFormGroup>

        <KitFormGroup>
          <template #label>
            Цена (₽/мес)
          </template>
          <KitInput v-model.number="form.price" type="number" />
        </KitFormGroup>

        <KitFormGroup>
          <template #label>
            Лимит токенов в день
          </template>
          <KitInput v-model.number="form.dailyTokenLimit" type="number" />
        </KitFormGroup>

        <KitFormGroup>
          <template #label>
            Лимит книг в день
          </template>
          <KitInput v-model.number="form.dailyBookLimit" type="number" />
        </KitFormGroup>

        <KitFormGroup>
          <template #label>
            Акцентный цвет
          </template>
          <KitInput v-model="form.accentColor" placeholder="#3b82f6" />
        </KitFormGroup>

        <KitFormGroup>
          <template #label>
            Градиент (CSS)
          </template>
          <KitInput
            v-model="form.gradient"
            placeholder="linear-gradient(...)"
          />
        </KitFormGroup>
      </div>

      <div class="subscription-tier-form__popular">
        <v-switch
          v-model="form.isPopular"
          color="#4b8266"
          density="compact"
          hide-details
        />
        <span class="subscription-tier-form__popular-label">Популярный тариф (бейдж «Выбор читателей»)</span>
      </div>

      <!-- Локализация -->
      <h2 class="subscription-tier-form__section-title">
        <Icon icon="mdi:translate" />
        <span>Локализация (en / ru / zh)</span>
      </h2>

      <div class="subscription-tier-form__langs">
        <div
          v-for="lang in langSections"
          :key="lang.code"
          class="subscription-tier-form__lang"
        >
          <h3 class="subscription-tier-form__lang-title">
            {{ lang.label }} ({{ lang.code }})
          </h3>

          <KitFormGroup>
            <template #label>
              Бейдж
            </template>
            <KitInput v-model="lang.model.badge" placeholder="🥉 Basic" />
          </KitFormGroup>

          <KitFormGroup>
            <template #label>
              Название
            </template>
            <KitInput v-model="lang.model.name" placeholder="Basic Subscription" />
          </KitFormGroup>

          <KitFormGroup>
            <template #label>
              Описание
            </template>
            <v-textarea
              v-model="lang.model.description"
              class="subscription-tier-form__textarea"
              variant="outlined"
              density="compact"
              hide-details
              rows="2"
              auto-grow
            />
          </KitFormGroup>

          <KitFormGroup>
            <template #label>
              Возможности (по одной на строку)
            </template>
            <v-textarea
              v-model="lang.model.features"
              class="subscription-tier-form__textarea"
              variant="outlined"
              density="compact"
              hide-details
              rows="6"
              auto-grow
            />
          </KitFormGroup>
        </div>
      </div>

      <div class="subscription-tier-form__actions">
        <KitBtn type="submit" variant="success" :disabled="saving">
          <Icon v-if="!saving" icon="mdi:content-save" />
          <span>{{ saving ? 'Сохранение...' : 'Сохранить' }}</span>
        </KitBtn>
        <KitBtn
          v-if="isEdit"
          type="button"
          variant="danger"
          @click="handleDelete"
        >
          <Icon icon="mdi:delete" />
          <span>Удалить</span>
        </KitBtn>
      </div>
      <div v-if="success" class="subscription-tier-form__success">
        {{ success }}
      </div>
    </form>
  </div>
</template>

<style scoped>
.subscription-tier-form__back {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.subscription-tier-form__back-link {
  color: var(--fg-secondary-color, #8e867b);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.subscription-tier-form__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  display: flex;
  align-items: center;
  gap: 10px;
}
.subscription-tier-form__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}
.subscription-tier-form__card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 24px;
  max-width: 1100px;
}
.subscription-tier-form__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin: 0 0 16px;
}
.subscription-tier-form__section-title + .subscription-tier-form__section-title {
  margin-top: 28px;
}
.subscription-tier-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
}
.subscription-tier-form__popular {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 4px;
}
.subscription-tier-form__popular-label {
  font-size: 14px;
  color: var(--fg-primary-color, #4a443c);
}
.subscription-tier-form__hint {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  margin-top: 4px;
}
.subscription-tier-form__langs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.subscription-tier-form__lang {
  background: var(--bg-primary-color, rgba(255, 255, 255, 0.4));
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 16px;
}
.subscription-tier-form__lang-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
  margin: 0 0 12px;
}
.subscription-tier-form__textarea :deep(.v-field) {
  background-color: var(--bg-primary-color, #f3efe9) !important;
  border-radius: 6px !important;
  font-size: 14px;
  color: var(--fg-primary-color, #4a443c) !important;
}
.subscription-tier-form__actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}
.subscription-tier-form__success {
  color: var(--fg-success-color, #4b8266);
  font-size: 14px;
  margin-top: 12px;
}
</style>
