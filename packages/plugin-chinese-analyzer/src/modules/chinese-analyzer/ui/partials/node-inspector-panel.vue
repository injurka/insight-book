<script setup lang="ts">
import type {
  CanvasSelectedNode,
  CharacterNode,
  ComponentNode,
  LexemeToken,
} from '../../model'
import { Icon } from '@iconify/vue'
import HanziWriter from 'hanzi-writer'
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPosClass, getToneBadgeLabel } from '../../../../shared/lib/tone-utils'
import CachedChineseEntry from './cached-chinese-entry.vue'

interface Props {
  selectedNode: CanvasSelectedNode | null
  allTokens: LexemeToken[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectNode: [node: CanvasSelectedNode]
  speak: [text: string]
  analyzeQuery: [text: string]
}>()

const { t } = useI18n()
const hanziBoxEl = useTemplateRef<HTMLDivElement>('hanziBoxRef')
const activeWriter = shallowRef<HanziWriter | null>(null)

const activeCharacterSymbol = computed(() => {
  if (!props.selectedNode) {
    return null
  }

  if (props.selectedNode.kind === 'character') {
    return props.selectedNode.character.char
  }

  if (props.selectedNode.kind === 'token' && props.selectedNode.token.characters.length === 1) {
    return props.selectedNode.token.characters[0].char
  }

  return null
})

watch(activeCharacterSymbol, async () => {
  await nextTick()
  mountHanziWriter()
})

function mountHanziWriter(): void {
  const container = hanziBoxEl.value
  const symbol = activeCharacterSymbol.value

  if (!container || !symbol || !/\p{Script=Han}/u.test(symbol)) {
    activeWriter.value = null

    return
  }

  container.innerHTML = ''

  try {
    const docStyle = getComputedStyle(document.documentElement)
    const strokeColor = docStyle.getPropertyValue('--fg-primary-color').trim() || '#29242a'
    const radicalColor = docStyle.getPropertyValue('--fg-accent-color').trim() || '#e16032'
    const outlineColor = docStyle.getPropertyValue('--border-primary-color').trim() || '#d2cdcb'

    activeWriter.value = HanziWriter.create(container, symbol, {
      width: 96,
      height: 96,
      padding: 6,
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 140,
      strokeColor,
      radicalColor,
      outlineColor,
    })
  }
  catch {
    activeWriter.value = null
  }
}

function animateStrokes(): void {
  activeWriter.value?.animateCharacter()
}

function getComponentTypeBadge(type: ComponentNode['type']): string {
  if (type === 'semantic') {
    return t('plugins.chinese-analyzer.componentSemantic')
  }

  if (type === 'phonetic') {
    return t('plugins.chinese-analyzer.componentPhonetic')
  }

  return t('plugins.chinese-analyzer.componentRadical')
}

function hasDistinctComponentName(component: ComponentNode): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, 'е')
  const name = normalize(component.name)
  const meaning = normalize(component.meaning)

  return Boolean(name) && name !== meaning
}

function selectToken(token: LexemeToken): void {
  emit('selectNode', { kind: 'token', token })
}

function selectCharacter(token: LexemeToken, character: CharacterNode, charIndex: number): void {
  emit('selectNode', { kind: 'character', token, character, charIndex })
}

function selectComponent(token: LexemeToken, character: CharacterNode, component: ComponentNode): void {
  emit('selectNode', { kind: 'component', token, character, component })
}

function getClauseTokens(tokenIds: string[]): LexemeToken[] {
  return props.allTokens.filter(tok => tokenIds.includes(tok.id))
}

onMounted(() => {
  mountHanziWriter()
})
</script>

