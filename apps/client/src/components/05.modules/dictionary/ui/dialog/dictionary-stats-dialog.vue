<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitDialog } from '~/components/01.kit'
import KitSkeleton from '~/components/01.kit/kit-skeleton/ui/kit-skeleton.vue'
import { api } from '~/shared/services/api.service'
import { useAuthStore } from '~/shared/store/auth.store'

const ActivityHeatmap = lazyComponent(() => import('~/components/02.shared/activity-heatmap/ui/activity-heatmap.vue'))

const visible = defineModel<boolean>('visible', { required: true })

const authStore = useAuthStore()
const { t } = useI18n()

const activityData = ref<{ date: string, count: number }[]>([])
const activityStats = ref({ learnedWords: 0, readPages: 0, difficulties: [] as any[] })
const isActivityLoading = ref(true)

async function fetchActivity() {
  if (!authStore.user) {
    isActivityLoading.value = false
    return
  }

  isActivityLoading.value = true
  try {
    const res = await api.activity.getStats()
    activityData.value = res.heatmap
    activityStats.value = {
      learnedWords: res.learnedWords,
      readPages: res.readPages,
      difficulties: res.difficulties,
    }
  }
  catch (e) {
    console.error('Failed to load activity data:', e)
  }
  finally {
    isActivityLoading.value = false
  }
}

watch(visible, (isOpen) => {
  if (isOpen) {
    fetchActivity()
  }
})

defineExpose({ fetchActivity })
</script>

<template>
  <KitDialog
    v-if="authStore.user"
    v-model:visible="visible"
    :title="t('dictionary.activityStats')"
    icon="mdi:chart-box-outline"
    :max-width="850"
  >
    <div class="stats-modal-content">
      <KitSkeleton v-if="isActivityLoading" width="100%" height="250px" />
      <ActivityHeatmap v-else :activity-data="activityData" :stats="activityStats" />
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.stats-modal-content {
  min-height: 250px;
}
</style>
