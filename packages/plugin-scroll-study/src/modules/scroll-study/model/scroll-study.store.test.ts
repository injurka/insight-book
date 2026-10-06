import type { PuzzleNode } from './types'
import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { useScrollStudyStore } from './scroll-study.store'

function node(q: number, character?: string, type: PuzzleNode['type'] = 'empty'): PuzzleNode {
  return { id: `${q},0`, q, r: 0, type, character }
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
