<script setup lang="ts">
import type { Ref } from 'vue'
import type {
  CanvasSelectedNode,
  CanvasViewMode,
  MorphemeFeatureNode,
  MorphemeNode,
  RussianLexemeToken,
  RussianSentenceAnalysis,
  SyntacticClause,
} from '../../model'
import { Icon } from '@iconify/vue'
import { computed, inject, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInlineCanvasLock } from '~/01.shared/composables/use-inline-canvas-lock'
import { computeCanvasGraphLayout } from '../../../../shared/lib/canvas-layout'
import {
  getCaseClass,
  getMorphemeClass,
  getMorphemeShortSymbol,
  getPosClass,
} from '../../../../shared/lib/russian-utils'
import { useCanvasViewport } from '../../composables/use-canvas-viewport'

interface Props {
  analysis: RussianSentenceAnalysis
  selectedNode: CanvasSelectedNode | null
  expandedTokenIds: string[]
  areAllTokensExpanded: boolean
  showStressMarks: boolean
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
const { showGestureToggle, isTouchLocked, toggleGestureLock } = useInlineCanvasLock(viewportContainerEl, viewport.isFullscreen)

const dialogZIndex = inject<Ref<number> | null>('kit-dialog-z-index', null)
const inlineHeight = ref(0)

const fullscreenLabel = computed(() => t(viewport.isFullscreen.value
  ? 'plugins.russian-analyzer.exitFullscreen'
  : 'plugins.russian-analyzer.fullscreen'))
const graphLayout = computed(() => {
  return computeCanvasGraphLayout(props.analysis, props.expandedTokenIds, props.selectedNode)
})
const stageSizeStyle = computed(() => ({
  width: `${graphLayout.value.totalWidth}px`,
  height: `${graphLayout.value.totalHeight}px`,
  ...viewport.stageTransformStyle.value,
}))

watch([() => props.analysis.sentence.plainText, () => props.viewMode, viewport.isFullscreen], fitStageToContainer, { flush: 'post' })

function toggleFullscreen(): void {
  if (!viewport.isFullscreen.value) {
    inlineHeight.value = canvasShellEl.value?.offsetHeight ?? 0
  }

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
function getMorphemeTypeLabel(type: MorphemeNode['type']): string {
  switch (type) {
    case 'prefix':
      return t('plugins.russian-analyzer.morphemePrefix')
    case 'root':
      return t('plugins.russian-analyzer.morphemeRoot')
    case 'suffix':
      return t('plugins.russian-analyzer.morphemeSuffix')
    case 'ending':
      return t('plugins.russian-analyzer.morphemeEnding')
    case 'postfix':
      return t('plugins.russian-analyzer.morphemePostfix')
    default:
      return t('plugins.russian-analyzer.morphemeRoot')
  }
}
function getFeatureTypeLabel(type: MorphemeFeatureNode['type']): string {
  if (type === 'cognate') {
    return t('plugins.russian-analyzer.featureCognate')
  }

  if (type === 'meaning') {
    return t('plugins.russian-analyzer.featureMeaning')
  }

  return t('plugins.russian-analyzer.featureGrammar')
}
function getFeatureText(feature: MorphemeFeatureNode): string {
  return feature.explanation.trim() || feature.label.trim()
}
function getTokenBadgeText(token: RussianLexemeToken): string {
  if (token.morphology.caseLabel) {
    return token.morphology.caseLabel
  }

  if (token.morphology.aspect) {
    return token.morphology.aspect
  }

  return token.syntacticRole || token.posLabel
}
function onSelectClause(clause: SyntacticClause): void {
  emit('selectNode', { kind: 'clause', clause })
}
function onSelectToken(token: RussianLexemeToken): void {
  emit('selectNode', { kind: 'token', token })
}
function onSelectMorpheme(token: RussianLexemeToken, morpheme: MorphemeNode, morphemeIndex: number): void {
  emit('selectNode', { kind: 'morpheme', token, morpheme, morphemeIndex })
}
function onSelectFeature(token: RussianLexemeToken, morpheme: MorphemeNode, feature: MorphemeFeatureNode): void {
  emit('selectNode', { kind: 'feature', token, morpheme, feature })
}
function getClauseTokens(clause: SyntacticClause): RussianLexemeToken[] {
  return props.analysis.tokens.filter(tok => clause.tokenIds.includes(tok.id))
}

onMounted(() => {
  fitStageToContainer()
})
</script>

<template>
  <div v-if="viewport.isFullscreen.value" :style="{ height: `${inlineHeight}px` }" aria-hidden="true" />
  <Teleport to="body" :disabled="!viewport.isFullscreen.value">
    <section
      ref="canvasShellRef"
      class="canvas-shell"
      :aria-label="t('plugins.russian-analyzer.canvasTitle')"
      :class="{ 'is-fullscreen': viewport.isFullscreen.value }"
      :style="{ zIndex: dialogZIndex && viewport.isFullscreen.value ? dialogZIndex + 1 : undefined }"
    >
      <!-- Canvas Header & Controls Toolbar -->
      <header class="canvas-toolbar">
        <div class="toolbar-title-area">
          <div class="title-row">
            <Icon icon="mdi:vector-curve" class="canvas-title-icon" />
            <h2 class="canvas-title">
              {{ t('plugins.russian-analyzer.canvasTitle') }}
            </h2>
          </div>
          <p class="canvas-subtitle">
            {{ t('plugins.russian-analyzer.canvasSubtitle') }}
          </p>
        </div>

        <div class="toolbar-controls">
          <!-- View Mode Switcher -->
          <div class="mode-segmented">
            <button
              type="button"
              class="segment-btn"
              :class="{ active: props.viewMode === 'hierarchy' }"
              :aria-pressed="props.viewMode === 'hierarchy'"
              :aria-label="t('plugins.russian-analyzer.viewHierarchy')"
              :title="t('plugins.russian-analyzer.viewHierarchy')"
              @click="emit('update:viewMode', 'hierarchy')"
            >
              <Icon icon="mdi:sitemap-outline" />
              <span class="mode-label">{{ t('plugins.russian-analyzer.viewHierarchy') }}</span>
              <span class="mode-label-short" aria-hidden="true">{{ t('plugins.russian-analyzer.viewHierarchyShort') }}</span>
            </button>
            <button
              type="button"
              class="segment-btn"
              :class="{ active: props.viewMode === 'linear' }"
              :aria-pressed="props.viewMode === 'linear'"
              :aria-label="t('plugins.russian-analyzer.viewLinear')"
              :title="t('plugins.russian-analyzer.viewLinear')"
              @click="emit('update:viewMode', 'linear')"
            >
              <Icon icon="mdi:layers-triple-outline" />
              <span class="mode-label">{{ t('plugins.russian-analyzer.viewLinear') }}</span>
              <span class="mode-label-short" aria-hidden="true">{{ t('plugins.russian-analyzer.viewLinearShort') }}</span>
            </button>
          </div>

          <!-- Expand / Collapse All Layers -->
          <button
            type="button"
            class="toolbar-btn layers-toggle"
            :aria-label="props.areAllTokensExpanded ? t('plugins.russian-analyzer.collapseMorphemes') : t('plugins.russian-analyzer.expandAllMorphemes')"
            :title="props.areAllTokensExpanded ? t('plugins.russian-analyzer.collapseMorphemes') : t('plugins.russian-analyzer.expandAllMorphemes')"
            @click="emit('toggleExpandAll')"
          >
            <Icon :icon="props.areAllTokensExpanded ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'" />
            <span>
              {{ props.areAllTokensExpanded ? t('plugins.russian-analyzer.collapseMorphemes') : t('plugins.russian-analyzer.expandAllMorphemes') }}
            </span>
          </button>

          <!-- Zoom & Fit Controls (Hierarchy Mode) -->
          <div v-if="props.viewMode === 'hierarchy'" class="zoom-group">
            <button
              type="button"
              class="zoom-btn"
              :title="t('plugins.russian-analyzer.zoomOut')"
              :aria-label="t('plugins.russian-analyzer.zoomOut')"
              @click="viewport.zoomOut"
            >
              <Icon icon="mdi:minus" />
            </button>
            <span class="zoom-readout">{{ viewport.zoomPercentage.value }}</span>
            <button
              type="button"
              class="zoom-btn"
              :title="t('plugins.russian-analyzer.zoomIn')"
              :aria-label="t('plugins.russian-analyzer.zoomIn')"
              @click="viewport.zoomIn"
            >
              <Icon icon="mdi:plus" />
            </button>
            <button
              type="button"
              class="zoom-btn fit-btn"
              :title="t('plugins.russian-analyzer.resetViewport')"
              :aria-label="`${t('plugins.russian-analyzer.resetViewport')} (${viewport.zoomPercentage.value})`"
              @click="fitStageToContainer"
            >
              <Icon icon="mdi:fit-to-screen-outline" />
              <span class="compact-zoom-readout" aria-hidden="true">{{ viewport.zoomPercentage.value }}</span>
            </button>
          </div>

          <button
            type="button"
            class="toolbar-btn icon-only fullscreen-toggle"
            :title="fullscreenLabel"
            :aria-label="fullscreenLabel"
            @click="toggleFullscreen"
          >
            <Icon :icon="viewport.isFullscreen.value ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
          </button>
        </div>
      </header>

      <!-- Layer & Morpheme Legend Strip -->
      <div class="canvas-legend-strip">
        <div class="legend-layers">
          <span class="layer-pill pill-clause">
            <span class="dot" />
            {{ t('plugins.russian-analyzer.layerClauses') }}
          </span>
          <Icon icon="mdi:chevron-right" class="legend-arrow" />
          <span class="layer-pill pill-word">
            <span class="dot" />
            {{ t('plugins.russian-analyzer.layerWords') }}
          </span>
          <Icon icon="mdi:chevron-right" class="legend-arrow" />
          <span class="layer-pill pill-morph">
            <span class="dot" />
            {{ t('plugins.russian-analyzer.layerMorphemes') }}
          </span>
          <Icon icon="mdi:chevron-right" class="legend-arrow" />
          <span class="layer-pill pill-feat">
            <span class="dot" />
            {{ t('plugins.russian-analyzer.layerFeatures') }}
          </span>
        </div>

        <div class="legend-morphemes">
          <span class="morph-chip morph-prefix">¬ {{ t('plugins.russian-analyzer.morphemePrefix') }}</span>
          <span class="morph-chip morph-root">⌒ {{ t('plugins.russian-analyzer.morphemeRoot') }}</span>
          <span class="morph-chip morph-suffix">∧ {{ t('plugins.russian-analyzer.morphemeSuffix') }}</span>
          <span class="morph-chip morph-ending">□ {{ t('plugins.russian-analyzer.morphemeEnding') }}</span>
          <span class="morph-chip morph-postfix">⌙ {{ t('plugins.russian-analyzer.morphemePostfix') }}</span>
        </div>
      </div>

      <!-- MODE 1: Interactive Pannable & Zoomable Multi-Layer Node Canvas -->
      <div
        v-if="props.viewMode === 'hierarchy'"
        ref="viewportContainerRef"
        class="canvas-viewport"
        :class="{ 'is-panning': viewport.isPanning.value, 'is-touch-locked': isTouchLocked }"
        @pointerdown="!isTouchLocked && viewport.onPointerDown($event)"
        @pointermove="viewport.onPointerMove"
        @pointerup="viewport.onPointerUp"
        @pointercancel="viewport.onPointerUp"
        @pointerleave="viewport.onPointerUp"
        @wheel="!isTouchLocked && viewport.onWheel($event)"
      >
        <button
          v-if="showGestureToggle"
          type="button"
          class="canvas-gesture-toggle"
          :class="{ 'is-locked': isTouchLocked }"
          :aria-label="isTouchLocked ? t('plugins.russian-analyzer.unlockCanvas') : t('plugins.russian-analyzer.lockCanvas')"
          @pointerdown.stop
          @click="toggleGestureLock"
        >
          <span class="canvas-gesture-hint">
            <Icon :icon="isTouchLocked ? 'mdi:gesture-tap' : 'mdi:lock-open-variant-outline'" aria-hidden="true" />
            <span v-if="isTouchLocked">{{ t('plugins.russian-analyzer.unlockCanvas') }}</span>
          </span>
        </button>

        <div
          class="canvas-stage"
          :style="stageSizeStyle"
          :inert="isTouchLocked"
        >
          <!-- SVG Bezier Connections & Syntactic Dependency Arcs -->
          <svg
            class="canvas-connections-svg"
            :width="graphLayout.totalWidth"
            :height="graphLayout.totalHeight"
          >
            <!-- Sentence Boundary Dividers -->
            <g class="sentence-dividers-group">
              <line
                v-for="divider in graphLayout.sentenceDividers"
                :key="divider.id"
                :x1="divider.x"
                y1="24"
                :x2="divider.x"
                :y2="graphLayout.totalHeight - 24"
                class="sentence-divider-line"
              />
            </g>

            <!-- Syntactic Dependency & Case Government Arcs -->
            <g class="dependency-arcs-group">
              <path
                v-for="arc in graphLayout.dependencyCurves"
                :key="arc.id"
                :d="arc.path"
                class="dependency-arc-path"
                :class="{ 'is-active': arc.isActive }"
              />
            </g>

            <!-- Hierarchical Edges (Clause -> Word -> Morpheme -> Feature) -->
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
              <span class="clause-text">{{ cNode.clause.text }}</span>
              <span class="clause-translation">«{{ cNode.clause.translation }}»</span>
            </div>
          </div>

          <!-- TIER 2: Russian Word Form / Lexeme Nodes -->
          <div
            v-for="tNode in graphLayout.tokens"
            :key="tNode.id"
            data-canvas-interactive="true"
            class="canvas-node token-node"
            :class="[
              getPosClass(tNode.token.pos),
              getCaseClass(tNode.token.morphology.caseCode),
              { 'is-active': tNode.isActive },
            ]"
            :style="getNodeBoxStyle(tNode.x, tNode.y, tNode.width, tNode.height)"
            @click="onSelectToken(tNode.token)"
          >
            <div class="token-top-meta">
              <span class="token-pos-tag">{{ tNode.token.posLabel }}</span>
              <span class="token-cefr-tag">{{ tNode.token.cefr }}</span>
            </div>

