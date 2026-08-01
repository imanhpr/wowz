import type { WowTokenResponse } from '../../shared/types/wow-token'

export interface WowTokenStreamSnapshot {
  id: string
  data: WowTokenResponse
}

export type WowTokenStreamSubscriber = (snapshot: WowTokenStreamSnapshot) => void

export function createWowTokenSnapshotId(data: WowTokenResponse): string {
  const { eu, us } = data.regions
  return [
    'eu',
    eu.quote.priceGold,
    eu.quote.timestamp,
    'us',
    us.quote.priceGold,
    us.quote.timestamp,
  ].join(':')
}

export class WowTokenStreamHub {
  private latestSnapshot: WowTokenStreamSnapshot | null = null
  private lastBroadcastId: string | null = null
  private readonly subscribers = new Set<WowTokenStreamSubscriber>()

  get hasSnapshot(): boolean {
    return this.latestSnapshot !== null
  }

  update(data: WowTokenResponse, broadcast: boolean): void {
    const snapshot = {
      id: createWowTokenSnapshotId(data),
      data,
    }
    this.latestSnapshot = snapshot

    if (!broadcast || snapshot.id === this.lastBroadcastId) {
      return
    }

    this.lastBroadcastId = snapshot.id
    for (const subscriber of this.subscribers) {
      subscriber(snapshot)
    }
  }

  subscribe(subscriber: WowTokenStreamSubscriber): () => void {
    this.subscribers.add(subscriber)

    if (this.latestSnapshot) {
      subscriber(this.latestSnapshot)
    }

    return () => this.subscribers.delete(subscriber)
  }

  clear(): void {
    this.subscribers.clear()
    this.latestSnapshot = null
    this.lastBroadcastId = null
  }
}
