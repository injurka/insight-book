<script setup lang="ts">
export interface Props {
  variant?: 'default' | 'admin' | 'user' | 'pending' | 'approved' | 'rejected' | 'free' | 'pro' | 'active' | 'cooling' | 'inactive' | 'never_activated'
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
})
</script>

<template>
  <v-chip
    class="kit-badge"
    :class="`kit-badge--${variant}`"
    size="small"
    label
    variant="flat"
  >
    <slot />
  </v-chip>
</template>

<style scoped>
.kit-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 4px;
  letter-spacing: 0.2px;
}

.kit-badge--default {
  background-color: #dfd7cc !important;
  color: #3d3730 !important;
}

.kit-badge--user {
  background-color: #dfd7cc !important;
  color: #3d3730 !important;
  border: 1px solid #c7c0b6;
}

.kit-badge--admin {
  background-color: #4b8266 !important;
  color: #f3efe9 !important;
}

.kit-badge--free {
  background-color: #dcd5c9 !important;
  color: #3d3730 !important;
}

.kit-badge--pro {
  background-color: #4b8266 !important;
  color: #ffffff !important;
}

.kit-badge--pending {
  background-color: #fcf4dd !important;
  color: #7a5e0b !important;
}

.kit-badge--approved {
  background-color: #e4eee6 !important;
  color: #2d5641 !important;
}

.kit-badge--rejected {
  background-color: #f5e3e3 !important;
  color: #8f3535 !important;
}

.kit-badge--active {
  background-color: var(--bg-success-color, #e4eee6) !important;
  color: #2d5641 !important;
  border: 1px solid var(--border-success-color, #7dae94);
}

.kit-badge--cooling {
  background-color: var(--bg-warning-color, #fcf4dd) !important;
  color: #7a5e0b !important;
  border: 1px solid var(--border-warning-color, #dac288);
}

.kit-badge--inactive {
  background-color: var(--bg-error-color, #f5e3e3) !important;
  color: #8f3535 !important;
  border: 1px solid var(--border-error-color, #d49898);
}

.kit-badge--never_activated {
  background-color: var(--bg-info-color, #e0e7ee) !important;
  color: #3f556b !important;
  border: 1px solid var(--border-info-color, #95a9bd);
}
</style>
