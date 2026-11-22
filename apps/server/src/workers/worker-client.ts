import os from 'node:os'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'

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

logger.info(`🚀 Worker Pool initialized with ${MAX_WORKERS} threads (CPU cores: ${cpuCores})`)

const pool: Worker[] = []
const taskQueue: Task[] = []
const idleWorkers = new Set<Worker>()
const workerCurrentTaskId = new Map<Worker, number>()

const taskCallbacks = new Map<number, Task>()
let taskIdSeq = 0

function createWorker(): Worker {
  const worker = new Worker(new URL('./task.worker.ts', import.meta.url))
  pool.push(worker)

  worker.onmessage = (event: MessageEvent) => {
    if (event.data.ready === true) {
      idleWorkers.add(worker)
      processNextTask()

      return
    }

    const {
      id,
      success,
      data,
      error,
      stack,
      appError,
    } = event.data
    const task = taskCallbacks.get(id)

    if (id !== workerCurrentTaskId.get(worker))
      return

    if (task) {
      if (success) {
        task.resolve(data)
      }
      else {
        const err = appError
          ? new AppError(
              appError.status,
              appError.code,
              error,
              appError.details,
            )
          : new Error(error)

        // Подменяем стек на реальный стек из воркера,
        // чтобы в логах было видно, где именно упала задача
        if (stack)
          err.stack = stack

        logger.error({ taskId: id, taskType: task.type, err }, `[Worker Task Failed] ${task.type}: ${error}`)
        task.reject(err)
      }

      taskCallbacks.delete(id)
    }

    workerCurrentTaskId.delete(worker)
    idleWorkers.add(worker)
    processNextTask()
  }

  worker.onerror = (err) => {
    logger.error(err, '[Worker Pool Error]')
    const currentTaskId = workerCurrentTaskId.get(worker)

    if (currentTaskId !== undefined) {
      const task = taskCallbacks.get(currentTaskId)

      if (task) {
        const errMsg = err instanceof Error ? err.message : String(err)
        task.reject(new Error(`Worker crashed while processing task ${task.type}: ${errMsg}`))
        taskCallbacks.delete(currentTaskId)
      }

      workerCurrentTaskId.delete(worker)
    }

    try {
      worker.terminate()
    }
    catch { }

    idleWorkers.delete(worker)
    const index = pool.indexOf(worker)

    if (index !== -1) {
      pool.splice(index, 1)
    }

    createWorker()
    processNextTask()
  }

  return worker
}

function initPool() {
  for (let i = 0; i < MAX_WORKERS; i++) {
    createWorker()
  }
}

function processNextTask() {
  if (taskQueue.length === 0)
    return

  const availableWorker = idleWorkers.values().next().value

  if (availableWorker) {
    const task = taskQueue.shift()!
    idleWorkers.delete(availableWorker)
    workerCurrentTaskId.set(availableWorker, task.id)
    taskCallbacks.set(task.id, task)
    availableWorker.postMessage({ id: task.id, type: task.type, payload: task.payload })
  }
}

initPool()

export function terminatePool(): void {
  for (const worker of pool) {
    try {
      worker.terminate()
    }
    catch { }
  }

  pool.length = 0
  idleWorkers.clear()
  workerCurrentTaskId.clear()
}

export function runWorkerTask<T = unknown>(type: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++taskIdSeq
    taskQueue.push({
      id,
      type,
      payload,
      resolve: resolve as (value: unknown) => void,
      reject,
    })
    processNextTask()
  })
}
