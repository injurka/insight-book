import type { DialogueSession } from '../../../shared/types/dialogue'
import localforage from 'localforage'
import { ref } from 'vue'

const SESSIONS_STORE_KEY = 'insight_dialogue_trainer_sessions'
const ACTIVE_SESSION_ID_KEY = 'insight_dialogue_trainer_active_id'

const storage = localforage.createInstance({
  name: 'insight_dialogue_trainer',
  storeName: 'sessions',
})

export function useDialogueStorage() {
  const sessions = ref<DialogueSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const isLoaded = ref(false)

  async function loadAllSessions(): Promise<DialogueSession[]> {
    try {
      const data = await storage.getItem<DialogueSession[]>(SESSIONS_STORE_KEY)
      sessions.value = Array.isArray(data) ? data : []
      const activeId = await storage.getItem<string>(ACTIVE_SESSION_ID_KEY)
      activeSessionId.value = activeId || (sessions.value[0]?.id ?? null)
    }
    catch (err) {
      console.warn('[DialogueTrainer] Failed to load sessions from IndexedDB:', err)
      sessions.value = []
    }
    finally {
      isLoaded.value = true
    }

    return sessions.value
  }

  async function saveSessions(): Promise<void> {
    try {
      await storage.setItem(SESSIONS_STORE_KEY, JSON.parse(JSON.stringify(sessions.value)))

      if (activeSessionId.value) {
        await storage.setItem(ACTIVE_SESSION_ID_KEY, activeSessionId.value)
      }
    }
    catch (err) {
      console.warn('[DialogueTrainer] Failed to save sessions to IndexedDB:', err)
    }
  }

  async function saveSession(session: DialogueSession): Promise<void> {
    const index = sessions.value.findIndex(s => s.id === session.id)

    if (index >= 0) {
      sessions.value[index] = session
    }
    else {
      sessions.value.unshift(session)
    }

    activeSessionId.value = session.id
    await saveSessions()
  }

  async function removeSession(sessionId: string): Promise<void> {
    sessions.value = sessions.value.filter(s => s.id !== sessionId)

    if (activeSessionId.value === sessionId) {
      activeSessionId.value = sessions.value[0]?.id ?? null
    }

    await saveSessions()
  }

  async function clearAllSessions(): Promise<void> {
    sessions.value = []
    activeSessionId.value = null

    try {
      await storage.clear()
    }
    catch (err) {
      console.warn('[DialogueTrainer] Failed to clear IndexedDB:', err)
    }
  }

  return {
    sessions,
    activeSessionId,
    isLoaded,
    loadAllSessions,
    saveSession,
    removeSession,
    clearAllSessions,
  }
}