<template>
  <aside class="inspector-card">
    <header class="inspector-header">
      <div class="header-left">
        <Icon icon="mdi:compass-outline" class="header-icon" />
        <h3 class="header-title">
          {{ t('plugins.chinese-analyzer.inspectorTitle') }}
        </h3>
      </div>

      <!-- Breadcrumb Back Navigation -->
      <div v-if="props.selectedNode" class="inspector-breadcrumbs">
        <button
          v-if="props.selectedNode.kind === 'character' || props.selectedNode.kind === 'component'"
          type="button"
          class="crumb-btn"
          @click="selectToken(props.selectedNode.token)"
        >
          <span>{{ props.selectedNode.token.hanzi }}</span>
        </button>

        <template v-if="props.selectedNode.kind === 'component'">
          <Icon icon="mdi:chevron-right" class="crumb-sep" />
          <button
            type="button"
            class="crumb-btn"
            @click="selectCharacter(props.selectedNode.token, props.selectedNode.character, 0)"
          >
            <span>{{ props.selectedNode.character.char }}</span>
          </button>
        </template>
      </div>
    </header>

    <!-- Empty Hint -->
    <div v-if="!props.selectedNode" class="inspector-empty">
      <Icon icon="mdi:ideogram-cjk-variant" class="empty-icon" />
      <p>{{ t('plugins.chinese-analyzer.inspectorHint') }}</p>
    </div>

    <!-- CASE 1: Syntactic Clause Selected -->
    <div v-else-if="props.selectedNode.kind === 'clause'" class="inspector-body">
      <div class="hero-box clause-hero">
        <span class="type-kicker">{{ t('plugins.chinese-analyzer.layerClauses') }}</span>
        <div class="clause-hero-title">
          {{ props.selectedNode.clause.label }}
        </div>
        <div class="clause-hero-hanzi">
          {{ props.selectedNode.clause.hanzi }}
        </div>
        <div class="clause-hero-trans">
          «{{ props.selectedNode.clause.translation }}»
        </div>
      </div>

      <CachedChineseEntry :text="props.selectedNode.clause.hanzi" />

      <div class="info-row">
        <span class="info-label">{{ t('plugins.chinese-analyzer.syntacticRole') }}</span>
        <span class="info-value">{{ props.selectedNode.clause.role }}</span>
      </div>

      <div class="sub-section">
        <span class="sub-title">{{ t('plugins.chinese-analyzer.layerWords') }}</span>
        <div class="nested-chips-grid">
          <button
            v-for="tok in getClauseTokens(props.selectedNode.clause.tokenIds)"
            :key="tok.id"
            type="button"
            class="nested-word-chip"
            @click="selectToken(tok)"
          >
            <span class="nw-hanzi">{{ tok.hanzi }}</span>
            <span class="nw-pinyin">{{ tok.pinyin }}</span>
            <span class="nw-mean">{{ tok.meaning }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- CASE 2: Lexeme / Word Token Selected -->
    <div v-else-if="props.selectedNode.kind === 'token'" class="inspector-body">
      <div class="hero-box token-hero" :class="getPosClass(props.selectedNode.token.pos)">
        <div class="hero-main-left">
          <div class="hero-badges">
            <span class="pos-pill">{{ props.selectedNode.token.posLabel }}</span>
            <span class="hsk-pill">{{ props.selectedNode.token.hsk }}</span>
          </div>
          <div class="hero-pinyin">
            {{ props.selectedNode.token.pinyin }}
          </div>
          <div class="hero-hanzi">
            {{ props.selectedNode.token.hanzi }}
          </div>
          <div class="hero-meaning">
            {{ props.selectedNode.token.meaning }}
          </div>
        </div>

        <div class="hero-actions-right">
          <div
            v-if="props.selectedNode.token.characters.length === 1"
            class="mini-stroke-card"
          >
            <div ref="hanziBoxRef" class="hanzi-writer-slot" />
            <button type="button" class="stroke-play-btn" @click="animateStrokes">
              <Icon icon="mdi:brush-variant" />
              <span>{{ t('plugins.chinese-analyzer.animateStrokes') }}</span>
            </button>
          </div>

          <div class="hero-btn-stack">
            <button
              type="button"
              class="inspector-action-btn"
              @click="emit('speak', props.selectedNode.token.hanzi)"
            >
              <Icon icon="mdi:volume-high" />
            </button>
            <button
              type="button"
              class="inspector-action-btn"
              :title="t('plugins.chinese-analyzer.analyzeThisWord')"
              @click="emit('analyzeQuery', props.selectedNode.token.hanzi)"
            >
              <Icon icon="mdi:auto-fix" />
            </button>
          </div>
        </div>
      </div>

      <CachedChineseEntry :text="props.selectedNode.token.hanzi" />

      <div class="details-grid">
        <div class="info-block">
          <span class="info-label">{{ t('plugins.chinese-analyzer.syntacticRole') }}</span>
          <span class="info-value accent-val">{{ props.selectedNode.token.syntacticRole }}</span>
        </div>

        <div class="info-block">
          <span class="info-label">{{ t('plugins.chinese-analyzer.dictionaryMeaning') }}</span>
          <span class="info-value">{{ props.selectedNode.token.dictionaryMeaning }}</span>
        </div>
      </div>

      <div v-if="props.selectedNode.token.grammarNote" class="grammar-note-box">
        <div class="note-heading">
          <Icon icon="mdi:school-outline" />
          <span>{{ t('plugins.chinese-analyzer.grammarFunction') }}</span>
        </div>
        <p>{{ props.selectedNode.token.grammarNote }}</p>
      </div>

      <div v-if="props.selectedNode.token.toneSandhiNote" class="sandhi-note-box">
        <div class="note-heading">
          <Icon icon="mdi:waveform" />
          <span>{{ t('plugins.chinese-analyzer.toneSandhi') }}</span>
        </div>
        <p>{{ props.selectedNode.token.toneSandhiNote }}</p>
      </div>

      <!-- Constituent Characters Drill-Down -->
      <div class="sub-section">
        <span class="sub-title">{{ t('plugins.chinese-analyzer.characterBreakdown') }}</span>
        <div class="char-drill-list">
          <div
            v-for="(ch, idx) in props.selectedNode.token.characters"
            :key="`${ch.char}_${idx}`"
            class="char-drill-card"
            @click="selectCharacter(props.selectedNode.token, ch, idx)"
          >
            <div class="cd-seal" :class="`tone-bg-${ch.tone}`">
              {{ ch.char }}
            </div>
            <div class="cd-content">
              <div class="cd-top">
                <span class="cd-pinyin">{{ ch.pinyin }}</span>
                <span class="cd-tone">{{ getToneBadgeLabel(ch.tone) }}</span>
              </div>
              <div class="cd-meaning">
                {{ ch.meaning }}
              </div>
              <div v-if="ch.roleInWord" class="cd-role">
                {{ ch.roleInWord }}
              </div>
            </div>
            <Icon icon="mdi:chevron-right" class="cd-arrow" />
          </div>
        </div>
      </div>

      <!-- Collocations -->
      <div v-if="props.selectedNode.token.collocations.length > 0" class="sub-section">
        <span class="sub-title">{{ t('plugins.chinese-analyzer.collocationsTitle') }}</span>
        <div class="collocations-list">
          <div
            v-for="(col, cIdx) in props.selectedNode.token.collocations"
            :key="`${col.hanzi}_${cIdx}`"
            class="collocation-item"
          >
            <div class="col-main">
              <span class="col-hanzi">{{ col.hanzi }}</span>
              <span class="col-pinyin">{{ col.pinyin }}</span>
              <span class="col-trans">— {{ col.translation }}</span>
            </div>
            <button
              type="button"
              class="col-speak-btn"
              @click="emit('speak', col.hanzi)"
            >
              <Icon icon="mdi:volume-medium" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CASE 3: Single Character Selected -->
    <div v-else-if="props.selectedNode.kind === 'character'" class="inspector-body">
      <div class="hero-box char-hero">
        <div class="hero-main-left">
          <div class="hero-badges">
            <span class="pos-pill">{{ getToneBadgeLabel(props.selectedNode.character.tone) }}</span>
            <span v-if="props.selectedNode.character.structureType" class="hsk-pill">
              {{ props.selectedNode.character.structureType }}
            </span>
          </div>
          <div class="hero-pinyin">
            {{ props.selectedNode.character.pinyin }}
          </div>
          <div class="hero-hanzi">
            {{ props.selectedNode.character.char }}
          </div>
          <div class="hero-meaning">
            {{ props.selectedNode.character.meaning }}
          </div>
        </div>

        <div class="mini-stroke-card">
          <div ref="hanziBoxRef" class="hanzi-writer-slot" />
          <button type="button" class="stroke-play-btn" @click="animateStrokes">
            <Icon icon="mdi:brush-variant" />
            <span>{{ t('plugins.chinese-analyzer.animateStrokes') }}</span>
          </button>
        </div>
      </div>

      <div v-if="props.selectedNode.character.roleInWord" class="grammar-note-box">
        <div class="note-heading">
          <Icon icon="mdi:sitemap-outline" />
          <span>{{ t('plugins.chinese-analyzer.roleInWord') }} «{{ props.selectedNode.token.hanzi }}»</span>
        </div>
        <p>{{ props.selectedNode.character.roleInWord }}</p>
      </div>

      <div v-if="props.selectedNode.character.etymology" class="etymology-box">
        <div class="note-heading">
          <Icon icon="mdi:lightbulb-on-outline" />
          <span>{{ t('plugins.chinese-analyzer.etymologyTitle') }}</span>
        </div>
        <p>{{ props.selectedNode.character.etymology }}</p>
      </div>

      <div v-if="props.selectedNode.character.components.length > 0" class="sub-section">
        <span class="sub-title">{{ t('plugins.chinese-analyzer.radicalsTitle') }}</span>
        <div class="radicals-grid">
          <div
            v-for="(comp, idx) in props.selectedNode.character.components"
            :key="`${comp.symbol}_${idx}`"
            class="radical-detail-card"
            :class="`comp-border-${comp.type}`"
            @click="selectComponent(props.selectedNode.token, props.selectedNode.character, comp)"
          >
            <div class="rd-symbol">
              {{ comp.symbol }}
            </div>
            <div class="rd-info">
              <span class="rd-type">{{ getComponentTypeBadge(comp.type) }}</span>
              <span v-if="hasDistinctComponentName(comp)" class="rd-name">{{ comp.name }}</span>
              <span class="rd-meaning">{{ comp.meaning || comp.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CASE 4: Radical / Component Selected -->
    <div v-else-if="props.selectedNode.kind === 'component'" class="inspector-body">
      <div class="hero-box comp-hero">
        <span class="type-kicker">{{ getComponentTypeBadge(props.selectedNode.component.type) }}</span>
        <div class="hero-hanzi">
          {{ props.selectedNode.component.symbol }}
        </div>
        <div v-if="hasDistinctComponentName(props.selectedNode.component)" class="hero-pinyin">
          {{ props.selectedNode.component.name }}
        </div>
        <div class="hero-meaning">
          {{ props.selectedNode.component.meaning || props.selectedNode.component.name }}
        </div>
      </div>

      <div class="grammar-note-box">
        <div class="note-heading">
          <Icon icon="mdi:layers-triple-outline" />
          <span>Входит в иероглиф «{{ props.selectedNode.character.char }}» ({{ props.selectedNode.character.pinyin }})</span>
        </div>
        <p>{{ props.selectedNode.character.etymology }}</p>
      </div>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.inspector-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 22px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);

  @include media-down(sm) {
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    gap: 10px;
  }
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-secondary-color);
  flex-wrap: wrap;

  @include media-down(sm) {
    padding-bottom: 6px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-icon {
    font-size: 1.25rem;
    color: var(--fg-accent-color);
  }

  .header-title {
    margin: 0;
    font-size: 1.02rem;
    font-weight: 800;
    color: var(--fg-primary-color);

    @include media-down(sm) {
      font-size: 0.94rem;
    }
  }
}

.inspector-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;

  .crumb-btn {
    padding: 3px 9px;
    border-radius: 8px;
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-primary-color);
    color: var(--fg-accent-color);
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;

    &:hover {
      border-color: var(--fg-accent-color);
    }
  }

  .crumb-sep {
    font-size: 0.9rem;
    color: var(--fg-tertiary-color);
  }
}

