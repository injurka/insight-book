<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGame } from '../model/use-game'
import { pavilion, preloadAssets } from '../shared/game-assets'
import RiddleComposer from './riddle-composer.vue'
import RiddleHome from './riddle-home.vue'
import RiddleJournal from './riddle-journal.vue'
import RiddleResult from './riddle-result.vue'
import './riddle.css'

const router = useRouter()
const game = useGame()

const { state, playing } = game
const root = ref<HTMLElement | null>(null)
const ready = ref(false)
const showLoading = ref(false)
const revealDialog = ref<HTMLDialogElement | null>(null)
const assetError = ref(false)

watch(() => state.round?.word.id, async (id) => {
  if (id) {
    await nextTick()
    root.value?.scrollIntoView({ block: 'start' })
  }
})
function reveal() {
  revealDialog.value?.close()
  game.reveal()
}
function exit() {
  // A stable host path also works when the player entered directly from a bookmark.
  void router.push('/dictionary')
}

onMounted(async () => {
  const timer = setTimeout(() => {
    showLoading.value = true
  }, 180)

  try {
    await preloadAssets()
  }
  catch { assetError.value = true }
  finally {
    clearTimeout(timer)
    ready.value = true
  }
})
</script>

<template>
  <main class="lotus-riddle" :class="{ 'lr-gated': !ready }" :aria-busy="!ready || !!state.busy">
    <img
      v-if="!assetError"
      :src="pavilion"
      class="lr-scenery"
      alt=""
      aria-hidden="true"
    >
    <div class="lr-shade" aria-hidden="true" />
    <div v-if="!ready && showLoading" class="lr-loading" role="status">
      Зажигаем фонари…
    </div>
    <div class="lr-content">
      <header class="lr-header">
        <button class="lr-back" aria-label="Вернуться в словарь" @click="exit">
          <span aria-hidden="true">←</span><span>В словарь</span>
        </button><div class="lr-brand">
          <span aria-hidden="true">❋</span><span>Павильон загадок<small>Путь к слову</small></span>
        </div><span class="lr-header-note">Без спешки. По одному шагу.</span>
      </header>
      <div v-if="state.busy" class="lr-status" role="status">
        {{ state.busy }}
      </div>
      <div v-if="state.error" class="lr-alert" role="alert">
        {{ state.error }} <button
          v-if="!state.round"
          class="lr-text-button"
          :disabled="!!state.busy || !state.initialized"
          @click="state.prepared && state.queue.length ? game.begin() : game.prepare()"
        >
          Попробовать снова
        </button>
      </div>
      <p v-if="state.notice" class="lr-status" role="status">
        {{ state.notice }}
      </p>
      <div v-if="!state.round" class="lr-home-layout">
        <RiddleHome
          :language="state.language"
          :prepared="state.prepared"
          :count="state.queue.length"
          :disabled="!!state.busy || !state.initialized || !ready"
          @language="game.changeLanguage"
          @prepare="game.prepare"
          @begin="game.begin"
        /><div class="lr-scene-caption" aria-hidden="true">
          <span>❋</span><p>Тихий вечер.<br>Чай ещё тёплый.<br>Одна тайна ждёт вас.</p>
        </div>
      </div>
      <div v-else class="lr-game-layout">
        <aside class="lr-wood lr-guide">
          <span class="lr-eyebrow">Свиток хранителя</span><h1>Слушайте.<br>Спрашивайте.<br>Вспоминайте.</h1><p>Загадано одно существительное на {{ { en: 'английском', zh: 'китайском', ja: 'японском', ru: 'русском' }[state.language] }} языке.</p><div class="lr-divider" /><h2>Три лепестка помощи</h2><ol class="lr-hints">
            <li v-for="(hint, index) in state.round.mystery.hints" :key="index">
              <span class="lr-petal" aria-hidden="true">{{ index < state.round.hintsUsed ? '❋' : '◇' }}</span><p>{{ index < state.round.hintsUsed || !playing ? hint : ['Категория', 'Свойство', 'Особый признак'][index] }}<small v-if="index >= state.round.hintsUsed && playing">Пока скрыто</small></p>
            </li>
          </ol><button
            v-if="playing"
            class="lr-button lr-wide"
            :disabled="!!state.busy || state.round.hintsUsed >= 3"
            @click="game.hint"
          >
            {{ state.round.hintsUsed === 3 ? 'Все лепестки раскрыты' : 'Открыть подсказку' }}
          </button><p class="lr-footnote">
            Хранитель может ошибаться. «Верный след» — ориентир, а не гарантия.
          </p><button
            v-if="playing"
            class="lr-text-button lr-wide"
            :disabled="!!state.busy"
            @click="revealDialog?.showModal()"
          >
            Раскрыть слово
          </button>
        </aside>
        <div class="lr-play-area">
          <RiddleResult
            v-if="!playing"
            :round="state.round"
            :disabled="!!state.busy"
            @grade="game.grade"
            @skip="game.skipGrade"
            @next="game.next"
          /><RiddleJournal :round="state.round" :busy="playing && !!state.busy" /><RiddleComposer v-if="playing" :disabled="!!state.busy" :submit="game.submit" />
        </div>
      </div>
      <footer class="lr-footer">
        <span>❋ &nbsp; ПАВИЛЬОН ЛОТОСА</span><span v-if="state.initialized && !state.storage">Прогресс хранится только до закрытия страницы.</span><span v-else>Раунд сохраняется в этой вкладке на 12 часов.</span>
      </footer>
    </div>
    <dialog ref="revealDialog" class="lr-dialog" @click="($event.target === revealDialog) && revealDialog?.close()">
      <div class="lr-wood">
        <span class="lr-eyebrow">Открыть свиток?</span><h2>Хранитель покажет ответ.</h2><p>Раунд завершится. Затем вы сможете выбрать оценку SRS или продолжить без записи.</p><div class="lr-dialog-actions">
          <button class="lr-button" autofocus @click="revealDialog?.close()">
            Ещё подумаю
          </button><button class="lr-button lr-primary" @click="reveal">
            Раскрыть
          </button>
        </div>
      </div>
    </dialog>
  </main>
</template>
