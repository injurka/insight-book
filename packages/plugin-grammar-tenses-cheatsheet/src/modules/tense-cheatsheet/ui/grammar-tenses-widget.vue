<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, render } from 'vue'
import { detectTenses, tenseById, tenseFamilies, tenses, type TenseDefinition } from '../data/tenses'

const isOpen = ref(false)
const highlightedTenseIds = ref<string[]>([])
const viewMode = ref<'detail' | 'table'>('table')
const modalRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

const highlightedTenses = computed(() => highlightedTenseIds.value
  .map(id => tenseById.get(id))
  .filter((tense): tense is TenseDefinition => Boolean(tense)))

const hostByBlock = new Map<HTMLElement, HTMLSpanElement>()
let observer: MutationObserver | null = null
let scanFrame: number | null = null
let previouslyFocusedElement: HTMLElement | null = null
let previousBodyOverflow: string | null = null

function openCheatsheet(detected: readonly TenseDefinition[]) {
  if (!isOpen.value && typeof document !== 'undefined') {
    previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  highlightedTenseIds.value = detected.map(tense => tense.id)
  isOpen.value = true

  nextTick(() => closeButtonRef.value?.focus())
}

function closeCheatsheet() {
  if (!isOpen.value)
    return

  isOpen.value = false

  if (typeof document !== 'undefined' && previousBodyOverflow !== null) {
    document.body.style.overflow = previousBodyOverflow
    previousBodyOverflow = null
  }

  const elementToRestore = previouslyFocusedElement
  previouslyFocusedElement = null
  if (elementToRestore?.isConnected) {
    nextTick(() => elementToRestore.focus())
  }
}

function isGrammarBlock(block: HTMLElement): boolean {
  const heading = block.querySelector('h3')?.textContent?.trim().toLocaleLowerCase()
  return Boolean(heading && /граммат|grammar|语法|문법/iu.test(heading))
}

/**
 * Кнопка открывает шпаргалку из заголовка блока анализа — она живёт в DOM
 * хоста, поэтому рендерится отдельным vnode-деревом (иконка берётся из
 * локально зарегистрированной коллекции MDI).
 */
function triggerVNode(block: HTMLElement, detected: readonly TenseDefinition[]) {
  const label = 'Открыть шпаргалку по временам'

  return h('button', {
    type: 'button',
    class: 'ib-grammar-tenses-trigger',
    'aria-label': label,
    'title': label,
    'data-detected-tenses': detected.map(tense => tense.id).join(','),
    'disabled': detected.length === 0,
    'onClick': () => openCheatsheet(detectTenses(block.textContent ?? '')),
  }, [
    h(Icon, {
      icon: 'mdi:clock-check-outline',
      class: 'ib-grammar-tenses-trigger-icon',
      'aria-hidden': 'true',
    }),
    h('span', { class: 'ib-grammar-tenses-trigger-label' }, 'Времена'),
  ])
}

function hostForBlock(block: HTMLElement, detected: readonly TenseDefinition[]): HTMLSpanElement {
  let host = hostByBlock.get(block)

  if (!host) {
    host = document.createElement('span')
    host.className = 'ib-grammar-tenses-trigger-host'
    hostByBlock.set(block, host)
  }

  render(triggerVNode(block, detected), host)

  return host
}

function removeButton(block: HTMLElement) {
  const host = hostByBlock.get(block)
  if (!host)
    return

  render(null, host)
  host.remove()
  hostByBlock.delete(block)
  block.classList.remove('ib-has-grammar-tenses-trigger')
}

function scanAnalysisBlocks() {
  if (typeof document === 'undefined')
    return

  const activeBlocks = new Set<HTMLElement>()

  for (const block of document.querySelectorAll<HTMLElement>('.analysis-block')) {
    if (!isGrammarBlock(block))
      continue

    const detected = detectTenses(block.textContent ?? '')
    const heading = block.querySelector('h3')
    if (!heading || detected.length === 0) {
      removeButton(block)
      continue
    }

    const host = hostForBlock(block, detected)
    if (!host.isConnected)
      heading.append(host)

    block.classList.add('ib-has-grammar-tenses-trigger')
    activeBlocks.add(block)
  }

  for (const block of hostByBlock.keys()) {
    if (!activeBlocks.has(block) || !block.isConnected)
      removeButton(block)
  }
}

function scheduleScan() {
  if (scanFrame !== null)
    return

  scanFrame = window.requestAnimationFrame(() => {
    scanFrame = null
    scanAnalysisBlocks()
  })
}

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value)
    return

  if (event.key === 'Escape') {
    event.preventDefault()
    closeCheatsheet()
    return
  }

  if (event.key !== 'Tab' || !modalRef.value)
    return

  const focusableElements = modalRef.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusableElements.length === 0)
    return

  const first = focusableElements[0]
  const last = focusableElements[focusableElements.length - 1]

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function clearInjectedButtons() {
  for (const block of hostByBlock.keys())
    removeButton(block)
}

