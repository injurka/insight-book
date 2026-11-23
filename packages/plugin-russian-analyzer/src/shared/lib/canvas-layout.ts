import type {
  CanvasSelectedNode,
  MorphemeFeatureNode,
  MorphemeNode,
  RussianLexemeToken,
  RussianSentenceAnalysis,
  SyntacticClause,
} from '../../modules/russian-analyzer/model'
import { groupTokensBySentence } from './sentence-segmentation'

export interface PositionedClauseNode {
  id: string
  clause: SyntacticClause
  x: number
  y: number
  width: number
  height: number
  isActive: boolean
}

export interface PositionedTokenNode {
  id: string
  token: RussianLexemeToken
  x: number
  y: number
  width: number
  height: number
  isExpanded: boolean
  isActive: boolean
}

export interface PositionedMorphemeNode {
  id: string
  token: RussianLexemeToken
  morpheme: MorphemeNode
  morphemeIndex: number
  x: number
  y: number
  width: number
  height: number
  isActive: boolean
}

export interface PositionedFeatureNode {
  id: string
  token: RussianLexemeToken
  morpheme: MorphemeNode
  feature: MorphemeFeatureNode
  morphemeIndex: number
  featureIndex: number
  x: number
  y: number
  width: number
  height: number
  isActive: boolean
}

export interface CanvasConnectionEdge {
  id: string
  path: string
  kind: 'clause-token' | 'token-morph' | 'morph-feat'
  isActive: boolean
}

export interface CanvasDependencyCurve {
  id: string
  path: string
  label: string
  labelX: number
  labelY: number
  isActive: boolean
}

export interface CanvasSentenceDivider {
  id: string
  x: number
}

export interface CanvasGraphLayout {
  totalWidth: number
  totalHeight: number
  clauses: PositionedClauseNode[]
  tokens: PositionedTokenNode[]
  morphemes: PositionedMorphemeNode[]
  features: PositionedFeatureNode[]
  edges: CanvasConnectionEdge[]
  dependencyCurves: CanvasDependencyCurve[]
  sentenceDividers: CanvasSentenceDivider[]
}

const CLAUSE_Y = 64
const CLAUSE_HEIGHT = 68
const TOKEN_Y = 250
const TOKEN_WIDTH = 174
const TOKEN_HEIGHT = 120
const MORPH_Y = 454
const MORPH_WIDTH = 122
const MORPH_HEIGHT = 98
const FEAT_Y = 626
const FEAT_WIDTH = 112
const FEAT_HEIGHT = 76
const PADDING_X = 64

function buildVerticalBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const midY = (y1 + y2) / 2

  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

function getSelectedTokenId(selected: CanvasSelectedNode | null): string | null {
  if (!selected) {
    return null
  }

  if (selected.kind === 'token' || selected.kind === 'morpheme' || selected.kind === 'feature') {
    return selected.token.id
  }

  return null
}

function isTokenInSelectedBranch(tokenId: string, selected: CanvasSelectedNode | null): boolean {
  if (!selected) {
    return false
  }

  if (selected.kind === 'clause') {
    return selected.clause.tokenIds.includes(tokenId)
  }

  return getSelectedTokenId(selected) === tokenId
}

function isMorphemeInSelectedBranch(tokenId: string, morphemeText: string, selected: CanvasSelectedNode | null): boolean {
  if (!selected) {
    return false
  }

  if (selected.kind === 'token') {
    return selected.token.id === tokenId
  }

  if (selected.kind === 'morpheme' || selected.kind === 'feature') {
    return selected.token.id === tokenId && selected.morpheme.text === morphemeText
  }

  return false
}

function isFeatureInSelectedBranch(
  tokenId: string,
  morphemeText: string,
  featureSymbol: string,
  selected: CanvasSelectedNode | null,
): boolean {
  if (!selected) {
    return false
  }

  if (selected.kind === 'morpheme') {
    return selected.token.id === tokenId && selected.morpheme.text === morphemeText
  }

  if (selected.kind === 'feature') {
    return (
      selected.token.id === tokenId
      && selected.morpheme.text === morphemeText
      && selected.feature.symbol === featureSymbol
    )
  }

  return false
}

function getMorphemeSubtreeWidth(morpheme: MorphemeNode): number {
  const count = Math.max(1, morpheme.features.length)

  return Math.max(MORPH_WIDTH + 14, count * (FEAT_WIDTH + 12))
}

function getTokenSubtreeWidth(token: RussianLexemeToken, isExpanded: boolean): number {
  if (!isExpanded || token.morphemes.length === 0) {
    return TOKEN_WIDTH + 20
  }

  const morphsWidth = token.morphemes.reduce((acc, m) => acc + getMorphemeSubtreeWidth(m), 0)
  const gaps = Math.max(0, token.morphemes.length - 1) * 14

  return Math.max(TOKEN_WIDTH + 24, morphsWidth + gaps)
}