            <div class="token-main-word">
              <span class="token-word russian-phonetic-text">
                {{ props.showStressMarks ? tNode.token.stressedWord : tNode.token.word }}
              </span>
              <span v-if="tNode.token.lemma && tNode.token.lemma.toLowerCase() !== tNode.token.word.toLowerCase()" class="token-lemma russian-phonetic-text">
                ← {{ tNode.token.lemma }}
              </span>
            </div>

            <div class="token-meaning-line">
              {{ tNode.token.meaning }}
            </div>

            <div class="token-bottom-bar">
              <span class="token-case-chip">{{ getTokenBadgeText(tNode.token) }}</span>

              <button
                type="button"
                data-canvas-interactive="true"
                class="token-expand-btn"
                :class="{ expanded: tNode.isExpanded }"
                @click.stop="emit('toggleTokenExpand', tNode.token.id)"
              >
                <span>{{ tNode.token.morphemes.length }}</span>
                <Icon :icon="tNode.isExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
              </button>
            </div>
          </div>

          <!-- TIER 3: Russian Morpheme Nodes -->
          <div
            v-for="mNode in graphLayout.morphemes"
            :key="mNode.id"
            data-canvas-interactive="true"
            class="canvas-node morpheme-node"
            :class="[getMorphemeClass(mNode.morpheme.type), { 'is-active': mNode.isActive }]"
            :style="getNodeBoxStyle(mNode.x, mNode.y, mNode.width, mNode.height)"
            @click="onSelectMorpheme(mNode.token, mNode.morpheme, mNode.morphemeIndex)"
          >
            <div class="morph-top-row">
              <span class="morph-symbol-glyph">{{ getMorphemeShortSymbol(mNode.morpheme.type) }}</span>
              <span class="morph-type-label">{{ getMorphemeTypeLabel(mNode.morpheme.type) }}</span>
            </div>

