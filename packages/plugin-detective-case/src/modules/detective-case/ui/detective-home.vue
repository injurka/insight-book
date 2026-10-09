<script setup lang="ts">
import type { SrsWord } from '@/shared/types'

interface Props {
  words: SrsWord[]
  dueCount: number
  isLoading: boolean
  isGenerating: boolean
  error: string
}

defineProps<Props>()

const emit = defineEmits<{
  start: []
  reload: []
}>()
</script>

<template>
  <main class="home-shell">
    <section class="home-copy">
      <div class="case-stamp">
        <span class="stamp-dot" /> CASE FILE / 01
      </div>
      <p class="eyebrow">
        ENGLISH · INTERACTIVE MYSTERY
      </p>
      <h1>Дело о пропавшей<br><em>картине</em></h1>
      <p class="intro">
        Картина исчезла из галереи отеля. Разговорите свидетелей, изучите улики
        и восстановите показания — используя слова из вашего SRS.
      </p>
      <div class="home-actions">
        <button class="primary-button" :disabled="isLoading || isGenerating || words.length === 0" @click="emit('start')">
          <span v-if="isGenerating" class="button-spinner" />
          {{ isGenerating ? 'Подготавливаем дело…' : 'Открыть дело' }}
          <span v-if="!isGenerating" aria-hidden="true">↗</span>
        </button>
        <button class="text-button" :disabled="isLoading || isGenerating" @click="emit('reload')">
          {{ isLoading ? 'Загружаем слова…' : 'Обновить слова' }}
        </button>
      </div>
      <p v-if="error" class="error-note" role="alert">
        {{ error }}
      </p>
    </section>

    <aside class="dossier-card">
      <div class="dossier-topline">
        <span>СВОДКА ДЕЛА</span>
        <span class="status-dot" />
      </div>
      <div class="dossier-art" aria-hidden="true">
        <div class="frame frame-back" />
        <div class="frame frame-front">
          <span class="portrait-head" /><span class="portrait-body" />
        </div>
        <div class="missing-mark">
          ?
        </div>
      </div>
      <div class="dossier-details">
        <div>
          <span class="meta-label">СЛОВ В ЭТОМ ДЕЛЕ</span>
          <strong>{{ words.length }} <small>/ 8</small></strong>
        </div>
        <div>
          <span class="meta-label">ПОРА ПОВТОРИТЬ</span>
          <strong>{{ dueCount }}</strong>
        </div>
      </div>
      <div class="word-preview">
        <span class="meta-label">СЛОВА ИЗ ОЧЕРЕДИ SRS</span>
        <p v-if="isLoading" class="empty-note">
          Сверяем карточки с расписанием SRS…
        </p>
        <p v-else-if="words.length === 0" class="empty-note">
          В очереди SRS нет английских слов для повторения.
        </p>
        <div v-else class="word-list">
          <div v-for="word in words.slice(0, 5)" :key="word.id" class="word-row">
            <span>{{ word.word }}</span>
            <span>{{ word.translation }}</span>
          </div>
          <span v-if="words.length > 5" class="more-words">и ещё {{ words.length - 5 }}</span>
        </div>
      </div>
      <div class="dossier-footer">
        <span>HOTEL MERIDIAN</span>
        <span>ВЕЧЕР · 21:40</span>
      </div>
    </aside>
  </main>
</template>