function layoutMorphemeFeatures(
  token: RussianLexemeToken,
  morpheme: MorphemeNode,
  morphemeIndex: number,
  morphCenterX: number,
  morphSubWidth: number,
  selected: CanvasSelectedNode | null,
  featuresOut: PositionedFeatureNode[],
  edgesOut: CanvasConnectionEdge[],
): void {
  const feats = morpheme.features

  if (feats.length === 0) {
    return
  }

  const step = morphSubWidth / feats.length
  const startLeft = morphCenterX - morphSubWidth / 2

  feats.forEach((feature, featureIndex) => {
    const featCenterX = startLeft + step * featureIndex + step / 2
    const isActive = isFeatureInSelectedBranch(
      token.id,
      morpheme.text,
      feature.symbol,
      selected,
    )
    const featId = `feat_${token.id}_${morphemeIndex}_${featureIndex}`

    featuresOut.push({
      id: featId,
      token,
      morpheme,
      feature,
      morphemeIndex,
      featureIndex,
      x: featCenterX,
      y: FEAT_Y,
      width: FEAT_WIDTH,
      height: FEAT_HEIGHT,
      isActive,
    })

    edgesOut.push({
      id: `edge_${featId}`,
      path: buildVerticalBezier(
        morphCenterX,
        MORPH_Y + MORPH_HEIGHT / 2,
        featCenterX,
        FEAT_Y - FEAT_HEIGHT / 2,
      ),
      kind: 'morph-feat',
      isActive,
    })
  })
}

function layoutTokenMorphemes(
  token: RussianLexemeToken,
  tokenCenterX: number,
  tokenSubWidth: number,
  selected: CanvasSelectedNode | null,
  morphemesOut: PositionedMorphemeNode[],
  featuresOut: PositionedFeatureNode[],
  edgesOut: CanvasConnectionEdge[],
): void {
  const morphWidths = token.morphemes.map(getMorphemeSubtreeWidth)
  const totalMorphsWidth = morphWidths.reduce((a, b) => a + b, 0) + Math.max(0, morphWidths.length - 1) * 14
  let cursorX = tokenCenterX - Math.min(tokenSubWidth, totalMorphsWidth) / 2

  token.morphemes.forEach((morpheme, morphemeIndex) => {
    const subWidth = morphWidths[morphemeIndex]
    const morphCenterX = cursorX + subWidth / 2
    cursorX += subWidth + 14

    const isActive = isMorphemeInSelectedBranch(token.id, morpheme.text, selected)
    const morphId = `morph_${token.id}_${morphemeIndex}`

    morphemesOut.push({
      id: morphId,
      token,
      morpheme,
      morphemeIndex,
      x: morphCenterX,
      y: MORPH_Y,
      width: MORPH_WIDTH,
      height: MORPH_HEIGHT,
      isActive,
    })

    edgesOut.push({
      id: `edge_${morphId}`,
      path: buildVerticalBezier(
        tokenCenterX,
        TOKEN_Y + TOKEN_HEIGHT / 2,
        morphCenterX,
        MORPH_Y - MORPH_HEIGHT / 2,
      ),
      kind: 'token-morph',
      isActive,
    })

    layoutMorphemeFeatures(
      token,
      morpheme,
      morphemeIndex,
      morphCenterX,
      subWidth,
      selected,
      featuresOut,
      edgesOut,
    )
  })
}

function layoutClauses(
  clauses: SyntacticClause[],
  tokenMap: Map<string, PositionedTokenNode>,
  selected: CanvasSelectedNode | null,
  edgesOut: CanvasConnectionEdge[],
): PositionedClauseNode[] {
  const result: PositionedClauseNode[] = []

  for (const clause of clauses) {
    const matchedTokens = clause.tokenIds
      .map(id => tokenMap.get(id))
      .filter((t): t is PositionedTokenNode => Boolean(t))

    if (matchedTokens.length === 0) {
      continue
    }

    const minX = Math.min(...matchedTokens.map(t => t.x - t.width / 2))
    const maxX = Math.max(...matchedTokens.map(t => t.x + t.width / 2))
    const centerX = (minX + maxX) / 2
    const width = Math.max(200, maxX - minX)
    const isClauseActive = (selected?.kind === 'clause' && selected.clause.id === clause.id)
      || matchedTokens.some(t => t.isActive)

    result.push({
      id: clause.id,
      clause,
      x: centerX,
      y: CLAUSE_Y,
      width,
      height: CLAUSE_HEIGHT,
      isActive: isClauseActive,
    })

    for (const tokenNode of matchedTokens) {
      edgesOut.push({
        id: `edge_${clause.id}_${tokenNode.id}`,
        path: buildVerticalBezier(
          centerX,
          CLAUSE_Y + CLAUSE_HEIGHT / 2,
          tokenNode.x,
          TOKEN_Y - TOKEN_HEIGHT / 2,
        ),
        kind: 'clause-token',
        isActive: tokenNode.isActive || (selected?.kind === 'clause' && selected.clause.id === clause.id),
      })
    }
  }

  return result
}

