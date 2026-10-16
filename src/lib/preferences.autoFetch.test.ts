import { describe, expect, it } from 'vitest'
import {
  AUTO_FETCH_INTERVAL_OPTIONS,
  clampAutoFetchIntervalSec,
  DEFAULT_AUTO_FETCH_INTERVAL_SEC,
  formatAutoFetchInterval,
  mergePreferences,
} from './preferences'

describe('auto-fetch interval preference', () => {
  it('offers Disabled plus 1m/5m/10m/30m/1h/2h options', () => {
    expect([...AUTO_FETCH_INTERVAL_OPTIONS]).toEqual([0, 60, 300, 600, 1800, 3600, 7200])
  })

  it('defaults to 5 minutes', () => {
    expect(DEFAULT_AUTO_FETCH_INTERVAL_SEC).toBe(300)
  })

  it('accepts every listed option', () => {
    for (const option of AUTO_FETCH_INTERVAL_OPTIONS) {
      expect(clampAutoFetchIntervalSec(option)).toBe(option)
    }
  })

  it('falls back to the default for unknown values', () => {
    expect(clampAutoFetchIntervalSec(999)).toBe(DEFAULT_AUTO_FETCH_INTERVAL_SEC)
    expect(clampAutoFetchIntervalSec(-5)).toBe(DEFAULT_AUTO_FETCH_INTERVAL_SEC)
    expect(clampAutoFetchIntervalSec(undefined)).toBe(DEFAULT_AUTO_FETCH_INTERVAL_SEC)
  })

  it('formats hours without falling back to minutes', () => {
    expect(formatAutoFetchInterval(0)).toBe('Disabled')
    expect(formatAutoFetchInterval(60)).toBe('Every minute')
    expect(formatAutoFetchInterval(300)).toBe('Every 5 minutes')
    expect(formatAutoFetchInterval(3600)).toBe('Every hour')
    expect(formatAutoFetchInterval(7200)).toBe('Every 2 hours')
  })

  it('round-trips a 2h interval through mergePreferences', () => {
    expect(mergePreferences({ autoFetchIntervalSec: 7200 }).autoFetchIntervalSec).toBe(7200)
    expect(mergePreferences({ autoFetchIntervalSec: 999 }).autoFetchIntervalSec).toBe(
      DEFAULT_AUTO_FETCH_INTERVAL_SEC,
    )
  })
})