<style scoped>
.home-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(300px, 0.88fr);
  gap: clamp(32px, 7vw, 104px);
  align-items: center;
  width: min(1120px, 100%);
  margin: auto;
  padding: clamp(28px, 7vh, 80px) clamp(18px, 5vw, 64px);
}
.home-copy {
  max-width: 600px;
}
.case-stamp {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 9px 12px;
  border: 1px solid rgba(226, 185, 115, 0.32);
  border-radius: 3px;
  color: #e2b973;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
}
.stamp-dot,
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d8a65e;
  box-shadow: 0 0 12px rgba(216, 166, 94, 0.6);
}
.eyebrow,
.meta-label {
  color: #94a4b2;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
}
.eyebrow {
  margin: 32px 0 13px;
}
h1 {
  margin: 0;
  color: #f3eee5;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(42px, 6vw, 70px);
  font-weight: 400;
  line-height: 0.98;
  letter-spacing: -0.04em;
}
h1 em {
  color: #e2b973;
  font-weight: 400;
}
.intro {
  max-width: 480px;
  margin: 24px 0 0;
  color: #b9c3ca;
  font-size: 15px;
  line-height: 1.8;
}
.home-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  margin-top: 32px;
}
.primary-button {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  gap: 14px;
  padding: 0 20px;
  border: 0;
  border-radius: 3px;
  background: #d8a65e;
  color: #172431;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}
.primary-button:hover:not(:disabled) {
  background: #e8bd7d;
  transform: translateY(-1px);
}
.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.text-button {
  border: 0;
  background: transparent;
  color: #aebbc4;
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
  text-decoration-color: rgba(174, 187, 196, 0.35);
  text-underline-offset: 4px;
}
.text-button:disabled {
  cursor: wait;
  opacity: 0.6;
}
.error-note {
  color: #ef9a87;
  font-size: 13px;
  line-height: 1.55;
}
.button-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(23, 36, 49, 0.25);
  border-top-color: #172431;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.dossier-card {
  position: relative;
  padding: 20px;
  border: 1px solid rgba(206, 220, 229, 0.14);
  background: linear-gradient(145deg, rgba(37, 54, 68, 0.96), rgba(24, 39, 53, 0.96));
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
}
.dossier-topline,
.dossier-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #92a3af;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
}
.dossier-art {
  position: relative;
  display: grid;
  height: 210px;
  place-items: center;
  margin: 18px 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% 44%, rgba(202, 161, 98, 0.15), transparent 52%),
    linear-gradient(145deg, #192c3b, #23394a);
}
.dossier-art::before,
.dossier-art::after {
  position: absolute;
  width: 180px;
  height: 1px;
  background: rgba(218, 189, 142, 0.12);
  content: '';
  transform: rotate(-25deg);
}
.dossier-art::after {
  transform: rotate(25deg);
}
.frame {
  position: absolute;
  width: 124px;
  height: 150px;
  border: 7px solid #a77942;
  box-shadow:
    inset 0 0 0 2px #493a2c,
    0 12px 24px rgba(0, 0, 0, 0.35);
}
.frame-back {
  transform: translate(-10px, 4px) rotate(-5deg);
  opacity: 0.55;
}
.frame-front {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: linear-gradient(145deg, #496270, #203748);
  transform: rotate(3deg);
}
.portrait-head {
  width: 35px;
  height: 42px;
  border-radius: 50% 50% 40% 40%;
  background: #b28b65;
}
.portrait-body {
  width: 68px;
  height: 45px;
  border-radius: 34px 34px 7px 7px;
  background: #352e35;
}
.missing-mark {
  position: absolute;
  right: 23px;
  bottom: 17px;
  color: rgba(226, 185, 115, 0.72);
  font-family: Georgia, serif;
  font-size: 36px;
  transform: rotate(9deg);
}
.dossier-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 4px 0 18px;
}
.dossier-details > div {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.dossier-details strong {
  color: #f2eee5;
  font-family: Georgia, serif;
  font-size: 25px;
  font-weight: 400;
}
.dossier-details small {
  color: #91a2af;
  font-family: inherit;
  font-size: 14px;
}
.word-preview {
  min-height: 112px;
  padding: 15px 0;
  border-top: 1px solid rgba(206, 220, 229, 0.13);
}
.word-list {
  display: grid;
  gap: 8px;
  margin-top: 13px;
}
.word-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: #e9e4da;
  font-size: 12px;
}
.word-row span:last-child {
  color: #92a3af;
  text-align: right;
}
.more-words,
.empty-note {
  margin: 10px 0 0;
  color: #92a3af;
  font-size: 11px;
}
.dossier-footer {
  padding-top: 14px;
  border-top: 1px solid rgba(206, 220, 229, 0.13);
  font-size: 8px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .home-shell {
    grid-template-columns: 1fr;
    gap: 34px;
    padding: 28px 20px 42px;
  }
  .dossier-card {
    max-width: 500px;
  }
}
</style>