function layoutDependencyCurves(analysis: RussianSentenceAnalysis, tokenMap: Map<string, PositionedTokenNode>, selected: CanvasSelectedNode | null): CanvasDependencyCurve[] {
  const selectedTokenId = getSelectedTokenId(selected)
  const curves: CanvasDependencyCurve[] = []

  analysis.dependencies.forEach((dep, idx) => {
    const fromNode = tokenMap.get(dep.fromTokenId)
    const toNode = tokenMap.get(dep.toTokenId)

    if (!fromNode || !toNode || fromNode.id === toNode.id) {
      return
    }

    const startX = fromNode.x
    const endX = toNode.x
    const startY = TOKEN_Y - TOKEN_HEIGHT / 2
    const distance = Math.abs(endX - startX)
    const archHeight = Math.min(92, 34 + distance * 0.11 + (idx % 2) * 14)
    const controlY = startY - archHeight
    const midX = (startX + endX) / 2
    const apexY = startY - archHeight * 0.76
    const isActive = selectedTokenId === fromNode.id || selectedTokenId === toNode.id

    curves.push({
      id: dep.id,
      path: `M ${startX} ${startY} Q ${midX} ${controlY} ${endX} ${startY}`,
      label: dep.relationLabel,
      labelX: midX,
      labelY: apexY,
      isActive,
    })
  })

  return curves
}

function buildSentenceEndTokenIds(analysis: RussianSentenceAnalysis): Set<string> {
  const groups = groupTokensBySentence(analysis.sentence.plainText, analysis.tokens)
  const endIds = new Set<string>()

  if (groups.length <= 1) {
    return endIds
  }

  for (let i = 0; i < groups.length - 1; i++) {
    const lastItem = groups[i].items[groups[i].items.length - 1]

    if (lastItem) {
      endIds.add(lastItem.token.id)
    }
  }

  return endIds
}

export function computeCanvasGraphLayout(analysis: RussianSentenceAnalysis, expandedTokenIds: string[], selected: CanvasSelectedNode | null): CanvasGraphLayout {
  const tokens: PositionedTokenNode[] = []
  const morphemes: PositionedMorphemeNode[] = []
  const features: PositionedFeatureNode[] = []
  const edges: CanvasConnectionEdge[] = []
  const sentenceDividers: CanvasSentenceDivider[] = []
  const tokenMap = new Map<string, PositionedTokenNode>()
  const sentenceEndTokenIds = buildSentenceEndTokenIds(analysis)

  let cursorX = PADDING_X

  for (const token of analysis.tokens) {
    const isExpanded = expandedTokenIds.includes(token.id)
    const subWidth = getTokenSubtreeWidth(token, isExpanded)
    const tokenCenterX = cursorX + subWidth / 2
    const isActive = isTokenInSelectedBranch(token.id, selected)

    const positionedToken: PositionedTokenNode = {
      id: token.id,
      token,
      x: tokenCenterX,
      y: TOKEN_Y,
      width: TOKEN_WIDTH,
      height: TOKEN_HEIGHT,
      isExpanded,
      isActive,
    }

    tokens.push(positionedToken)
    tokenMap.set(token.id, positionedToken)

    if (isExpanded) {
      layoutTokenMorphemes(
        token,
        tokenCenterX,
        subWidth,
        selected,
        morphemes,
        features,
        edges,
      )
    }

    cursorX += subWidth + 24

    if (sentenceEndTokenIds.has(token.id)) {
      sentenceDividers.push({
        id: `sdiv_${token.id}`,
        x: cursorX + 16,
      })
      cursorX += 56
    }
  }

  const clauses = layoutClauses(
    analysis.clauses,
    tokenMap,
    selected,
    edges,
  )
  const dependencyCurves = layoutDependencyCurves(analysis, tokenMap, selected)
  const hasExpandedMorphs = morphemes.length > 0
  const hasFeatures = features.length > 0
  const totalWidth = Math.max(920, cursorX + PADDING_X)
  const totalHeight = hasFeatures ? 718 : (hasExpandedMorphs ? 550 : 380)

  return {
    totalWidth,
    totalHeight,
    clauses,
    tokens,
    morphemes,
    features,
    edges,
    dependencyCurves,
    sentenceDividers,
  }
}
