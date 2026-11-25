<script setup lang="ts">
import type { AdminUserSortBy, UserLifecycleSegment, UserRow } from '~/03.domain/user'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRepos } from '~/00.plugins/di'
import KitBadge from '~/02.kit/atoms/kit-badge.vue'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitInput from '~/02.kit/atoms/kit-input.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitPagination from '~/02.kit/molecules/kit-pagination.vue'
import KitSelect from '~/02.kit/molecules/kit-select.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import {
  formatDuration,
  formatRelativeTime,
  formatTokens,
  getSegmentMeta,
} from '~/03.domain/user'

type SegmentFilter = UserLifecycleSegment | 'all'

const { admin } = useRepos()
const route = useRoute()
const router = useRouter()

const VALID_SEGMENTS = new Set<SegmentFilter>(['all', 'active', 'cooling', 'inactive', 'never_activated'])

function parseSegmentParam(raw: unknown): SegmentFilter {
  if (typeof raw === 'string' && VALID_SEGMENTS.has(raw as SegmentFilter))
    return raw as SegmentFilter

  return 'all'
}

const users = ref<UserRow[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const search = ref('')
const segment = ref<SegmentFilter>(parseSegmentParam(route.query.segment))
const sortBy = ref<AdminUserSortBy>('lastActiveAt')
const loading = ref(true)
const error = ref('')

const segmentPills: Array<{ value: SegmentFilter, label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'cooling', label: 'Остывающие' },
  { value: 'inactive', label: 'Неактивные' },
  { value: 'never_activated', label: 'Не активированы' },
]

const sortOptions: Array<{ value: AdminUserSortBy, label: string }> = [
  { value: 'lastActiveAt', label: 'По последней активности' },
  { value: 'activeSeconds', label: 'По времени на сайте' },
  { value: 'pagesRead', label: 'По прочитанным стр.' },
  { value: 'usedTokens', label: 'По расходу токенов' },
  { value: 'createdAt', label: 'По дате регистрации' },
]

async function load() {
  loading.value = true
  error.value = ''

  try {
    const res = await admin.listUsers({
      page: page.value,
      limit,
      search: search.value || undefined,
      segment: segment.value,
      sortBy: sortBy.value,
      sortDir: 'desc',
    })
    users.value = res.data
    total.value = res.total
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally {
    loading.value = false
  }
}

async function handleDelete(user: UserRow) {
  if (!confirm(`Удалить пользователя "${user.username}"? Это действие необратимо.`))
    return

  try {
    await admin.deleteUser(user.id)
    await load()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

function selectSegment(next: SegmentFilter) {
  if (segment.value === next)
    return

  segment.value = next
  page.value = 1
  router.replace({ query: next === 'all' ? {} : { segment: next } })
  load()
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

let searchTimer: ReturnType<typeof setTimeout>

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})

watch(sortBy, () => {
  page.value = 1
  load()
})

watch(() => route.query.segment, (val) => {
  const next = parseSegmentParam(val)

  if (next !== segment.value) {
    segment.value = next
    page.value = 1
    load()
  }
})

function onPageChange(p: number) {
  page.value = p
  load()
}

onMounted(() => load())
</script>

<template>
  <div>
    <div class="users-list__header">
      <h1 class="users-list__title">
        <Icon icon="mdi:account-group" class="users-list__title-icon" />
        <span>Пользователи</span>
        <span v-if="!loading" class="users-list__total">{{ total }}</span>
      </h1>
      <RouterLink to="/users/create" class="users-list__create-link">
        <KitBtn variant="primary">
          <Icon icon="mdi:plus" />
          <span>Создать</span>
        </KitBtn>
      </RouterLink>
    </div>

    <div class="users-list__toolbar">
      <div class="users-list__pills">
        <button
          v-for="pill in segmentPills"
          :key="pill.value"
          type="button"
          class="users-list__pill"
          :class="{ 'users-list__pill--active': segment === pill.value }"
          @click="selectSegment(pill.value)"
        >
          {{ pill.label }}
        </button>
      </div>

      <div class="users-list__controls">
        <KitInput
          v-model="search"
          placeholder="Поиск по имени или email..."
          class="users-list__search"
        />
        <div class="users-list__sort">
          <KitSelect v-model="sortBy" :options="sortOptions" />
        </div>
      </div>
    </div>

    <KitError v-if="error" :message="error" />

    <div v-if="loading || users.length" class="users-list__table-wrap">
      <table class="users-list__table">
        <thead>
          <tr>
            <th>Пользователь</th>
            <th>Статус</th>
            <th>Последний визит</th>
            <th>Время на сайте</th>
            <th>Активность</th>
            <th>Подписка / Лимиты</th>
            <th class="users-list__th-actions">
              Действия
            </th>
          </tr>
        </thead>
        <tbody v-if="loading">
          <tr v-for="i in 6" :key="i" class="users-list__skeleton-row">
            <td>
              <KitSkeleton width="150px" height="16px" />
            </td>
            <td>
              <KitSkeleton width="90px" height="22px" border-radius="6px" />
            </td>
            <td>
              <KitSkeleton width="90px" height="16px" />
            </td>
            <td>
              <KitSkeleton width="80px" height="16px" />
            </td>
            <td>
              <KitSkeleton width="140px" height="16px" />
            </td>
            <td>
              <KitSkeleton width="140px" height="16px" />
            </td>
            <td>
              <div class="users-list__actions">
                <KitSkeleton width="24px" height="24px" border-radius="4px" />
                <KitSkeleton width="24px" height="24px" border-radius="4px" />
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-for="user in users" :key="user.id">
            <td>
              <div class="users-list__identity">
                <RouterLink :to="`/users/${user.id}`" class="users-list__name-link">
                  {{ user.username }}
                </RouterLink>
                <KitBadge v-if="user.role === 'admin'" variant="admin">
                  admin
                </KitBadge>
              </div>
              <div class="users-list__sub">
                #{{ user.id }} · {{ user.email || 'без email' }}
              </div>
            </td>
            <td>
              <KitBadge :variant="getSegmentMeta(user.segment).badgeVariant">
                {{ getSegmentMeta(user.segment).shortLabel }}
              </KitBadge>
            </td>
            <td>
              <div class="users-list__primary-cell">
                {{ formatRelativeTime(user.lastActiveAt) }}
              </div>
              <div class="users-list__sub">
                {{ user.activeDays }} акт. дн.
              </div>
            </td>
            <td>
              <div class="users-list__primary-cell">
                {{ formatDuration(user.totalActiveSeconds) }}
              </div>
              <div v-if="user.totalReadingSeconds > 0" class="users-list__sub">
                читалка: {{ formatDuration(user.totalReadingSeconds) }}
              </div>
            </td>
            <td class="users-list__muted users-list__small">
              {{ user.booksCount }} кн. · {{ user.pagesRead }} стр. · {{ user.wordsCount }} сл.
            </td>
            <td>
              <div class="users-list__sub-tier">
                <KitBadge :variant="user.subscriptionTier === 'free' ? 'free' : 'pro'">
                  {{ user.subscriptionTier }}
                </KitBadge>
                <span class="users-list__sub">
                  {{ formatTokens(user.usedTokens) }}/{{ formatTokens(user.tokenLimit) }}
                </span>
              </div>
            </td>
            <td>
              <div class="users-list__actions">
                <RouterLink :to="`/users/${user.id}`" class="users-list__action-link">
                  <KitBtn
                    variant="ghost"
                    class="users-list__icon-btn"
                    title="Профиль и аналитика"
                  >
                    <Icon icon="mdi:chart-box-outline" />
                  </KitBtn>
                </RouterLink>
                <KitBtn
                  variant="ghost-danger"
                  class="users-list__icon-btn"
                  title="Удалить"
                  @click="handleDelete(user)"
                >
                  <Icon icon="mdi:delete" />
                </KitBtn>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && !users.length && !error" class="users-list__empty">
      Пользователи не найдены
    </div>
    <KitPagination :page="page" :total-pages="totalPages" @update:page="onPageChange" />
  </div>
</template>

<style scoped>
.users-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.users-list__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.users-list__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}

.users-list__total {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 999px;
  padding: 2px 10px;
}

.users-list__create-link {
  text-decoration: none;
}

.users-list__toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
}

