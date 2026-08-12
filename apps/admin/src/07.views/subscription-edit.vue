<script setup lang="ts">
import type { SubscriptionTier } from '~/01.shared/types/models'
import { onMounted, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import SubscriptionTierForm from '~/05.modules/subscriptions/subscription-tier-form.vue'

interface Props {
  id: string
}

const props = defineProps<Props>()

const { admin } = useRepos()

const tier = ref<SubscriptionTier | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const tiers = await admin.getSubscriptionTiers()
    tier.value = tiers.find(t => t.id === props.id) || null
    if (!tier.value)
      error.value = `Тариф "${props.id}" не найден`
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally { loading.value = false }
})
</script>

<template>
  <div v-if="loading" class="subscription-edit__loading">
    <KitSkeleton type="form-item" :count="5" />
  </div>

  <KitError v-if="error" :message="error" />

  <SubscriptionTierForm v-if="!loading && tier" :tier="tier" />
</template>

<style scoped>
.subscription-edit__loading {
  max-width: 500px;
}
</style>