.inspector-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 36px 16px;
  text-align: center;
  color: var(--fg-secondary-color);

  .empty-icon {
    font-size: 2.4rem;
    opacity: 0.5;
    color: var(--fg-accent-color);
  }

  p {
    margin: 0;
    font-size: 0.88rem;
  }
}

.inspector-body {
  display: flex;
  flex-direction: column;
  gap: 14px;

  @include media-down(sm) {
    gap: 10px;
  }
}

.hero-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-left: 4px solid var(--fg-accent-color);

  @include media-down(sm) {
    padding: 11px 12px;
    gap: 10px;
    border-radius: 13px;
    background: var(--bg-secondary-color);
  }

  &.clause-hero,
  &.comp-hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .type-kicker {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-accent-color);
  }

  .clause-hero-title {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .clause-hero-hanzi {
    font-size: 1.45rem;
    font-weight: 800;
    color: var(--fg-accent-color);
  }

  .clause-hero-trans {
    font-size: 0.88rem;
    color: var(--fg-secondary-color);
  }
}

.hero-main-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hero-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  .pos-pill {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
  }

  .hsk-pill {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    background: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
  }
}

.hero-pinyin {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
}

.hero-hanzi {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--fg-primary-color);
  line-height: 1.15;

  @include media-down(sm) {
    font-size: 1.65rem;
  }
}

