/**
 * Time dividers for the commit graph.
 *
 * Commits are listed newest-first, so each threshold ("a week ago", …) can
 * cross the history at most once. The marker sits on the boundary above the
 * first commit that is older than the threshold, which is what makes the
 * timeline read as discrete bands.
 */

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const YEAR = 365 * DAY

export interface TimeMarkerThreshold {
  /** Age in milliseconds at which the divider appears. */
  ms: number
  /** Catalog key (`graph.timeMarkers.*`), translated where the marker renders. */
  labelKey: string
}

const TIME_MARKER_THRESHOLDS: readonly TimeMarkerThreshold[] = [
  { ms: HOUR, labelKey: 'graph.timeMarkers.hour1' },
  { ms: 2 * HOUR, labelKey: 'graph.timeMarkers.hours2' },
  { ms: 6 * HOUR, labelKey: 'graph.timeMarkers.hours6' },
  { ms: DAY, labelKey: 'graph.timeMarkers.day1' },
  { ms: 2 * DAY, labelKey: 'graph.timeMarkers.days2' },
  { ms: 7 * DAY, labelKey: 'graph.timeMarkers.week1' },
  { ms: 14 * DAY, labelKey: 'graph.timeMarkers.weeks2' },
  { ms: 30 * DAY, labelKey: 'graph.timeMarkers.month1' },
  { ms: 60 * DAY, labelKey: 'graph.timeMarkers.months2' },
  { ms: 90 * DAY, labelKey: 'graph.timeMarkers.months3' },
  { ms: 180 * DAY, labelKey: 'graph.timeMarkers.months6' },
  { ms: YEAR, labelKey: 'graph.timeMarkers.year1' },
  { ms: 2 * YEAR, labelKey: 'graph.timeMarkers.years2' },
  { ms: 5 * YEAR, labelKey: 'graph.timeMarkers.years5' },
]

export interface TimeMarker {
  key: string
  /** Catalog key, translated at render time so dividers follow the locale. */
  labelKey: string
  /** Index of the first commit older than the threshold. */
  commitIndex: number
}

export interface DatedCommit {
  date: Date
}

/**
 * Builds one divider per crossed threshold. Markers that would land on the
 * very top of the list (index 0) are dropped: there is no "between two
 * commits" boundary there. When several thresholds cross at the same commit
 * only the tightest (first) one is kept.
 */
export function buildTimeMarkers(
  commits: readonly DatedCommit[],
  now: Date | number = Date.now(),
): TimeMarker[] {
  const nowMs = typeof now === 'number' ? now : now.getTime()
  const markers: TimeMarker[] = []
  const claimed = new Set<number>()

  for (const threshold of TIME_MARKER_THRESHOLDS) {
    const cutoff = nowMs - threshold.ms
    const commitIndex = commits.findIndex((commit) => commit.date.getTime() <= cutoff)
    if (commitIndex <= 0) continue
    if (claimed.has(commitIndex)) continue
    claimed.add(commitIndex)
    markers.push({
      key: threshold.labelKey,
      labelKey: threshold.labelKey,
      commitIndex,
    })
  }

  return markers
}