.users-list__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.users-list__pill {
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  background: var(--bg-secondary-color, #e8e2d9);
  color: var(--fg-secondary-color, #8e867b);
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.users-list__pill:hover {
  color: var(--fg-primary-color, #4a443c);
  border-color: var(--border-primary-color, #c7c0b6);
}

.users-list__pill--active {
  background: var(--fg-accent-color, #4b8266);
  border-color: var(--fg-accent-color, #4b8266);
  color: #f3efe9;
  font-weight: 600;
}

.users-list__controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.users-list__search {
  flex: 1 1 280px;
  max-width: 380px;
}

.users-list__sort {
  width: 240px;
}

.users-list__table-wrap {
  overflow-x: auto;
}

.users-list__table {
  width: 100%;
  border-collapse: collapse;
}

.users-list__table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
  white-space: nowrap;
}

.users-list__th-actions {
  width: 96px;
  text-align: right !important;
}

.users-list__table td {
  padding: 11px 12px;
  font-size: 13.5px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  vertical-align: middle;
}

.users-list__table tr:hover td {
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}

.users-list__identity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.users-list__name-link {
  color: var(--fg-accent-color, #4b8266);
  text-decoration: none;
  font-weight: 600;
}

.users-list__name-link:hover {
  text-decoration: underline;
}

.users-list__primary-cell {
  font-weight: 500;
  color: var(--fg-primary-color, #4a443c);
}

.users-list__sub {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  margin-top: 2px;
}

.users-list__sub-tier {
  display: flex;
  align-items: center;
  gap: 8px;
}

.users-list__muted {
  color: var(--fg-secondary-color, #8e867b);
}

.users-list__small {
  font-size: 13px;
  white-space: nowrap;
}

.users-list__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.users-list__action-link {
  text-decoration: none;
  display: inline-flex;
}

.users-list__icon-btn {
  padding: 4px 6px;
  font-size: 12px;
}

.users-list__empty {
  color: var(--fg-secondary-color, #8e867b);
  text-align: center;
  padding: 40px;
}
</style>
