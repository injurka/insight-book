import { describe, expect, it } from 'bun:test'
import { Singleflight } from './singleflight'

describe('Singleflight', () => {
  it('deduplicates concurrent calls with the same key', async () => {
    const sf = new Singleflight()
    let executionCount = 0

    const task = async () => {
      executionCount++
      await new Promise(resolve => setTimeout(resolve, 50))
      return 'result'
    }

    const [res1, res2, res3] = await Promise.all([
      sf.do('key1', task),
      sf.do('key1', task),
      sf.do('key1', task),
    ])

    expect(res1).toBe('result')
    expect(res2).toBe('result')
    expect(res3).toBe('result')
    expect(executionCount).toBe(1)
  })

  it('runs tasks sequentially when one completes before the next starts', async () => {
    const sf = new Singleflight()
    let executionCount = 0

    const task = async () => {
      executionCount++
      return `count:${executionCount}`
    }

    const res1 = await sf.do('key1', task)
    const res2 = await sf.do('key1', task)

    expect(res1).toBe('count:1')
    expect(res2).toBe('count:2')
    expect(executionCount).toBe(2)
  })

  it('handles rejections and cleans up inFlight', async () => {
    const sf = new Singleflight()
    let executionCount = 0

    const failingTask = async () => {
      executionCount++
      await new Promise(resolve => setTimeout(resolve, 20))
      throw new Error('boom')
    }

    const [p1, p2] = await Promise.allSettled([
      sf.do('fail-key', failingTask),
      sf.do('fail-key', failingTask),
    ])

    expect(p1.status).toBe('rejected')
    expect(p2.status).toBe('rejected')
    expect(executionCount).toBe(1)
    expect(sf.has('fail-key')).toBe(false)
  })
})