.hero-meaning {
  font-size: 0.96rem;
  font-weight: 700;
  color: var(--fg-primary-color);

  @include media-down(sm) {
    font-size: 0.88rem;
  }
}

.hero-actions-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.hero-btn-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inspector-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }
}

.mini-stroke-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);

  .hanzi-writer-slot {
    width: 96px;
    height: 96px;
    border-radius: 8px;
    background:
      linear-gradient(to right, transparent 49%, rgba(150, 150, 150, 0.18) 50%, transparent 51%),
      linear-gradient(to bottom, transparent 49%, rgba(150, 150, 150, 0.18) 50%, transparent 51%),
      var(--bg-primary-color);
  }

  .stroke-play-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 7px;
    border: none;
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;

    &:hover {
      background: var(--fg-accent-color);
      color: #ffffff;
    }
  }
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @include media-down(sm) {
    gap: 8px;
  }
}

.info-block,
.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 8px 10px;
    border-radius: 11px;
    background: var(--bg-secondary-color);
  }

  .info-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--fg-tertiary-color);
  }

  .info-value {
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--fg-primary-color);

    &.accent-val {
      color: var(--fg-accent-color);
    }
  }
}

.grammar-note-box,
.sandhi-note-box,
.etymology-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 13px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 9px 11px;
    border-radius: 11px;
    background: var(--bg-secondary-color);
  }

  .note-heading {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
    font-weight: 700;
    color: var(--fg-accent-color);
  }

  p {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--fg-primary-color);
  }
}

