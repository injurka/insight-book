import type {
  CanvasSelectedNode,
  CharacterNode,
  ChineseSentenceAnalysis,
  ComponentNode,
  LexemeToken,
  SyntacticClause,
} from '../../modules/chinese-analyzer/model'

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
  token: LexemeToken
  x: number
  y: number
  width: number
  height: number
  isExpanded: boolean
  isActive: boolean
}

export interface PositionedCharacterNode {
  id: string
  token: LexemeToken
  character: CharacterNode
  charIndex: number
  x: number
  y: number
  width: number
  height: number
  isActive: boolean
}

export interface PositionedComponentNode {
  id: string
  token: LexemeToken
  character: CharacterNode
  component: ComponentNode
  charIndex: number
  compIndex: number
  x: number
  y: number
  width: number
  height: number
  isActive: boolean
}

export interface CanvasConnectionEdge {
  id: string
  path: string
  kind: 'clause-token' | 'token-char' | 'char-comp'
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

export interface CanvasGraphLayout {
  totalWidth: number
  totalHeight: number
  clauses: PositionedClauseNode[]
  tokens: PositionedTokenNode[]
  characters: PositionedCharacterNode[]
  components: PositionedComponentNode[]
  edges: CanvasConnectionEdge[]
  dependencyCurves: CanvasDependencyCurve[]
}

const CLAUSE_Y = 64
const CLAUSE_HEIGHT = 68
const TOKEN_Y = 248
const TOKEN_WIDTH = 158
const TOKEN_HEIGHT = 114
const CHAR_Y = 448
const CHAR_WIDTH = 116
const CHAR_HEIGHT = 104
const COMP_Y = 620
const COMP_WIDTH = 94
const COMP_HEIGHT = 76
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

