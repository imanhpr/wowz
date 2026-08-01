import type { EventStream, EventStreamMessage } from 'h3'
import type { WowTokenStreamHub } from './wow-token-stream-hub'

export const WOW_TOKEN_HEARTBEAT_INTERVAL_MS = 25_000
export const WOW_TOKEN_RETRY_MS = 5_000

interface EventStreamClock {
  setInterval(callback: () => void, delay: number): ReturnType<typeof setInterval>
  clearInterval(timer: ReturnType<typeof setInterval>): void
}

interface WowTokenEventStream {
  push(message: EventStreamMessage): Promise<void>
  onClosed(callback: () => void): void
}

const defaultClock: EventStreamClock = {
  setInterval,
  clearInterval,
}

export function attachWowTokenEventStream(
  eventStream: WowTokenEventStream | EventStream,
  hub: WowTokenStreamHub,
  clock: EventStreamClock = defaultClock,
): () => void {
  let isClosed = false

  const unsubscribe = hub.subscribe((snapshot) => {
    if (!isClosed) {
      void eventStream.push({
        id: snapshot.id,
        event: 'price',
        retry: WOW_TOKEN_RETRY_MS,
        data: JSON.stringify(snapshot.data),
      })
    }
  })

  const heartbeat = clock.setInterval(() => {
    if (!isClosed) {
      void eventStream.push({
        event: 'heartbeat',
        data: new Date().toISOString(),
      })
    }
  }, WOW_TOKEN_HEARTBEAT_INTERVAL_MS)
  heartbeat.unref?.()

  const close = () => {
    if (isClosed) {
      return
    }

    isClosed = true
    clock.clearInterval(heartbeat)
    unsubscribe()
  }

  eventStream.onClosed(close)
  return close
}