.etymology-box {
  background: rgba(245, 158, 11, 0.07);
  border-color: rgba(245, 158, 11, 0.25);

  .note-heading {
    color: #d97706;
  }
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .sub-title {
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-secondary-color);
  }
}

.char-drill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.char-drill-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 13px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.18s ease;

  @include media-down(sm) {
    padding: 8px 10px;
    gap: 10px;
    border-radius: 11px;
    background: var(--bg-secondary-color);
  }

  &:hover {
    border-color: var(--fg-accent-color);
  }

  .cd-seal {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 11px;
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-primary-color);
    font-size: 1.45rem;
    font-weight: 800;
    color: var(--fg-primary-color);
    flex-shrink: 0;
  }

  .cd-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cd-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cd-pinyin {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--fg-accent-color);
  }

  .cd-tone {
    font-size: 0.7rem;
    color: var(--fg-tertiary-color);
  }

  .cd-meaning {
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .cd-role {
    font-size: 0.78rem;
    color: var(--fg-secondary-color);
    line-height: 1.35;
  }

  .cd-arrow {
    color: var(--fg-tertiary-color);
    font-size: 1.1rem;
  }
}

.collocations-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.collocation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 7px 10px;
    background: var(--bg-secondary-color);
  }

  .col-main {
    display: flex;
    align-items: baseline;
    gap: 7px;
    flex-wrap: wrap;
    font-size: 0.84rem;
  }

  .col-hanzi {
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .col-pinyin {
    color: var(--fg-accent-color);
    font-size: 0.78rem;
  }

  .col-trans {
    color: var(--fg-secondary-color);
  }

  .col-speak-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: none;
    background: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;

    &:hover {
      color: var(--fg-accent-color);
    }
  }
}

.radicals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.radical-detail-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-left: 3px solid var(--fg-accent-color);
  cursor: pointer;

  @include media-down(sm) {
    padding: 8px 10px;
    background: var(--bg-secondary-color);
  }

  &:hover {
    border-color: var(--fg-accent-color);
  }

  &.comp-border-semantic {
    border-left-color: #10b981;
  }

  &.comp-border-phonetic {
    border-left-color: #a855f7;
  }

  .rd-symbol {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .rd-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .rd-type {
    font-size: 0.64rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--fg-tertiary-color);
  }

  .rd-name {
    font-size: 0.76rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .rd-meaning {
    font-size: 0.74rem;
    color: var(--fg-secondary-color);
  }
}

.nested-chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.nested-word-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  border-radius: 11px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  font-family: inherit;
  cursor: pointer;

  &:hover {
    border-color: var(--fg-accent-color);
  }

  .nw-hanzi {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .nw-pinyin {
    font-size: 0.72rem;
    color: var(--fg-accent-color);
  }

  .nw-mean {
    font-size: 0.72rem;
    color: var(--fg-secondary-color);
  }
}
</style>
