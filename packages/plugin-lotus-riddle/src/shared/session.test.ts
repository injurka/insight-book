import type { Round } from './types'
import { afterEach, expect, test } from 'bun:test'
import { loadSession, saveSession, sessionKey } from './session'

const data = new Map<string, string>()
const storage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => {
    data.set(key, value)
  },
}
Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true })
afterEach(() => data.clear())
const round: Round = {
  word: {
    id: 1,
    word: 'lantern',
    translation: 'фонарь',
    language: 'en',
    transcription: '',
    due: '2020-01-01',
  },
  mystery: { introduction: 'Вещь из сумерек.', facts: ['Неживая.', 'Рукотворная.', 'Полезная.', 'Даёт свет.'], hints: ['Предмет.', 'Помогает ночью.', 'Защищает огонь.'] },
  turns: [],
  hintsUsed: 0,
  outcome: 'revealed',
  grade: 'sending',
}
test('restored in-flight grade becomes uncertain, preventing duplicate review after reload', () => {
  expect(saveSession('test', { language: 'en', used: [], round })).toBe(true)
  expect(loadSession('test')?.round?.grade).toBe('uncertain')
})
test('progress is scoped to the current account', () => {
  const key = sessionKey({ id: 42 })!
  saveSession(key, { language: 'en', used: [], round })
  expect(loadSession(sessionKey({ id: 43 }))).toBeNull()
  expect(sessionKey({})).toBeNull()
})
test('expired, damaged and oversized sessions are discarded', () => {
  data.set('test', JSON.stringify({ language: 'en', used: [], round, savedAt: Date.now() - 13 * 60 * 60 * 1000 }))
  expect(loadSession('test')).toBeNull()
  data.set('test', '{broken')
  expect(loadSession('test')).toBeNull()
  saveSession('test', { language: 'en', used: [], round: { ...round, hintsUsed: 99 } })
  expect(loadSession('test')).toBeNull()
})
test('storage failures degrade gracefully', () => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    },
    configurable: true,
  })
  expect(loadSession('test')).toBeNull()
  expect(saveSession('test', { language: 'en', used: [], round })).toBe(false)
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true })
})
