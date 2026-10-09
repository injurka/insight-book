<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRepos } from '~/00.plugins/di'
import { useAuthStore } from '~/01.shared/store/auth.store'
import ActivityHeatmap from '~/02.kit/organisms/kit-activity-heatmap/ui/kit-activity-heatmap.vue'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'

const emit = defineEmits<{
  openQuiz: [data: { language: string, levelValue: string }]
}>()
const visible = defineModel<boolean>('visible', { required: true })
defineExpose({ fetchActivity })

const repos = useRepos()
const authStore = useAuthStore()
const { t } = useI18n()

const activityData = ref<{ date: string, count: number }[]>([])
const activityStats = ref<{
  learnedWords: number
  readPages: number
  difficulties: { language: string, difficulty: string, count: number }[]
}>({
  learnedWords: 0,
  readPages: 0,
  difficulties: [],
})
const isActivityLoading = ref(true)

watch(visible, (isOpen) => {
  if (isOpen)
    fetchActivity()
})

function onLevelClick(data: { language: string, levelValue: string }) {
  visible.value = false
  emit('openQuiz', data)
}
async function fetchActivity() {
  if (!authStore.user) {
    isActivityLoading.value = false

    return
  }

  isActivityLoading.value = true

  try {
    const res = await repos.activity.getStats()
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
</script>

<template>
  <KitDialog
    v-if="authStore.user"
    v-model:visible="visible"
    icon="mdi:chart-box-outline"
    :title="t('dictionary.activityStats')"
    :max-width="850"
    :minimizable="false"
  >
    <div class="stats-modal-content">
      <ActivityHeatmap
        :loading="isActivityLoading"
        :activity-data="activityData"
        :stats="activityStats"
        @click-level="onLevelClick"
      />
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.stats-modal-content {
  min-height: 250px;
}
</style>
