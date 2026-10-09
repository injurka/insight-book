<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <button class="lotus-mode" type="button" @click="router.push({ name: 'plugin-lotus-riddle-index' })">
    <span aria-hidden="true">❋</span><span><strong>Павильон загадок</strong><small>Да-нетка · существительные из SRS</small></span><span aria-hidden="true">→</span>
  </button>
</template>

<style scoped>
.lotus-mode {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 18px;
  color: #f1dfb8;
  background: #352419;
  border: 2px solid #99733f;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.lotus-mode strong,
.lotus-mode small {
  display: block;
}
.lotus-mode small {
  margin-top: 6px;
  color: #d2ba92;
}
.lotus-mode > :last-child {
  margin-left: auto;
}
.lotus-mode:focus-visible {
  outline: 3px solid #e4b769;
  outline-offset: 3px;
}
</style>
