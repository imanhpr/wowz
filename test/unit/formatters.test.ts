import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '../../app/utils/formatters'

describe('formatRelativeTime', () => {
  it('formats a recent timestamp as localized minutes ago', () => {
    const now = Date.parse('2026-08-01T12:18:00.000Z')

    expect(formatRelativeTime('2026-08-01T12:00:00.000Z', now))
      .toBe('۱۸ دقیقه پیش')
  })
})
