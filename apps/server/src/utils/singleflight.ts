/**
 * Singleflight suppresses duplicate execution of concurrent asynchronous operations.
 * If multiple callers request the same key simultaneously, the operation executes only once
 * and the shared result (or rejection) is returned to all concurrent callers.
 */
export class Singleflight {
  private inFlight = new Map<string, Promise<unknown>>()

  /**
   * Executes and returns the result of the given function, making sure that only one
   * execution is in-flight for a given key at a time.
   * If a duplicate comes in while the first is running, it will await the same Promise.
   */
  async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key)
    if (existing) {
      return existing as Promise<T>
    }

    const promise = (async () => {
      try {
        return await fn()
      }
      finally {
        this.inFlight.delete(key)
      }
    })()

    this.inFlight.set(key, promise)
    return promise
  }

  /**
   * Returns whether a task for the specified key is currently in-flight.
   */
  has(key: string): boolean {
    return this.inFlight.has(key)
  }

  /**
   * Returns the count of currently in-flight operations.
   */
  get size(): number {
    return this.inFlight.size
  }

  /**
   * Clears all in-flight entries (mainly useful for testing or teardown).
   */
  clear(): void {
    this.inFlight.clear()
  }
}

export const singleflight = new Singleflight()