onMounted(async () => {
  await nextTick()
  scanAnalysisBlocks()

  observer = new MutationObserver(scheduleScan)
  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  })
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  if (scanFrame !== null)
    window.cancelAnimationFrame(scanFrame)
  scanFrame = null
  document.removeEventListener('keydown', handleKeydown)
  if (previousBodyOverflow !== null) {
    document.body.style.overflow = previousBodyOverflow
    previousBodyOverflow = null
  }
  previouslyFocusedElement = null
  clearInjectedButtons()
})
</script>

<template>
  <span class="ib-grammar-tenses-anchor" aria-hidden="true" />

  <Teleport to="body">
    <div
      v-if="isOpen"
      class="ib-grammar-tenses-overlay"
      role="presentation"
      @click.self="closeCheatsheet"
    >
      <section
        ref="modalRef"
        class="ib-grammar-tenses-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ib-grammar-tenses-title"
      >
        <header class="ib-grammar-tenses-modal-header">
          <h2 id="ib-grammar-tenses-title">Шпаргалка по временам</h2>
          <div class="ib-grammar-tenses-actions">
            <button
              ref="closeButtonRef"
              type="button"
              class="ib-grammar-tenses-close"
              aria-label="Закрыть шпаргалку"
              title="Закрыть"
              @click="closeCheatsheet"
            >
              <Icon icon="mdi:close" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div v-if="highlightedTenses.length > 0" class="ib-grammar-tenses-detected">
          <span class="ib-grammar-tenses-detected-label">В анализе:</span>
          <span v-for="tense in highlightedTenses" :key="tense.id" class="ib-grammar-tenses-chip">
            {{ tense.name }}
          </span>
          <div class="ib-grammar-tenses-view-switch" role="group" aria-label="Вид шпаргалки">
            <button
              type="button"
              :class="{ 'is-active': viewMode === 'table' }"
              :aria-pressed="viewMode === 'table'"
              title="Компактная таблица"
              @click="viewMode = 'table'"
            >
              Таблица
            </button>
            <button
              type="button"
              :class="{ 'is-active': viewMode === 'detail' }"
              :aria-pressed="viewMode === 'detail'"
              title="Подробные карточки"
              @click="viewMode = 'detail'"
            >
              Подробно
            </button>
          </div>
        </div>

        <div v-if="viewMode === 'detail'" class="ib-grammar-tenses-body ib-grammar-tenses-body--detail">
          <section class="ib-grammar-tenses-quick-card">
            <h3>Как выбрать время за 10 секунд</h3>
            <div class="ib-grammar-tenses-family-grid">
              <article v-for="family in tenseFamilies" :key="family.name">
                <strong>{{ family.name }}</strong>
                <span>{{ family.meaning }}</span>
              </article>
            </div>
            <p class="ib-grammar-tenses-reference">
              <code>V1</code> — начальная форма (<i>go</i>), <code>V2</code> — прошедшая (<i>went</i>),
              <code>V3</code> — третья форма (<i>gone</i>), <code>V-ing</code> — форма процесса (<i>going</i>).
            </p>
          </section>

          <div class="ib-grammar-tenses-list">
            <article
              v-for="(tense, index) in tenses"
              :key="tense.id"
              class="ib-grammar-tense-card"
              :class="{ 'is-highlighted': highlightedTenseIds.includes(tense.id) }"
            >
              <div class="ib-grammar-tense-heading">
                <span class="ib-grammar-tense-number">{{ index + 1 }}</span>
                <div>
                  <h3>{{ tense.name }}</h3>
                  <p>{{ tense.short }}</p>
                </div>
              </div>

              <div class="ib-grammar-tense-columns">
                <div class="ib-grammar-tense-column ib-grammar-tense-formulas">
                  <h4>Формула</h4>
                  <code>{{ tense.formula }}</code>
                  <span class="ib-grammar-tense-auxiliary">Вспомогательный: {{ tense.auxiliary }}</span>
                  <code>{{ tense.negative }}</code>
                  <code>{{ tense.question }}</code>
                </div>
                <div class="ib-grammar-tense-column">
                  <h4>Когда используем</h4>
                  <ul>
                    <li v-for="use in tense.uses" :key="use">{{ use }}</li>
                  </ul>
                </div>
                <div class="ib-grammar-tense-column">
                  <h4>Маркеры</h4>
                  <div class="ib-grammar-tense-signals">
                    <span v-for="signal in tense.signals" :key="signal">{{ signal }}</span>
                  </div>
                </div>
              </div>

              <div class="ib-grammar-tense-example">
                <div>
                  <span class="ib-grammar-tense-example-label">Пример</span>
                  <strong>{{ tense.example }}</strong>
                  <span>{{ tense.translation }}</span>
                </div>
                <p><b>Важно:</b> {{ tense.commonMistake }}</p>
              </div>
            </article>
          </div>
        </div>

        <div v-else class="ib-grammar-tenses-body ib-grammar-tenses-body--table">
          <div class="ib-grammar-tenses-table-wrap">
            <table class="ib-grammar-tenses-table">
              <thead>
                <tr>
                  <th scope="col">Время</th>
                  <th scope="col">Формула</th>
                  <th scope="col">Когда</th>
                  <th scope="col">Маркеры</th>
                  <th scope="col">Пример</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(tense, index) in tenses"
                  :key="tense.id"
                  :class="{ 'is-highlighted': highlightedTenseIds.includes(tense.id) }"
                >
                  <th scope="row">
                    <span class="ib-grammar-tenses-table-name">
                      <span class="ib-grammar-tenses-table-number">{{ index + 1 }}</span>
                      <strong>{{ tense.name }}</strong>
                    </span>
                    <small>{{ tense.short }}</small>
                  </th>
                  <td data-label="Формула">
                    <code>{{ tense.formula }}</code>
                    <small>вспом.: {{ tense.auxiliary }}</small>
                    <code>{{ tense.negative }}</code>
                    <code>{{ tense.question }}</code>
                  </td>
                  <td data-label="Когда">{{ tense.uses.join(' · ') }}</td>
                  <td data-label="Маркеры">{{ tense.signals.join(', ') }}</td>
                  <td data-label="Пример">
                    <strong>{{ tense.example }}</strong>
                    <small>{{ tense.translation }}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style>
