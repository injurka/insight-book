<script setup lang="ts">
import type {
  CanvasSelectedNode,
  CanvasViewMode,
  CharacterNode,
  ChineseSentenceAnalysis,
  ComponentNode,
  LexemeToken,
  SyntacticClause,
} from '../../model'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { computeCanvasGraphLayout } from '../../../../shared/lib/canvas-layout'
import { getPosClass } from '../../../../shared/lib/tone-utils'
import { useCanvasViewport } from '../../composables/use-canvas-viewport'

interface Props {
  analysis: ChineseSentenceAnalysis
  selectedNode: CanvasSelectedNode | null
  expandedTokenIds: string[]
  areAllTokensExpanded: boolean
  viewMode: CanvasViewMode
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:viewMode': [mode: CanvasViewMode]
  'selectNode': [node: CanvasSelectedNode]
  'toggleTokenExpand': [tokenId: string]
  'toggleExpandAll': []
  'speak': [text: string]
}>()

const { t } = useI18n()
const viewport = useCanvasViewport()
const canvasShellEl = useTemplateRef<HTMLElement>('canvasShellRef')
const viewportContainerEl = useTemplateRef<HTMLDivElement>('viewportContainerRef')

const inlineHeight = ref(0)

const fullscreenLabel = computed(() => t(viewport.isFullscreen.value
  ? 'plugins.chinese-analyzer.exitFullscreen'
  : 'plugins.chinese-analyzer.fullscreen'))
const graphLayout = computed(() => {
  return computeCanvasGraphLayout(props.analysis, props.expandedTokenIds, props.selectedNode)
})
const stageSizeStyle = computed(() => ({
  width: `${graphLayout.value.totalWidth}px`,
  height: `${graphLayout.value.totalHeight}px`,
  ...viewport.stageTransformStyle.value,
}))

watch([() => props.analysis.sentence.hanzi, () => props.viewMode, viewport.isFullscreen], fitStageToContainer, { flush: 'post' })

function toggleFullscreen(): void {
  if (!viewport.isFullscreen.value)
    inlineHeight.value = canvasShellEl.value?.offsetHeight ?? 0

  viewport.toggleFullscreen()
}
function fitStageToContainer(): void {
  const container = viewportContainerEl.value

  if (!container) {
    viewport.resetViewport()

    return
  }

  const rect = container.getBoundingClientRect()

  if (rect.width <= 0) {
    viewport.resetViewport()

    return
  }

  const scaleX = (rect.width - 28) / graphLayout.value.totalWidth
  const targetScale = Math.min(1, Math.max(0.55, Number(scaleX.toFixed(2))))
  viewport.scale.value = targetScale
  viewport.panX.value = Math.max(0, Math.round((rect.width - graphLayout.value.totalWidth * targetScale) / 2))
  viewport.panY.value = 10
}
function getNodeBoxStyle(
  x: number,
  y: number,
  width: number,
  height: number,
): Record<string, string> {
  return {
    left: `${x - width / 2}px`,
    top: `${y - height / 2}px`,
    width: `${width}px`,
    minHeight: `${height}px`,
  }
}
function getDepLabelStyle(x: number, y: number): Record<string, string> {
  return {
    left: `${x}px`,
    top: `${y}px`,
  }
}
function getComponentTypeLabel(type: ComponentNode['type']): string {
  if (type === 'semantic') {
    return t('plugins.chinese-analyzer.componentSemantic')
  }

  if (type === 'phonetic') {
    return t('plugins.chinese-analyzer.componentPhonetic')
  }

  return t('plugins.chinese-analyzer.componentRadical')
}
function onSelectClause(clause: SyntacticClause): void {
  emit('selectNode', { kind: 'clause', clause })
}
function onSelectToken(token: LexemeToken): void {
  emit('selectNode', { kind: 'token', token })
}
function onSelectCharacter(token: LexemeToken, character: CharacterNode, charIndex: number): void {
  emit('selectNode', { kind: 'character', token, character, charIndex })
}
function onSelectComponent(token: LexemeToken, character: CharacterNode, component: ComponentNode): void {
  emit('selectNode', { kind: 'component', token, character, component })
}
function getClauseTokens(clause: SyntacticClause): LexemeToken[] {
  return props.analysis.tokens.filter(tok => clause.tokenIds.includes(tok.id))
}