            <div class="morph-text-pill">
              {{ mNode.morpheme.text }}
            </div>

            <div class="morph-meaning-text" :title="mNode.morpheme.meaning">
              {{ mNode.morpheme.meaning }}
            </div>
          </div>

          <!-- TIER 4: Grammatical Feature & Cognate Micro-Nodes -->
          <div
            v-for="fNode in graphLayout.features"
            :key="fNode.id"
            data-canvas-interactive="true"
            class="canvas-node feature-node"
            :class="[`feat-type-${fNode.feature.type}`, { 'is-active': fNode.isActive }]"
            :style="getNodeBoxStyle(fNode.x, fNode.y, fNode.width, fNode.height)"
            @click="onSelectFeature(fNode.token, fNode.morpheme, fNode.feature)"
          >
            <span class="feat-role-badge">
              {{ getFeatureTypeLabel(fNode.feature.type) }}
            </span>
            <span class="feat-symbol">{{ fNode.feature.symbol }}</span>
            <span class="feat-meaning" :title="getFeatureText(fNode.feature)">
              {{ getFeatureText(fNode.feature) }}
            </span>
          </div>
        </div>
      </div>

      <!-- MODE 2: Linear Syntactic & Morphemic Flow -->
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
              <span class="clause-text">{{ clause.text }}</span>
              <span class="clause-trans">— {{ clause.translation }}</span>
            </div>
          </div>

