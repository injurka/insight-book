import type { ClientToWorkerRPC, WorkerToClientRPC } from '~/01.shared/types/rpc'
import { createBirpc } from 'birpc'

let workerInstance: Worker | null = null
let dbRpcClient: ClientToWorkerRPC | null = null

const syncListeners = new Set<(progress: { stage: string, loaded: number, total: number }) => void>()
const migrationListeners = new Set<(progress: { current: number, total: number, message: string }) => void>()

const clientHandlers: WorkerToClientRPC = {
  onSyncProgress(progress) {
    syncListeners.forEach(fn => fn(progress))
  },
  onMigrationProgress(progress) {
    migrationListeners.forEach(fn => fn(progress))
  },
}

export function getDbRpc(): ClientToWorkerRPC {
  if (!dbRpcClient) {
    workerInstance = new Worker(new URL('../workers/dedicated/sqlite.worker.ts', import.meta.url), { type: 'module' })

    dbRpcClient = createBirpc<ClientToWorkerRPC, WorkerToClientRPC>(clientHandlers, {
      post: data => workerInstance!.postMessage(data),
      on: (cb) => {
        workerInstance!.addEventListener('message', (e) => {
          cb(e.data)
        })
      },
    })
  }

  return dbRpcClient
}

export const dbRpc = new Proxy({} as ClientToWorkerRPC, {
  get(_target, prop: keyof ClientToWorkerRPC) {
    const client = getDbRpc()

    return client[prop]
  },
})

export function onSyncProgress(fn: (progress: { stage: string, loaded: number, total: number }) => void) {
  syncListeners.add(fn)

  return () => syncListeners.delete(fn)
}

export function onMigrationProgress(fn: (progress: { current: number, total: number, message: string }) => void) {
  migrationListeners.add(fn)

  return () => migrationListeners.delete(fn)
}

export async function initDatabase(): Promise<void> {
  const rpc = getDbRpc()
  await rpc.initDb()
}