onMounted(() => {
  fitStageToContainer()
})
</script>

<template>
  <div v-if="viewport.isFullscreen.value" :style="{ height: `${inlineHeight}px` }" aria-hidden="true" />
  <Teleport to="body" :disabled="!viewport.isFullscreen.value">
    <section ref="canvasShellRef" class="canvas-shell" :class="{ 'is-fullscreen': viewport.isFullscreen.value }">
      <!-- Canvas Header & Controls Toolbar -->
      <header class="canvas-toolbar">
        <div class="toolbar-title-area">
          <div class="title-row">
            <Icon icon="mdi:vector-curve" class="canvas-title-icon" />
            <h2 class="canvas-title">
              {{ t('plugins.chinese-analyzer.canvasTitle') }}
            </h2>
          </div>
          <p class="canvas-subtitle">
            {{ t('plugins.chinese-analyzer.canvasSubtitle') }}
          </p>
        </div>

        <div class="toolbar-controls">
          <!-- View Mode Switcher -->
          <div class="mode-segmented">
            <button
              type="button"
              class="segment-btn"
              :class="{ active: props.viewMode === 'hierarchy' }"
              @click="emit('update:viewMode', 'hierarchy')"
            >
              <Icon icon="mdi:sitemap-outline" />
              <span>{{ t('plugins.chinese-analyzer.viewHierarchy') }}</span>
            </button>
            <button
              type="button"
              class="segment-btn"
              :class="{ active: props.viewMode === 'linear' }"
              @click="emit('update:viewMode', 'linear')"
            >
              <Icon icon="mdi:layers-triple-outline" />
              <span>{{ t('plugins.chinese-analyzer.viewLinear') }}</span>
            </button>
          </div>

          <!-- Expand / Collapse All Layers -->
          <button
            type="button"
            class="toolbar-btn"
            @click="emit('toggleExpandAll')"
          >
            <Icon :icon="props.areAllTokensExpanded ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'" />
            <span>
              {{ props.areAllTokensExpanded ? t('plugins.chinese-analyzer.collapseChars') : t('plugins.chinese-analyzer.expandAllChars') }}
            </span>
          </button>

          <!-- Zoom & Fit Controls (Hierarchy Mode) -->
          <div v-if="props.viewMode === 'hierarchy'" class="zoom-group">
            <button
              type="button"
              class="zoom-btn"
              :title="t('plugins.chinese-analyzer.zoomOut')"
              @click="viewport.zoomOut"
            >
              <Icon icon="mdi:minus" />
            </button>
            <span class="zoom-readout">{{ viewport.zoomPercentage.value }}</span>
            <button
              type="button"
              class="zoom-btn"
              :title="t('plugins.chinese-analyzer.zoomIn')"
              @click="viewport.zoomIn"
            >
              <Icon icon="mdi:plus" />
            </button>
            <button
              type="button"
              class="zoom-btn"
              :title="t('plugins.chinese-analyzer.resetViewport')"
              @click="fitStageToContainer"
            >
              <Icon icon="mdi:fit-to-screen-outline" />
            </button>
          </div>

          <button
            type="button"
            class="toolbar-btn icon-only"
            :title="fullscreenLabel"
            :aria-label="fullscreenLabel"
            @click="toggleFullscreen"
          >
            <Icon :icon="viewport.isFullscreen.value ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
          </button>
        </div>
      </header>

      <!-- Layer Legend Strip -->
      <div class="canvas-legend-strip">
        <div class="legend-layers">
          <span class="layer-pill pill-clause">
            <span class="dot" />
            {{ t('plugins.chinese-analyzer.layerClauses') }}
          </span>
          <Icon icon="mdi:chevron-right" class="legend-arrow" />
          <span class="layer-pill pill-word">
            <span class="dot" />
            {{ t('plugins.chinese-analyzer.layerWords') }}
          </span>
          <Icon icon="mdi:chevron-right" class="legend-arrow" />
          <span class="layer-pill pill-char">
            <span class="dot" />
            {{ t('plugins.chinese-analyzer.layerCharacters') }}
          </span>
          <Icon icon="mdi:chevron-right" class="legend-arrow" />
          <span class="layer-pill pill-comp">
            <span class="dot" />
            {{ t('plugins.chinese-analyzer.layerComponents') }}
          </span>
        </div>

        <div class="legend-tones">
          <span class="tone-chip tone-1">1 ¯ (55)</span>
          <span class="tone-chip tone-2">2 ´ (35)</span>
          <span class="tone-chip tone-3">3 ˇ (214)</span>
          <span class="tone-chip tone-4">4 ` (51)</span>
          <span class="tone-chip tone-5">5 · (轻)</span>
        </div>
      </div>

      <!-- MODE 1: Interactive Pannable & Zoomable Multi-Layer Node Canvas -->
      <div
        v-if="props.viewMode === 'hierarchy'"
        ref="viewportContainerRef"
        class="canvas-viewport"
        :class="{ 'is-panning': viewport.isPanning.value }"
        @pointerdown="viewport.onPointerDown"
        @pointermove="viewport.onPointerMove"
        @pointerup="viewport.onPointerUp"
        @pointercancel="viewport.onPointerUp"
        @lostpointercapture="viewport.onPointerUp"
        @click.capture="viewport.onClickCapture"
        @wheel="viewport.onWheel"
      >
        <div class="canvas-stage" :style="stageSizeStyle">
          <!-- SVG Bezier Connections & Syntactic Dependency Arcs -->
          <svg
            class="canvas-connections-svg"
            :width="graphLayout.totalWidth"
            :height="graphLayout.totalHeight"
          >
            <!-- Syntactic Dependency Arcs between Lexemes -->
            <g class="dependency-arcs-group">
              <path
                v-for="arc in graphLayout.dependencyCurves"
                :key="arc.id"
                :d="arc.path"
                class="dependency-arc-path"
                :class="{ 'is-active': arc.isActive }"
              />
            </g>

            <!-- Hierarchical Edges (Clause -> Word -> Character -> Component) -->
            <g class="hierarchy-edges-group">
              <path
                v-for="edge in graphLayout.edges"
                :key="edge.id"
                :d="edge.path"
                class="hierarchy-edge-path"
                :class="[`edge-${edge.kind}`, { 'is-active': edge.isActive }]"
              />
            </g>
          </svg>

          <!-- Dependency Arc Relation Labels -->
          <div
            v-for="arc in graphLayout.dependencyCurves"
            :key="`lbl_${arc.id}`"
            class="dep-arc-label"
            :class="{ 'is-active': arc.isActive }"
            :style="getDepLabelStyle(arc.labelX, arc.labelY)"
          >
            {{ arc.label }}
          </div>

          <!-- TIER 1: Syntactic Clause Nodes -->
          <div
            v-for="cNode in graphLayout.clauses"
            :key="cNode.id"
            data-canvas-interactive="true"
            class="canvas-node clause-node"
            :class="{ 'is-active': cNode.isActive }"
            :style="getNodeBoxStyle(cNode.x, cNode.y, cNode.width, cNode.height)"
            @click="onSelectClause(cNode.clause)"
          >
            <div class="clause-role-badge">
              {{ cNode.clause.label }}
            </div>
            <div class="clause-content-row">
              <span class="clause-hanzi">{{ cNode.clause.hanzi }}</span>
              <span class="clause-translation">«{{ cNode.clause.translation }}»</span>
            </div>
          </div>

          <!-- TIER 2: Lexeme / Word Nodes -->
          <div
            v-for="tNode in graphLayout.tokens"
            :key="tNode.id"
            data-canvas-interactive="true"
            class="canvas-node token-node"
            :class="[
              getPosClass(tNode.token.pos),
              {
                'is-active': tNode.isActive,
                'is-multi-char': tNode.token.characters.length > 1,
              },
            ]"
            :style="getNodeBoxStyle(tNode.x, tNode.y, tNode.width, tNode.height)"
            @click="onSelectToken(tNode.token)"
          >
            <div class="token-top-meta">
              <span class="token-pos-tag">{{ tNode.token.posLabel }}</span>
              <span class="token-hsk-tag">{{ tNode.token.hsk }}</span>
            </div>

            <div class="token-main-word">
              <span class="token-pinyin">{{ tNode.token.pinyin }}</span>
              <span class="token-hanzi">
                {{ tNode.token.hanzi }}
              </span>
            </div>

            <div class="token-meaning-line">
              {{ tNode.token.meaning }}
            </div>

            <div class="token-bottom-bar">
              <span class="token-role-chip">{{ tNode.token.syntacticRole }}</span>

              <button
                type="button"
                data-canvas-interactive="true"
                class="token-expand-btn"
                :class="{ expanded: tNode.isExpanded }"
                @click.stop="emit('toggleTokenExpand', tNode.token.id)"
              >
                <span>{{ tNode.token.characters.length }}字</span>
                <Icon :icon="tNode.isExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
              </button>
            </div>
          </div>

          <!-- TIER 3: Individual Character Nodes -->
          <div
            v-for="chNode in graphLayout.characters"
            :key="chNode.id"
            data-canvas-interactive="true"
            class="canvas-node character-node"
            :class="[`tone-border-${chNode.character.tone}`, { 'is-active': chNode.isActive }]"
            :style="getNodeBoxStyle(chNode.x, chNode.y, chNode.width, chNode.height)"
            @click="onSelectCharacter(chNode.token, chNode.character, chNode.charIndex)"
          >
            <div class="char-top-row">
              <span class="char-pinyin" :class="`tone-text-${chNode.character.tone}`">
                {{ chNode.character.pinyin }}
              </span>
              <span class="char-tone-num">{{ chNode.character.tone }}т</span>
            </div>

            <div class="char-seal-box">
              {{ chNode.character.char }}
            </div>

            <div class="char-meaning-text">
              {{ chNode.character.meaning }}
            </div>
          </div>

          <!-- TIER 4: Radical & Phonetic Component Nodes -->
          <div
            v-for="compNode in graphLayout.components"
            :key="compNode.id"
            data-canvas-interactive="true"
            class="canvas-node component-node"
            :class="[`comp-type-${compNode.component.type}`, { 'is-active': compNode.isActive }]"
            :style="getNodeBoxStyle(compNode.x, compNode.y, compNode.width, compNode.height)"
            @click="onSelectComponent(compNode.token, compNode.character, compNode.component)"
          >
            <span class="comp-role-badge">
              {{ getComponentTypeLabel(compNode.component.type) }}
            </span>
            <div class="comp-main-row">
              <span class="comp-symbol">{{ compNode.component.symbol }}</span>
              <span class="comp-name">{{ compNode.component.name }}</span>
            </div>
            <span class="comp-meaning">{{ compNode.component.meaning }}</span>
          </div>
        </div>
      </div>

      <!-- MODE 2: Linear Syntactic & Decomposition Flow -->
      <div v-else class="linear-flow-container">
        <div
          v-for="clause in props.analysis.clauses"
          :key="clause.id"
          class="linear-clause-group"
        >
          <div
            class="linear-clause-header"
            @click="onSelectClause(clause)"
          >
            <div class="clause-header-left">
              <span class="clause-badge">{{ clause.label }}</span>
              <span class="clause-role">{{ clause.role }}</span>
            </div>
            <div class="clause-header-right">
              <span class="clause-hanzi">{{ clause.hanzi }}</span>
              <span class="clause-trans">— {{ clause.translation }}</span>
            </div>
          </div>

          <div
            class="linear-tokens-grid"
            role="group"
            :aria-label="clause.label"
            tabindex="0"
          >
            <div
              v-for="token in getClauseTokens(clause)"
              :key="token.id"
              class="linear-token-column"
            >
              <!-- Word Card -->
              <div
                class="linear-word-card"
                :class="getPosClass(token.pos)"
                @click="onSelectToken(token)"
              >
                <div class="lw-top">
                  <span class="lw-pos">{{ token.posLabel }}</span>
                  <span class="lw-role">{{ token.syntacticRole }}</span>
                </div>
                <div class="lw-center">
                  <span class="lw-pinyin">{{ token.pinyin }}</span>
                  <span class="lw-hanzi">{{ token.hanzi }}</span>
                  <span class="lw-meaning">{{ token.meaning }}</span>
                </div>
              </div>

              <!-- Nested Characters & Radicals Tree -->
              <div
                v-if="props.expandedTokenIds.includes(token.id)"
                class="linear-chars-tree"
              >
                <div
                  v-for="(ch, chIdx) in token.characters"
                  :key="`${token.id}_${ch.char}_${chIdx}`"
                  class="linear-char-branch"
                >
                  <div
                    class="linear-char-card"
                    @click="onSelectCharacter(token, ch, chIdx)"
                  >
                    <span class="lc-symbol" :class="`tone-text-${ch.tone}`">{{ ch.char }}</span>
                    <div class="lc-info">
                      <span class="lc-pinyin">{{ ch.pinyin }} ({{ ch.tone }}т)</span>
                      <span class="lc-meaning">{{ ch.meaning }}</span>
                    </div>
                  </div>

                  <div v-if="ch.components.length > 0" class="linear-radicals-row">
                    <button
                      v-for="(comp, cIdx) in ch.components"
                      :key="`${comp.symbol}_${cIdx}`"
                      type="button"
                      class="linear-radical-pill"
                      :class="`comp-type-${comp.type}`"
                      @click="onSelectComponent(token, ch, comp)"
                    >
                      <span class="lr-sym">{{ comp.symbol }}</span>
                      <span class="lr-mean">{{ comp.meaning }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </Teleport>
</template>

<style lang="scss" scoped>
.canvas-shell {
  --canvas-control-height: 36px;

  display: flex;
  flex-direction: column;
  border-radius: 22px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);

  &.is-fullscreen {
    position: fixed;
    inset: 0 0 auto;
    height: 100%;
    height: 100dvh;
    z-index: 1200;
    box-sizing: border-box;
    padding: var(--safe-area-top, env(safe-area-inset-top, 0px)) env(safe-area-inset-right, 0px)
      var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) env(safe-area-inset-left, 0px);
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  @include media-down(sm) {
    border-radius: 14px;
    box-shadow: none;
  }
}

.canvas-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-secondary-color);
  border-bottom: 1px solid var(--border-secondary-color);
  flex-wrap: wrap;

  @include media-down(sm) {
    padding: 10px 12px;
    gap: 8px;
  }
}

.toolbar-title-area {
  display: flex;
  flex-direction: column;
  gap: 2px;

  .title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .canvas-title-icon {
    font-size: 1.35rem;
    color: var(--fg-accent-color);

    @include media-down(sm) {
      font-size: 1.1rem;
    }
  }

  .canvas-title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--fg-primary-color);

    @include media-down(sm) {
      font-size: 0.96rem;
    }
  }

  .canvas-subtitle {
    margin: 0;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);

    @include media-down(sm) {
      display: none;
    }
  }
}

.toolbar-controls {
  min-width: 0;
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  @include media-down(sm) {
    gap: 6px;
  }
}

.mode-segmented {
  display: inline-flex;
  box-sizing: border-box;
  height: var(--canvas-control-height);
  max-width: 100%;
  min-width: 0;
  padding: 2px;
  border-radius: 12px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 2px;
    border-radius: 9px;
  }
}

.segment-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  line-height: 1.1;
  padding: 2px 12px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: start;
  transition: all 0.18s ease;

  &.active {
    background: var(--fg-accent-color);
    color: #ffffff;
  }

  @include media-down(sm) {
    padding: 0 7px;
    font-size: 0.72rem;
    gap: 4px;
    border-radius: 7px;
  }
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: var(--canvas-control-height);
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }

  &.icon-only {
    width: var(--canvas-control-height);
    padding: 0;
    justify-content: center;
    font-size: 1.05rem;
  }

  @include media-down(sm) {
    padding: 0 8px;
    font-size: 0.72rem;
    border-radius: 8px;
  }
}

.zoom-group {
  display: inline-flex;
  box-sizing: border-box;
  height: var(--canvas-control-height);
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 10px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  .zoom-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 100%;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--fg-primary-color);
    cursor: pointer;

    &:hover {
      background: var(--bg-tertiary-color);
      color: var(--fg-accent-color);
    }
  }

  .zoom-readout {
    min-width: 44px;
    text-align: center;
    font-size: 0.76rem;
    font-weight: 700;
    color: var(--fg-secondary-color);
  }
}

.canvas-legend-strip {
  flex-shrink: 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 20px;
  background: var(--bg-primary-color);
  border-bottom: 1px solid var(--border-secondary-color);
  flex-wrap: wrap;

  @include media-down(sm) {
    padding: 6px 10px;
    gap: 8px;
    flex-wrap: nowrap;
    overflow-x: auto;
  }
}

.legend-layers {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  @include media-down(sm) {
    flex-wrap: nowrap;
    flex-shrink: 0;
    gap: 4px;
  }

  .legend-arrow {
    color: var(--fg-tertiary-color);
    font-size: 0.95rem;
  }
}

.layer-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  white-space: nowrap;

  @include media-down(sm) {
    padding: 2px 7px;
    font-size: 0.66rem;
    gap: 4px;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  &.pill-clause .dot {
    background: #f59e0b;
  }

  &.pill-word .dot {
    background: var(--fg-accent-color);
  }

  &.pill-char .dot {
    background: #3b82f6;
  }

  &.pill-comp .dot {
    background: #10b981;
  }
}

.legend-tones {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  @include media-down(sm) {
    flex-wrap: nowrap;
    flex-shrink: 0;
    gap: 4px;
  }
}

.tone-chip {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;

  @include media-down(sm) {
    padding: 2px 6px;
    font-size: 0.65rem;
  }

  &.tone-1 {
    background: rgba(239, 68, 68, 0.14);
    color: #ef4444;
  }

  &.tone-2 {
    background: rgba(245, 158, 11, 0.14);
    color: #f59e0b;
  }

  &.tone-3 {
    background: rgba(16, 185, 129, 0.14);
    color: #10b981;
  }

  &.tone-4 {
    background: rgba(59, 130, 246, 0.14);
    color: #3b82f6;
  }

  &.tone-5 {
    background: rgba(148, 163, 184, 0.18);
    color: var(--fg-secondary-color);
  }
}

.canvas-viewport {
  position: relative;
  width: 100%;
  height: 690px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;
  background-color: var(--bg-primary-color);
  background-image: radial-gradient(var(--border-primary-color) 1px, transparent 1px);
  background-size: 22px 22px;

  &.is-panning {
    cursor: grabbing;
  }

  @include media-down(sm) {
    height: 430px;
  }

  .is-fullscreen & {
    flex: 1;
    min-height: 0;
    height: auto;
  }
}

.canvas-stage {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.canvas-connections-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 1;
}

.hierarchy-edge-path {
  fill: none;
  stroke: var(--border-primary-color);
  stroke-width: 2px;
  opacity: 0.65;
  transition:
    stroke 0.22s ease,
    stroke-width 0.22s ease,
    opacity 0.22s ease;

  &.edge-token-char {
    stroke-dasharray: 5 3;
  }

  &.edge-char-comp {
    stroke-width: 1.75px;
    stroke-dasharray: 3 3;
  }

  &.is-active {
    stroke: var(--fg-accent-color);
    stroke-width: 3px;
    stroke-dasharray: none;
    opacity: 1;
    filter: drop-shadow(0 0 6px rgba(var(--fg-accent-color-rgb), 0.45));
  }
}

.dependency-arc-path {
  fill: none;
  stroke: rgba(var(--fg-accent-color-rgb), 0.35);
  stroke-width: 1.6px;
  stroke-dasharray: 4 4;
  transition: all 0.22s ease;

  &.is-active {
    stroke: var(--fg-accent-color);
    stroke-width: 2.5px;
    stroke-dasharray: none;
  }
}

.dep-arc-label {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 2;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-tertiary-color);
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  transition: all 0.2s ease;

  &.is-active {
    background: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    color: #ffffff;
    font-weight: 700;
    z-index: 6;
  }
}

.canvas-node {
  position: absolute;
  z-index: 3;
  box-sizing: border-box;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;

  &:hover {
    z-index: 5;
  }
}

/* Tier 1: Clause Node */
.clause-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 14px;
  background: var(--bg-secondary-color);
  border: 1px dashed var(--border-primary-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);

  &.is-active {
    border-style: solid;
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.08);
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
  }

  .clause-role-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #f59e0b;
  }

  .clause-content-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    max-width: 100%;
    overflow: hidden;
  }

  .clause-hanzi {
    font-size: 0.96rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    white-space: nowrap;
  }

  .clause-translation {
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* Tier 2: Token Node */
.token-node {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 9px 11px;
  border-radius: 16px;
  background: var(--bg-secondary-color);
  border: 1.5px solid var(--border-primary-color);
  border-top: 4px solid var(--fg-accent-color);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.07);

  &.is-active {
    border-color: var(--fg-accent-color);
    box-shadow:
      0 0 0 3px rgba(var(--fg-accent-color-rgb), 0.22),
      0 10px 24px rgba(0, 0, 0, 0.12);
  }

  &.pos-noun {
    border-top-color: #3b82f6;
  }

  &.pos-verb {
    border-top-color: #ef4444;
  }

  &.pos-adj {
    border-top-color: #10b981;
  }

  &.pos-adv {
    border-top-color: #a855f7;
  }

  &.pos-prep {
    border-top-color: #f59e0b;
  }

  &.pos-pron {
    border-top-color: #06b6d4;
  }

  .token-top-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }

  .token-pos-tag {
    font-size: 0.66rem;
    font-weight: 700;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .token-hsk-tag {
    padding: 1px 5px;
    border-radius: 5px;
    font-size: 0.62rem;
    font-weight: 700;
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    flex-shrink: 0;
  }

  .token-main-word {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 2px 0;
  }

  .token-pinyin {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }

  .token-hanzi {
    font-size: 1.45rem;
    font-weight: 800;
    color: var(--fg-primary-color);
    line-height: 1.15;
  }

  .token-meaning-line {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .token-bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--border-secondary-color);
  }

  .token-role-chip {
    font-size: 0.62rem;
    color: var(--fg-tertiary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .token-expand-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 6px;
    border-radius: 6px;
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-primary-color);
    color: var(--fg-secondary-color);
    font-family: inherit;
    font-size: 0.62rem;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;

    &.expanded {
      color: var(--fg-accent-color);
      border-color: rgba(var(--fg-accent-color-rgb), 0.35);
    }
  }
}

/* Tier 3: Character Node */
.character-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 14px;
  background: var(--bg-secondary-color);
  border: 1.5px solid var(--border-primary-color);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);

  &.is-active {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.22);
  }

  &.tone-border-1 {
    border-bottom: 3px solid #ef4444;
  }

  &.tone-border-2 {
    border-bottom: 3px solid #f59e0b;
  }

  &.tone-border-3 {
    border-bottom: 3px solid #10b981;
  }

  &.tone-border-4 {
    border-bottom: 3px solid #3b82f6;
  }

  .char-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .char-tone-num {
    font-size: 0.62rem;
    color: var(--fg-tertiary-color);
  }

  .char-seal-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    font-size: 1.45rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .char-meaning-text {
    width: 100%;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* Tier 4: Component / Radical Node */
.component-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 12px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  &.is-active {
    border-color: #10b981;
    box-shadow: 0 0 0 2.5px rgba(16, 185, 129, 0.25);
  }

  &.comp-type-semantic {
    border-left: 3px solid #10b981;
  }

  &.comp-type-phonetic {
    border-left: 3px solid #a855f7;
  }

  &.comp-type-radical {
    border-left: 3px solid #f59e0b;
  }

  .comp-role-badge {
    font-size: 0.58rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--fg-tertiary-color);
  }

  .comp-main-row {
    display: flex;
    align-items: baseline;
    gap: 5px;
  }

  .comp-symbol {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .comp-name {
    font-size: 0.62rem;
    color: var(--fg-secondary-color);
    max-width: 52px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .comp-meaning {
    width: 100%;
    font-size: 0.62rem;
    color: var(--fg-secondary-color);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.tone-text-1 {
  color: #ef4444;
}

.tone-text-2 {
  color: #f59e0b;
}

.tone-text-3 {
  color: #10b981;
}

.tone-text-4 {
  color: #3b82f6;
}

/* Linear Flow View */
.linear-flow-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  background: var(--bg-primary-color);
  min-width: 0;
  overflow-wrap: anywhere;

  .is-fullscreen & {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  @include media-down(sm) {
    padding: 10px;
    gap: 10px;
  }
}

.linear-clause-group {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 10px;
    gap: 8px;
    border-radius: 12px;
  }
}

.linear-clause-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--bg-primary-color);
  border: 1px dashed var(--border-primary-color);
  cursor: pointer;
  flex-wrap: wrap;

  @include media-down(sm) {
    padding: 6px 9px;
    gap: 6px;
  }

  .clause-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .clause-badge {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    background: rgba(245, 158, 11, 0.14);
    color: #f59e0b;
  }

  .clause-role {
    font-size: 0.78rem;
    color: var(--fg-secondary-color);
  }

  .clause-hanzi {
    font-weight: 700;
    color: var(--fg-primary-color);
    margin-right: 6px;
  }

  .clause-trans {
    font-size: 0.84rem;
    color: var(--fg-secondary-color);
  }
}

.linear-tokens-grid {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 6px;
  scrollbar-width: thin;

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }

  @include media-down(sm) {
    gap: 8px;
  }
}

.linear-token-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 0 min(230px, 85%);
  min-width: 0;
  max-width: 280px;

  @include media-down(sm) {
    flex-basis: min(200px, 83%);
    gap: 6px;
  }
}

.linear-word-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 14px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-top: 3px solid var(--fg-accent-color);
  cursor: pointer;

  @include media-down(sm) {
    padding: 8px 10px;
    border-radius: 11px;
    gap: 4px;
  }

  .lw-top {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 0.7rem;
    color: var(--fg-tertiary-color);
  }

  .lw-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .lw-pinyin {
    font-size: 0.78rem;
    color: var(--fg-secondary-color);
  }

  .lw-hanzi {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .lw-meaning {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.linear-chars-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 12px;
  border-left: 2px dashed var(--border-primary-color);
}

.linear-char-branch {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.linear-char-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 11px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;

  .lc-symbol {
    font-size: 1.35rem;
    font-weight: 800;
  }

  .lc-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .lc-pinyin {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }

  .lc-meaning {
    font-size: 0.76rem;
    color: var(--fg-primary-color);
  }
}

.linear-radicals-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 12px;
}

.linear-radical-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  font-family: inherit;
  font-size: 0.72rem;
  cursor: pointer;

  .lr-sym {
    font-weight: 800;
    color: var(--fg-accent-color);
  }

  .lr-mean {
    color: var(--fg-secondary-color);
  }
}
</style>
