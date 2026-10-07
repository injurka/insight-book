import type { PuzzleNode } from './types'
import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { useScrollStudyStore } from './scroll-study.store'

function node(q: number, character?: string, type: PuzzleNode['type'] = 'empty'): PuzzleNode {
  return {
    id: `${q},0`,
    q,
    r: 0,
    type,
    character,
  }
}

describe('research board connections', () => {
  beforeEach(() => setActivePinia(createPinia()))

  test('identical adjacent symbols do not connect or complete the scroll', () => {
    const store = useScrollStudyStore()
    store.activeGrid = [node(-1, '木', 'anchor'), node(0), node(1, '木', 'anchor')]
    store.handleNodeDrop('木', store.activeGrid[1])
    expect(store.gridConnections).toHaveLength(0)
    expect(store.isFinished).toBe(false)
  })

  test('identical anchors connect through a different related symbol, including negative coordinates', () => {
    const store = useScrollStudyStore()
    store.activeGrid = [node(-1, '木', 'anchor'), node(0), node(1, '木', 'anchor')]
    store.handleNodeDrop('林', store.activeGrid[1])
    expect(store.gridConnections).toHaveLength(2)
    expect(store.isFinished).toBe(true)
  })

  test('character and its dataset ID cannot bypass the identical-symbol rule', () => {
    const store = useScrollStudyStore()
    store.activeGrid = [node(-1, '木', 'anchor'), node(0), node(1, '木', 'anchor')]
    store.handleNodeDrop('R-mu', store.activeGrid[1])
    expect(store.gridConnections).toHaveLength(0)
    expect(store.isFinished).toBe(false)
  })

  test('unrelated and nonadjacent characters do not connect', () => {
    const store = useScrollStudyStore()
    store.activeGrid = [node(-2, '木', 'anchor'), node(0), node(1, '口', 'anchor')]
    store.handleNodeDrop('林', store.activeGrid[1])
    expect(store.gridConnections).toHaveLength(0)
    expect(store.isFinished).toBe(false)
  })
})

describe('research board cell clicks', () => {
  beforeEach(() => setActivePinia(createPinia()))

  test('a filled cell clears before placing a different selected symbol', () => {
    const store = useScrollStudyStore()
    store.activeGrid = [node(0, '木')]
    store.selectedTablet = '火'
    expect(store.handleNodeClick(store.activeGrid[0])).toBe('remove')
    expect(store.activeGrid[0].character).toBeUndefined()
    expect(store.handleNodeClick(store.activeGrid[0])).toBe('place')
    expect(store.activeGrid[0].character).toBe('火')
  })

  test('a filled cell clears even without a selected symbol; anchors stay intact', () => {
    const store = useScrollStudyStore()
    store.activeGrid = [node(0, '木'), node(1, '水', 'anchor')]
    store.selectedTablet = null
    expect(store.handleNodeClick(store.activeGrid[0])).toBe('remove')
    expect(store.activeGrid[0].character).toBeUndefined()
    expect(store.handleNodeClick(store.activeGrid[1])).toBeNull()
    expect(store.activeGrid[1].character).toBe('水')
  })
})