.ib-grammar-tenses-anchor,
.ib-grammar-tenses-trigger-host {
  display: contents;
}

.analysis-block.ib-has-grammar-tenses-trigger h3 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.analysis-block.ib-has-grammar-tenses-trigger h3 > svg {
  flex: 0 0 auto;
}

.grammar-tenses-sandbox-analysis {
  position: relative;
  z-index: 1;
  margin: 0 28px 24px;
  padding: 16px 18px;
  border: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.14));
  border-radius: 14px;
  background: var(--bg-primary-color, rgba(255, 255, 255, 0.05));
  color: var(--fg-primary-color, #f5f7fa);
  font-family: inherit;
  line-height: 1.5;
}

.grammar-tenses-sandbox-analysis h3 {
  margin: 0 0 10px;
  font-size: 1rem;
}

.grammar-tenses-sandbox-analysis .grammar-card {
  display: grid;
  gap: 6px;
}

.grammar-tenses-sandbox-analysis .rule-pattern {
  color: var(--fg-accent-color, #d69e2e);
  font-weight: 700;
}

.grammar-tenses-sandbox-analysis .rule-exp,
.grammar-tenses-sandbox-analysis .rule-ex {
  color: var(--fg-secondary-color, #aeb7c4);
  font-size: 0.82rem;
}

/* Кнопка-триггер в заголовке блока грамматического анализа */
.ib-grammar-tenses-trigger {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 5px;
  min-height: 28px;
  margin-left: auto;
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 8%, transparent);
  color: inherit;
  font: inherit;
  font-size: 0.72em;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.ib-grammar-tenses-trigger-icon {
  flex: 0 0 auto;
  font-size: 1.2em;
}

.ib-grammar-tenses-trigger:hover,
.ib-grammar-tenses-trigger:focus-visible {
  border-color: var(--fg-accent-color, #d69e2e);
  background: color-mix(in srgb, var(--fg-accent-color, #d69e2e) 16%, transparent);
  outline: none;
}

/* Оверлей и модальное окно шпаргалки */
.ib-grammar-tenses-overlay,
.ib-grammar-tenses-modal {
  font-family: var(--app-font-family, 'Maple Mono CN', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
}

.ib-grammar-tenses-overlay {
  position: fixed;
  z-index: 1300;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: rgba(8, 12, 18, 0.7);
  backdrop-filter: blur(6px);
}

.ib-grammar-tenses-modal {
  display: flex;
  flex-direction: column;
  width: min(1160px, 100%);
  max-height: min(820px, calc(100dvh - 24px));
  overflow: hidden;
  border: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.12));
  border-radius: 24px;
  background: var(--bg-primary-color, #151922);
  color: var(--fg-primary-color, #f5f7fa);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
  font-size: 0.84rem;
}

.ib-grammar-tenses-modal:focus {
  outline: none;
}

.ib-grammar-tenses-modal-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.12));
  background: var(--bg-secondary-color, rgba(255, 255, 255, 0.035));
}

.ib-grammar-tenses-modal h2 {
  min-width: 0;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.ib-grammar-tenses-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.ib-grammar-tenses-close {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.14));
  border-radius: 50%;
  background: transparent;
  color: var(--fg-secondary-color, #aeb7c4);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.ib-grammar-tenses-close:hover,
.ib-grammar-tenses-close:focus-visible {
  border-color: var(--fg-accent-color, #d69e2e);
  color: var(--fg-primary-color, #f5f7fa);
  outline: none;
}

/* Строка «В анализе» и переключатель вида */
.ib-grammar-tenses-detected {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 6px 14px;
  background: color-mix(in srgb, var(--fg-accent-color, #d69e2e) 7%, transparent);
  font-size: 0.72rem;
}

.ib-grammar-tenses-detected-label {
  color: var(--fg-secondary-color, #aeb7c4);
}

.ib-grammar-tenses-chip,
.ib-grammar-tense-signals span {
  display: inline-flex;
  padding: 3px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--fg-accent-color, #d69e2e) 13%, transparent);
  color: var(--fg-accent-color, #d69e2e);
  font-size: 0.7rem;
  font-weight: 700;
}

.ib-grammar-tenses-view-switch {
  display: inline-flex;
  flex: 0 0 auto;
  max-width: 100%;
  margin-left: auto;
  padding: 2px;
  border: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.14));
  border-radius: 7px;
  background: var(--bg-tertiary-color, rgba(255, 255, 255, 0.05));
}

.ib-grammar-tenses-view-switch button,
.ib-grammar-tenses-close {
  font-family: inherit;
}

.ib-grammar-tenses-view-switch button {
  min-height: 25px;
  padding: 3px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--fg-secondary-color, #aeb7c4);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.ib-grammar-tenses-view-switch button.is-active,
.ib-grammar-tenses-view-switch button:hover,
.ib-grammar-tenses-view-switch button:focus-visible {
  background: var(--bg-hover-color, rgba(255, 255, 255, 0.1));
  color: var(--fg-primary-color, #f5f7fa);
  outline: none;
}

/* Тело шпаргалки */
.ib-grammar-tenses-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 14px 14px;
}

.ib-grammar-tenses-body--detail {
  padding-top: 12px;
}

.ib-grammar-tenses-quick-card {
  margin-bottom: 10px;
  padding: 11px 13px;
  border: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.12));
  border-radius: 10px;
  background: var(--bg-secondary-color, rgba(255, 255, 255, 0.035));
}

.ib-grammar-tenses-quick-card h3 {
  margin: 0 0 8px;
  font-size: 0.86rem;
}

.ib-grammar-tenses-family-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.ib-grammar-tenses-family-grid article {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 8px;
  border-radius: 7px;
  background: var(--bg-tertiary-color, rgba(255, 255, 255, 0.06));
}

.ib-grammar-tenses-family-grid strong {
  color: var(--fg-accent-color, #d69e2e);
  font-size: 0.74rem;
}

.ib-grammar-tenses-family-grid span,
.ib-grammar-tenses-reference {
  color: var(--fg-secondary-color, #aeb7c4);
  font-size: 0.68rem;
  line-height: 1.45;
}

.ib-grammar-tenses-reference {
  margin: 8px 0 0;
}

.ib-grammar-tenses-reference code,
.ib-grammar-tense-formulas code {
  color: var(--fg-primary-color, #f5f7fa);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* Подробные карточки времён */
.ib-grammar-tense-card {
  margin-bottom: 8px;
  padding: 11px 12px;
  border: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.11));
  border-radius: 10px;
  background: var(--bg-secondary-color, rgba(255, 255, 255, 0.025));
}

.ib-grammar-tense-card.is-highlighted {
  border-color: color-mix(in srgb, var(--fg-accent-color, #d69e2e) 70%, transparent);
  box-shadow: inset 3px 0 0 var(--fg-accent-color, #d69e2e);
}

.ib-grammar-tense-heading {
  display: flex;
  align-items: flex-start;
  gap: 7px;
}

.ib-grammar-tense-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  flex: 0 0 auto;
  border-radius: 6px;
  background: color-mix(in srgb, var(--fg-accent-color, #d69e2e) 14%, transparent);
  color: var(--fg-accent-color, #d69e2e);
  font-size: 0.65rem;
  font-weight: 800;
}

.ib-grammar-tense-heading h3 {
  margin: 0;
  font-size: 0.86rem;
}

.ib-grammar-tense-heading p {
  margin: 2px 0 0;
  color: var(--fg-secondary-color, #aeb7c4);
  font-size: 0.7rem;
  line-height: 1.4;
}

.ib-grammar-tense-columns {
  display: grid;
  grid-template-columns: 1.05fr 1.4fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.ib-grammar-tense-column h4 {
  margin: 0 0 5px;
  color: var(--fg-secondary-color, #aeb7c4);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ib-grammar-tense-formulas {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ib-grammar-tense-formulas code {
  padding: 4px 6px;
  overflow-x: auto;
  border-radius: 7px;
  background: var(--bg-tertiary-color, rgba(255, 255, 255, 0.06));
  font-size: 0.68rem;
  white-space: nowrap;
}

.ib-grammar-tense-auxiliary {
  color: var(--fg-accent-color, #d69e2e);
  font-size: 0.66rem;
  line-height: 1.3;
}

.ib-grammar-tense-column ul {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding-left: 15px;
  color: var(--fg-primary-color, #f5f7fa);
  font-size: 0.7rem;
  line-height: 1.4;
}

.ib-grammar-tense-signals {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.ib-grammar-tense-example {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 10px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.1));
}

.ib-grammar-tense-example > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ib-grammar-tense-example-label {
  color: var(--fg-accent-color, #d69e2e);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ib-grammar-tense-example strong {
  font-size: 0.74rem;
  line-height: 1.4;
}

.ib-grammar-tense-example span:not(.ib-grammar-tense-example-label),
.ib-grammar-tense-example p {
  color: var(--fg-secondary-color, #aeb7c4);
  font-size: 0.68rem;
}

.ib-grammar-tense-example p {
  margin: 0;
  line-height: 1.45;
}

.ib-grammar-tense-example b {
  color: var(--fg-primary-color, #f5f7fa);
}

/* Компактная таблица времён */
.ib-grammar-tenses-table-wrap {
  overflow: auto;
  border: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
}

.ib-grammar-tenses-table {
  width: 100%;
  min-width: 940px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.72rem;
}

.ib-grammar-tenses-table th,
.ib-grammar-tenses-table td {
  padding: 7px 8px;
  border-right: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.08));
  border-bottom: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.08));
  vertical-align: top;
  text-align: left;
  line-height: 1.35;
}

.ib-grammar-tenses-table th:last-child,
.ib-grammar-tenses-table td:last-child {
  border-right: 0;
}

.ib-grammar-tenses-table tbody tr:last-child th,
.ib-grammar-tenses-table tbody tr:last-child td {
  border-bottom: 0;
}

.ib-grammar-tenses-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-tertiary-color, #202735);
  color: var(--fg-secondary-color, #aeb7c4);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ib-grammar-tenses-table thead th:nth-child(1) { width: 15%; }
.ib-grammar-tenses-table thead th:nth-child(2) { width: 22%; }
.ib-grammar-tenses-table thead th:nth-child(3) { width: 25%; }
.ib-grammar-tenses-table thead th:nth-child(4) { width: 20%; }
.ib-grammar-tenses-table thead th:nth-child(5) { width: 18%; }

.ib-grammar-tenses-table tbody tr {
  background: var(--bg-secondary-color, rgba(255, 255, 255, 0.015));
}

.ib-grammar-tenses-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--bg-tertiary-color, #202735) 35%, transparent);
}

.ib-grammar-tenses-table tbody tr.is-highlighted {
  background: color-mix(in srgb, var(--fg-accent-color, #d69e2e) 10%, transparent);
  box-shadow: inset 3px 0 0 var(--fg-accent-color, #d69e2e);
}

.ib-grammar-tenses-table th[scope='row'] {
  color: var(--fg-primary-color, #f5f7fa);
  font-weight: 400;
}

.ib-grammar-tenses-table-name {
  display: flex;
  align-items: flex-start;
  gap: 5px;
}

.ib-grammar-tenses-table-name strong,
.ib-grammar-tenses-table td > strong {
  display: block;
  min-width: 0;
  font-size: 0.76rem;
  font-weight: 750;
}

.ib-grammar-tenses-table small {
  display: block;
  margin-top: 3px;
  color: var(--fg-secondary-color, #aeb7c4);
  font-size: 0.67rem;
  font-weight: 400;
  line-height: 1.35;
}

.ib-grammar-tenses-table code {
  display: block;
  margin-bottom: 3px;
  overflow-x: auto;
  color: var(--fg-primary-color, #f5f7fa);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.68rem;
  white-space: nowrap;
}

.ib-grammar-tenses-table-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--fg-accent-color, #d69e2e) 15%, transparent);
  color: var(--fg-accent-color, #d69e2e);
  font-size: 0.63rem;
  font-weight: 800;
}

@media (max-width: 760px) {
  .ib-grammar-tenses-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .ib-grammar-tenses-modal {
    max-height: 94dvh;
    border-radius: 22px 22px 0 0;
  }

  .ib-grammar-tenses-modal-header,
  .ib-grammar-tenses-body,
  .ib-grammar-tenses-detected {
    padding-left: 18px;
    padding-right: 18px;
  }

  .ib-grammar-tenses-modal-header {
    flex-wrap: wrap;
  }

  .ib-grammar-tenses-family-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ib-grammar-tense-columns,
  .ib-grammar-tense-example {
    grid-template-columns: 1fr;
  }

  .ib-grammar-tenses-table-wrap {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }
}

@media (max-width: 430px) {
  .ib-grammar-tenses-trigger-label {
    display: none;
  }

  .ib-grammar-tenses-trigger {
    width: 28px;
    justify-content: center;
    padding: 4px;
  }
}
</style>
