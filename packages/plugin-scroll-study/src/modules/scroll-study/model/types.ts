import type { CharacterData } from '../../../data'

export interface PuzzleNode {
  id: string
  q: number
  r: number
  type: 'empty' | 'anchor' | 'target'
  character?: string
}

export interface GridConnection {
  id: string
  q1: number
  r1: number
  q2: number
  r2: number
  active: boolean
}

export interface ScrollStudyState {
  hexSize: number
  activeWord: string | null
  activeTargetChar: CharacterData | null
  activeGrid: PuzzleNode[]
  gridConnections: GridConnection[]
  selectedTablet: string | null
  isFinished: boolean
  completedScrollIds: string[]
  hoveredNodeId: string | null
  radius: number
  currentDictWordId: number | null
}