  if (selected.kind === 'token' || selected.kind === 'character' || selected.kind === 'component') {
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

function isCharInSelectedBranch(tokenId: string, charSymbol: string, selected: CanvasSelectedNode | null): boolean {
  if (!selected) {
    return false
  }

  if (selected.kind === 'token') {
    return selected.token.id === tokenId
  }

  if (selected.kind === 'character' || selected.kind === 'component') {
    return selected.token.id === tokenId && selected.character.char === charSymbol
  }

  return false
}

function isCompInSelectedBranch(
  tokenId: string,
  charSymbol: string,
  compSymbol: string,
  selected: CanvasSelectedNode | null,
): boolean {
  if (!selected) {
    return false
  }

  if (selected.kind === 'character') {
    return selected.token.id === tokenId && selected.character.char === charSymbol
  }

  if (selected.kind === 'component') {
    return (
      selected.token.id === tokenId
      && selected.character.char === charSymbol
      && selected.component.symbol === compSymbol
    )
  }

  return false
}

function getCharSubtreeWidth(character: CharacterNode): number {
  const count = Math.max(1, character.components.length)

  return Math.max(CHAR_WIDTH + 14, count * (COMP_WIDTH + 12))
}

function getTokenSubtreeWidth(token: LexemeToken, isExpanded: boolean): number {
  if (!isExpanded || token.characters.length === 0) {
    return TOKEN_WIDTH + 20
  }

  const charsWidth = token.characters.reduce((acc, ch) => acc + getCharSubtreeWidth(ch), 0)
  const gaps = Math.max(0, token.characters.length - 1) * 14

  return Math.max(TOKEN_WIDTH + 24, charsWidth + gaps)
}

function layoutCharacterComponents(
  token: LexemeToken,
  character: CharacterNode,
  charIndex: number,
  charCenterX: number,
  charSubWidth: number,
  selected: CanvasSelectedNode | null,
  componentsOut: PositionedComponentNode[],
  edgesOut: CanvasConnectionEdge[],
): void {
  const comps = character.components

  if (comps.length === 0) {
    return
  }

  const step = charSubWidth / comps.length
  const startLeft = charCenterX - charSubWidth / 2

  comps.forEach((component, compIndex) => {
    const compCenterX = startLeft + step * compIndex + step / 2
    const isActive = isCompInSelectedBranch(
      token.id,
      character.char,
      component.symbol,
      selected,
    )
    const compId = `comp_${token.id}_${charIndex}_${compIndex}`

    componentsOut.push({
      id: compId,
      token,
      character,
      component,
      charIndex,
      compIndex,
      x: compCenterX,
      y: COMP_Y,
      width: COMP_WIDTH,
      height: COMP_HEIGHT,
      isActive,
    })

    edgesOut.push({
      id: `edge_${compId}`,
      path: buildVerticalBezier(
        charCenterX,
        CHAR_Y + CHAR_HEIGHT / 2,
        compCenterX,
        COMP_Y - COMP_HEIGHT / 2,
      ),
      kind: 'char-comp',
      isActive,
    })
  })
}

function layoutTokenCharacters(
  token: LexemeToken,
  tokenCenterX: number,
  tokenSubWidth: number,
  selected: CanvasSelectedNode | null,
  charactersOut: PositionedCharacterNode[],
  componentsOut: PositionedComponentNode[],
  edgesOut: CanvasConnectionEdge[],
): void {
  const charWidths = token.characters.map(getCharSubtreeWidth)
  const totalCharsWidth = charWidths.reduce((a, b) => a + b, 0) + Math.max(0, charWidths.length - 1) * 14
  let cursorX = tokenCenterX - Math.min(tokenSubWidth, totalCharsWidth) / 2

  token.characters.forEach((character, charIndex) => {
    const subWidth = charWidths[charIndex]
    const charCenterX = cursorX + subWidth / 2
    cursorX += subWidth + 14

    const isActive = isCharInSelectedBranch(token.id, character.char, selected)
    const charId = `char_${token.id}_${charIndex}`

    charactersOut.push({
      id: charId,
      token,
      character,
      charIndex,
      x: charCenterX,
      y: CHAR_Y,
      width: CHAR_WIDTH,
      height: CHAR_HEIGHT,
      isActive,
    })

    edgesOut.push({
      id: `edge_${charId}`,
      path: buildVerticalBezier(
        tokenCenterX,
        TOKEN_Y + TOKEN_HEIGHT / 2,
        charCenterX,
        CHAR_Y - CHAR_HEIGHT / 2,
      ),
      kind: 'token-char',
      isActive,
    })

    layoutCharacterComponents(
      token,
      character,
      charIndex,
      charCenterX,
      subWidth,
      selected,
      componentsOut,
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
    const width = Math.max(190, maxX - minX)
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

function layoutDependencyCurves(analysis: ChineseSentenceAnalysis, tokenMap: Map<string, PositionedTokenNode>, selected: CanvasSelectedNode | null): CanvasDependencyCurve[] {
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

export function computeCanvasGraphLayout(analysis: ChineseSentenceAnalysis, expandedTokenIds: string[], selected: CanvasSelectedNode | null): CanvasGraphLayout {
  const tokens: PositionedTokenNode[] = []
  const characters: PositionedCharacterNode[] = []
  const components: PositionedComponentNode[] = []
  const edges: CanvasConnectionEdge[] = []
  const tokenMap = new Map<string, PositionedTokenNode>()

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
      layoutTokenCharacters(
        token,
        tokenCenterX,
        subWidth,
        selected,
        characters,
        components,
        edges,
      )
    }

    cursorX += subWidth + 24
  }

  const clauses = layoutClauses(
    analysis.clauses,
    tokenMap,
    selected,
    edges,
  )
  const dependencyCurves = layoutDependencyCurves(analysis, tokenMap, selected)
  const hasExpandedChars = characters.length > 0
  const hasComponents = components.length > 0
  const totalWidth = Math.max(920, cursorX + PADDING_X)
  const totalHeight = hasComponents ? 710 : (hasExpandedChars ? 545 : 370)

  return {
    totalWidth,
    totalHeight,
    clauses,
    tokens,
    characters,
    components,
    edges,
    dependencyCurves,
  }
}
