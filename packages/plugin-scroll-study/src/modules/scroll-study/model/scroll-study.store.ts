import type { InsightBookPluginApiFacade } from '@injurka/insight-book-plugin-api'
import type { CharacterData } from '../../../data'
import type { GridConnection, PuzzleNode } from './types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { allCharacters } from '../../../data'

// Hex direction axial offsets
const hexDirections = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]

export const useScrollStudyStore = defineStore('scrollStudy', () => {
  const hexSize = ref(38)
  const activeWord = ref<string | null>(null)
  const activeTargetChar = ref<CharacterData | null>(null)
  const activeGrid = ref<PuzzleNode[]>([])
  const gridConnections = ref<GridConnection[]>([])
  const selectedTablet = ref<string | null>('火')
  const isFinished = ref(false)
  const completedScrollIds = ref<string[]>([])
  const hoveredNodeId = ref<string | null>(null)
  const boardRadius = ref(3)
  const currentDictWordId = ref<number | null>(null)
  const apiFacade = ref<InsightBookPluginApiFacade | null>(null)

  function setApiFacade(api: InsightBookPluginApiFacade) {
    apiFacade.value = api
  }

  function getCharacterObj(symbol: string): CharacterData | undefined {
    return allCharacters.find(c => c.char === symbol || c.id === symbol)
  }

  function isRelatedSymbols(s1: string, s2: string): boolean {
    if (!s1 || !s2)
      return false
    if (s1 === s2)
      return true

    const c1 = getCharacterObj(s1)
    const c2 = getCharacterObj(s2)

    if (!c1 || !c2) {
      return s1 === s2
    }

    // Direct component relationship
    if (c1.components.some(comp => comp === c2.id || comp === c2.char))
      return true
    if (c2.components.some(comp => comp === c1.id || comp === c1.char))
      return true

    // Common component
    const c1Comps = c1.components.length > 0 ? c1.components : [c1.id, c1.char]
    const c2Comps = c2.components.length > 0 ? c2.components : [c2.id, c2.char]
    if (c1Comps.some(comp => c2Comps.includes(comp)))
      return true

    // Theme group
    if (c1.themeGroupId && c1.themeGroupId === c2.themeGroupId)
      return true

    return false
  }

  function getPerimeterCoords(radius: number): Array<{ q: number, r: number }> {
    const points: Array<{ q: number, r: number }> = []

    // 6 directional vectors around hex boundary
    const directions = [
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
      [1, 0],
    ]

    let q = 0
    let r = radius

    for (let i = 0; i < 6; i++) {
      const [dq, dr] = directions[i]
      for (let j = 0; j < radius; j++) {
        points.push({ q, r })
        q += dq
        r += dr
      }
    }

    return points
  }

  function loadCharacterScroll(charData: CharacterData, dictWordId?: number | null) {
    activeTargetChar.value = charData
    currentDictWordId.value = dictWordId || null
    activeWord.value = `${charData.translation} 「${charData.char}」`
    isFinished.value = false

    // Resolve component keys
    let keys = charData.components
      .map(comp => getCharacterObj(comp)?.char)
      .filter((ch): ch is string => !!ch)

    if (keys.length === 0) {
      // Fallback for radicals or characters without components
      const fallbackRadicals = ['木', '火', '水', '口', '日', '月']
      keys = fallbackRadicals.slice(0, 3)
    }

    // Rule: if 3 keys -> radius 3, if 4 keys -> radius 4, minimum is 3
    const radius = Math.max(3, keys.length)
    boardRadius.value = radius

    // Hex size adjustment based on radius so board fits container
    hexSize.value = radius > 3 ? Math.max(26, 38 - (radius - 3) * 4) : 38

    const perimeter = getPerimeterCoords(radius)
    const anchorPositions: Array<{ q: number, r: number, char: string }> = []

    // Evenly space key anchors around perimeter
    const step = Math.floor(perimeter.length / keys.length)
    keys.forEach((keyChar, index) => {
      const pos = perimeter[(index * step) % perimeter.length]
      anchorPositions.push({ ...pos, char: keyChar })
    })

    const grid: PuzzleNode[] = []

    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        let type: 'empty' | 'anchor' = 'empty'
        let char: string | undefined

        const anchor = anchorPositions.find(a => a.q === q && a.r === r)
        if (anchor) {
          type = 'anchor'
          char = anchor.char
        }

        grid.push({
          id: `${q},${r}`,
          q,
          r,
          type,
          character: char,
        })
      }
    }

    activeGrid.value = grid
    updateConnections()
  }

  async function loadRandomDictionaryScroll() {
    let targetCharObj: CharacterData | null = null
    let dictWordId: number | null = null

    if (apiFacade.value) {
      try {
        const dictWords = (await apiFacade.value.dictionary.getWords()) as Array<{ id?: number, word?: string }>
        if (dictWords && dictWords.length > 0) {
          // Shuffle dictionary words to find one in dataset
          const shuffled = [...dictWords].sort(() => Math.random() - 0.5)
          for (const item of shuffled) {
            if (item.word) {
              const matched = allCharacters.find(c => c.char === item.word || item.word?.includes(c.char))
              if (matched) {
                targetCharObj = matched
                dictWordId = item.id ?? null
                break
              }
            }
          }
        }
      }
      catch (e) {
        console.warn('Failed to load dictionary words for scroll:', e)
      }
    }

    // If no dictionary match found, pick random scroll from dataset
    if (!targetCharObj) {
      const candidates = allCharacters.filter(c => c.tier >= 1 && c.components.length > 0)
      const randomScroll = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : allCharacters[0]
      targetCharObj = randomScroll
    }

    if (targetCharObj) {
      loadCharacterScroll(targetCharObj, dictWordId)
    }
  }

  function initGrid() {
    loadRandomDictionaryScroll()
  }

  function clearGrid() {
    activeWord.value = null
    activeTargetChar.value = null
    activeGrid.value = []
    gridConnections.value = []
    currentDictWordId.value = null
  }

  function handleNodeDrop(symbol: string, node: PuzzleNode) {
    if (node.type === 'empty' && !isFinished.value) {
      node.character = symbol
      updateConnections()
      checkWin()
    }
  }

  function handleNodeClick(node: PuzzleNode) {
    if (node.type === 'empty' && selectedTablet.value && !isFinished.value) {
      if (node.character === selectedTablet.value) {
        node.character = undefined
      }
      else {
        node.character = selectedTablet.value
      }
      updateConnections()
      checkWin()
    }
  }

  function updateConnections() {
    const connections: GridConnection[] = []
    const nodes = activeGrid.value

    const filledNodes = nodes.filter(n => n.type === 'anchor' || (n.type === 'empty' && n.character))

    for (let i = 0; i < filledNodes.length; i++) {
      for (let j = i + 1; j < filledNodes.length; j++) {
        const n1 = filledNodes[i]
        const n2 = filledNodes[j]

        const dq = n1.q - n2.q
        const dr = n1.r - n2.r

        const isAdjacent = hexDirections.some(([dirQ, dirR]) => dq === dirQ && dr === dirR)

        if (isAdjacent) {
          const s1 = n1.character
          const s2 = n2.character

          const related = (s1 && s2) ? isRelatedSymbols(s1, s2) : false

          if (related) {
            connections.push({
              id: `${n1.id}-${n2.id}`,
              q1: n1.q,
              r1: n1.r,
              q2: n2.q,
              r2: n2.r,
              active: true,
            })
          }
        }
      }
    }

    gridConnections.value = connections
  }

  function checkWin() {
    if (isFinished.value)
      return

    const anchors = activeGrid.value.filter(n => n.type === 'anchor')
    if (anchors.length === 0)
      return

    // Build graph of connected nodes
    const graph = new Map<string, Set<string>>()
    gridConnections.value.forEach((conn) => {
      const [n1Id, n2Id] = conn.id.split('-')
      if (!graph.has(n1Id))
        graph.set(n1Id, new Set())
      if (!graph.has(n2Id))
        graph.set(n2Id, new Set())
      graph.get(n1Id)!.add(n2Id)
      graph.get(n2Id)!.add(n1Id)
    })

    // BFS from the first anchor node
    const firstAnchor = anchors[0]
    const visited = new Set<string>()
    const queue = [firstAnchor.id]
    visited.add(firstAnchor.id)

    while (queue.length > 0) {
      const current = queue.shift()!
      const neighbors = graph.get(current)
      if (neighbors) {
        neighbors.forEach((nb) => {
          if (!visited.has(nb)) {
            visited.add(nb)
            queue.push(nb)
          }
        })
      }
    }

    // Check if ALL anchors are connected in the same network
    const allAnchorsConnected = anchors.every(a => visited.has(a.id))

    if (allAnchorsConnected) {
      isFinished.value = true
      if (activeTargetChar.value && !completedScrollIds.value.includes(activeTargetChar.value.id)) {
        completedScrollIds.value.push(activeTargetChar.value.id)
      }

      // Submit dictionary grade if came from dictionary word
      if (currentDictWordId.value && apiFacade.value) {
        apiFacade.value.dictionary.submitGrade(currentDictWordId.value, 5).catch(err => console.error(err))
      }
    }
  }

  return {
    hexSize,
    activeWord,
    activeTargetChar,
    activeGrid,
    gridConnections,
    selectedTablet,
    isFinished,
    completedScrollIds,
    hoveredNodeId,
    boardRadius,
    currentDictWordId,
    setApiFacade,
    loadCharacterScroll,
    loadRandomDictionaryScroll,
    initGrid,
    clearGrid,
    handleNodeDrop,
    handleNodeClick,
  }
})
