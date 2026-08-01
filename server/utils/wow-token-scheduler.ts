const COLLECTION_INTERVAL_MS = 60 * 60 * 1_000

interface SchedulerLogger {
  error(message: string): void
}

interface SchedulerClock {
  setInterval(callback: () => void, delay: number): ReturnType<typeof setInterval>
  clearInterval(timer: ReturnType<typeof setInterval>): void
}

const defaultClock: SchedulerClock = {
  setInterval,
  clearInterval,
}

export function startWowTokenScheduler(
  collect: () => Promise<unknown>,
  logger: SchedulerLogger = console,
  clock: SchedulerClock = defaultClock,
): () => void {
  let isRunning = false

  const run = async () => {
    if (isRunning) {
      return
    }

    isRunning = true

    try {
      await collect()
    }
    catch {
      logger.error('Scheduled WoW Token collection failed')
    }
    finally {
      isRunning = false
    }
  }

  void run()
  const timer = clock.setInterval(() => void run(), COLLECTION_INTERVAL_MS)
  timer.unref?.()

  return () => clock.clearInterval(timer)
}

export { COLLECTION_INTERVAL_MS }