          <div class="linear-tokens-grid">
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
                  <span class="lw-role">{{ getTokenBadgeText(token) }}</span>
                </div>
                <div class="lw-center">
                  <span class="lw-word russian-phonetic-text">{{ props.showStressMarks ? token.stressedWord : token.word }}</span>
                  <span v-if="token.lemma && token.lemma.toLowerCase() !== token.word.toLowerCase()" class="lw-lemma">
                    ← {{ token.lemma }}
                  </span>
                  <span class="lw-meaning">{{ token.meaning }}</span>
                </div>
              </div>

              <!-- Nested Morphemes & Features Tree -->
              <div
                v-if="props.expandedTokenIds.includes(token.id)"
                class="linear-morphs-tree"
              >
                <div
                  v-for="(morph, mIdx) in token.morphemes"
                  :key="`${token.id}_${morph.text}_${mIdx}`"
                  class="linear-morph-branch"
                >
                  <div
                    class="linear-morph-card"
                    :class="getMorphemeClass(morph.type)"
                    @click="onSelectMorpheme(token, morph, mIdx)"
                  >
                    <span class="lm-text">{{ morph.text }}</span>
                    <div class="lm-info">
                      <span class="lm-type">{{ getMorphemeTypeLabel(morph.type) }}</span>
                      <span class="lm-meaning">{{ morph.meaning }}</span>
                    </div>
                  </div>

