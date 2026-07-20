import os from 'node:os'

interface Task {
  id: number
  type: string
  payload: unknown
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

// 1. Узнаем, сколько логических ядер у текущего сервера/ПК
const cpuCores = os.cpus().length

// 2. Оставляем 1 ядро для главного потока (HTTP сервер, БД).
// 3. Устанавливаем хард-лимит (например, 4), чтобы не съесть всю оперативную память (RAM)
//    словарями NLP на многоядерных машинах. Можно переопределить через .env
const MAX_WORKERS = Number.parseInt(process.env.WORKER_COUNT || '0')
  || Math.min(Math.max(1, cpuCores - 1), 4)

// eslint-disable-next-line no-console
console.log(`🚀 Worker Pool initialized with ${MAX_WORKERS} threads (CPU cores: ${cpuCores})`)

const pool: Worker[] = []
const taskQueue: Task[] = []
const workerActive = new Map<Worker, boolean>()

const taskCallbacks = new Map<number, Task>()
let taskIdSeq = 0

function initPool() {
  for (let i = 0; i < MAX_WORKERS; i++) {
    const worker = new Worker(new URL('./task.worker.ts', import.meta.url))
    workerActive.set(worker, false)
    pool.push(worker)

    worker.onmessage = (event: MessageEvent) => {
      const { id, success, data, error } = event.data
      const task = taskCallbacks.get(id)
      if (task) {
        if (success)
          task.resolve(data)
        else task.reject(new Error(error))
        taskCallbacks.delete(id)
      }
      workerActive.set(worker, false)
      processNextTask()
    }

    worker.onerror = (err) => {
      console.error('[Worker Pool Error]', err)
      workerActive.set(worker, false)
      processNextTask()
    }
  }
}

function processNextTask() {
  if (taskQueue.length === 0)
    return

  const availableWorker = pool.find(w => !workerActive.get(w))
  if (availableWorker) {
    const task = taskQueue.shift()!
    workerActive.set(availableWorker, true)
    taskCallbacks.set(task.id, task)
    availableWorker.postMessage({ id: task.id, type: task.type, payload: task.payload })
  }
}

initPool()

export function runWorkerTask<T = unknown>(type: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++taskIdSeq
    taskQueue.push({ id, type, payload, resolve: resolve as (value: unknown) => void, reject })
    processNextTask()
  })
}
