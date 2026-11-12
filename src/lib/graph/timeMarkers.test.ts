import { describe, expect, it } from 'vitest'
import { buildTimeMarkers } from './timeMarkers'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const NOW = new Date('2026-06-15T12:00:00.000Z')

function commitAges(agesMs: number[]): { date: Date }[] {
  return agesMs.map((age) => ({ date: new Date(NOW.getTime() - age) }))
}

describe('buildTimeMarkers', () => {
  it('places a divider above the first commit older than each threshold', () => {
    const commits = commitAges([10 * 60 * 1000, 3 * HOUR, 20 * HOUR, 10 * DAY])

    expect(buildTimeMarkers(commits, NOW)).toEqual([
      { key: 'graph.timeMarkers.hour1', labelKey: 'graph.timeMarkers.hour1', commitIndex: 1 },
      { key: 'graph.timeMarkers.hours6', labelKey: 'graph.timeMarkers.hours6', commitIndex: 2 },
      { key: 'graph.timeMarkers.day1', labelKey: 'graph.timeMarkers.day1', commitIndex: 3 },
    ])
  })

  it('drops dividers that land on the top of the list', () => {
    const commits = commitAges([2 * HOUR, 3 * HOUR])

    expect(buildTimeMarkers(commits, NOW)).toEqual([])
  })

  it('keeps only the tightest divider when several thresholds share a commit', () => {
    const commits = commitAges([10 * 60 * 1000, 40 * DAY])

    const markers = buildTimeMarkers(commits, NOW)
    expect(markers).toHaveLength(1)
    expect(markers[0].labelKey).toBe('graph.timeMarkers.hour1')
    expect(markers[0].commitIndex).toBe(1)
  })

  it('accepts a timestamp for now', () => {
    const commits = commitAges([2 * DAY])

    expect(buildTimeMarkers(commits, NOW.getTime())).toEqual([])
  })
})