                  <div v-if="morph.features.length > 0" class="linear-features-row">
                    <button
                      v-for="(feat, fIdx) in morph.features"
                      :key="`${feat.symbol}_${fIdx}`"
                      type="button"
                      class="linear-feat-pill"
                      :class="`feat-type-${feat.type}`"
                      @click="onSelectFeature(token, morph, feat)"
                    >
                      <span class="lf-sym">{{ feat.symbol }}</span>
                      <span class="lf-mean">{{ getFeatureText(feat) }}</span>
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
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;
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
  padding: 3px;
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
  padding: 6px 12px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;

  &.active {
    background: var(--fg-accent-color);
    color: #ffffff;
  }

  @include media-down(sm) {
    padding: 4px 8px;
    font-size: 0.72rem;
    gap: 4px;
    border-radius: 7px;
  }
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
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
    width: 36px;
    padding: 0;
    justify-content: center;
    font-size: 1.05rem;
  }

  @include media-down(sm) {
    height: 30px;
    padding: 0 8px;
    font-size: 0.72rem;
    border-radius: 8px;

    &.icon-only {
      width: 30px;
    }
  }
}

.zoom-group {
  display: inline-flex;
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
    height: 30px;
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

  &.pill-morph .dot {
    background: #3b82f6;
  }

  &.pill-feat .dot {
    background: #10b981;
  }
}

.legend-morphemes {
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

.morph-chip {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;

  &.morph-prefix {
    background: rgba(245, 158, 11, 0.14);
    color: #f59e0b;
  }

  &.morph-root {
    background: rgba(59, 130, 246, 0.14);
    color: #3b82f6;
  }

  &.morph-suffix {
    background: rgba(16, 185, 129, 0.14);
    color: #10b981;
  }

  &.morph-ending {
    background: rgba(168, 85, 247, 0.14);
    color: #a855f7;
  }

  &.morph-postfix {
    background: rgba(6, 182, 212, 0.14);
    color: #06b6d4;
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

  .canvas-shell.is-fullscreen > & {
    flex: 1;
    height: auto;
  }

  @include media-down(sm) {
    height: 430px;
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

.sentence-divider-line {
  stroke: var(--border-primary-color);
  stroke-width: 2px;
  stroke-dasharray: 8 6;
  opacity: 0.7;
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

  &.edge-token-morph {
    stroke-dasharray: 5 3;
  }

  &.edge-morph-feat {
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
    transform: translateY(-2px);
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
    font-size: 0.68rem;
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

  .clause-text {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    white-space: nowrap;
  }

  .clause-translation {
    font-size: 0.74rem;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* Tier 2: Word Form Node */
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

  &.pos-verb,
  &.pos-participle {
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
    font-size: 0.64rem;
    font-weight: 700;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .token-cefr-tag {
    padding: 1px 5px;
    border-radius: 5px;
    font-size: 0.6rem;
    font-weight: 700;
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    flex-shrink: 0;
  }

  .token-main-word {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 3px 0;
  }

  .token-word {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--fg-primary-color);
    line-height: 1.2;
    text-align: center;
    word-break: break-word;
  }

  .token-lemma {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--fg-tertiary-color);
  }

  .token-meaning-line {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
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

  .token-case-chip {
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--fg-accent-color);
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

/* Tier 3: Russian Morpheme Node */
.morpheme-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 7px 9px;
  border-radius: 14px;
  background: var(--bg-secondary-color);
  border: 1.5px solid var(--border-primary-color);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);

  &.is-active {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.22);
  }

  &.morph-prefix {
    border-bottom: 3px solid #f59e0b;
  }

  &.morph-root {
    border-bottom: 3px solid #3b82f6;
  }

  &.morph-suffix {
    border-bottom: 3px solid #10b981;
  }

  &.morph-ending {
    border-bottom: 3px solid #a855f7;
  }

  &.morph-postfix {
    border-bottom: 3px solid #06b6d4;
  }

  .morph-top-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--fg-tertiary-color);
    text-transform: uppercase;
  }

  .morph-symbol-glyph {
    font-size: 0.8rem;
    color: var(--fg-accent-color);
  }

  .morph-text-pill {
    padding: 4px 10px;
    border-radius: 9px;
    background: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--fg-primary-color);
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .morph-meaning-text {
    width: 100%;
    font-size: 0.66rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* Tier 4: Feature / Cognate Micro-Node */
.feature-node {
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

  &.feat-type-grammar {
    border-left: 3px solid #a855f7;
  }

  &.feat-type-cognate {
    border-left: 3px solid #10b981;
  }

  &.feat-type-meaning {
    border-left: 3px solid #f59e0b;
  }

  .feat-role-badge {
    width: 100%;
    font-size: 0.56rem;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    color: var(--fg-tertiary-color);
  }

  .feat-symbol {
    font-size: 0.86rem;
    font-weight: 800;
    color: var(--fg-primary-color);
    text-align: center;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .feat-meaning {
    width: 100%;
    font-size: 0.62rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* Linear Flow View */
.linear-flow-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  background: var(--bg-primary-color);

  .canvas-shell.is-fullscreen > & {
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
    font-size: 0.74rem;
    font-weight: 700;
    background: rgba(245, 158, 11, 0.14);
    color: #f59e0b;
  }

  .clause-role {
    font-size: 0.78rem;
    color: var(--fg-secondary-color);
  }

  .clause-text {
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
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-start;

  @include media-down(sm) {
    gap: 8px;
  }
}

.linear-token-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 200px;
  max-width: 280px;

  @include media-down(sm) {
    flex: 1 1 145px;
    max-width: 100%;
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
    font-size: 0.68rem;
    color: var(--fg-tertiary-color);
  }

  .lw-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .lw-word {
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .lw-lemma {
    font-size: 0.72rem;
    color: var(--fg-tertiary-color);
  }

  .lw-meaning {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }
}

.linear-morphs-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 12px;
  border-left: 2px dashed var(--border-primary-color);
}

.linear-morph-branch {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.linear-morph-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 11px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-left: 3px solid var(--fg-accent-color);
  cursor: pointer;

  &.morph-prefix {
    border-left-color: #f59e0b;
  }

  &.morph-root {
    border-left-color: #3b82f6;
  }

  &.morph-suffix {
    border-left-color: #10b981;
  }

  &.morph-ending {
    border-left-color: #a855f7;
  }

  &.morph-postfix {
    border-left-color: #06b6d4;
  }

  .lm-text {
    font-size: 0.98rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .lm-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .lm-type {
    font-size: 0.64rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--fg-tertiary-color);
  }

  .lm-meaning {
    font-size: 0.76rem;
    color: var(--fg-primary-color);
  }
}

.linear-features-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 12px;
}

.linear-feat-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  font-family: inherit;
  font-size: 0.7rem;
  cursor: pointer;

  .lf-sym {
    font-weight: 800;
    color: var(--fg-accent-color);
  }

  .lf-mean {
    color: var(--fg-secondary-color);
  }
}
@include canvas-touch-lock;
@include compact-canvas-inline;
@include compact-canvas-fullscreen;
</style>
