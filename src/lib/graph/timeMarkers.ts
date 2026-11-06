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
  label: string
}

export const TIME_MARKER_THRESHOLDS: readonly TimeMarkerThreshold[] = [
  { ms: HOUR, label: '1 hour ago' },
  { ms: 2 * HOUR, label: '2 hours ago' },
  { ms: 6 * HOUR, label: '6 hours ago' },
  { ms: DAY, label: 'a day ago' },
  { ms: 2 * DAY, label: '2 days ago' },
  { ms: 7 * DAY, label: 'a week ago' },
  { ms: 14 * DAY, label: '2 weeks ago' },
  { ms: 30 * DAY, label: 'a month ago' },
  { ms: 60 * DAY, label: '2 months ago' },
  { ms: 90 * DAY, label: '3 months ago' },
  { ms: 180 * DAY, label: '6 months ago' },
  { ms: YEAR, label: 'a year ago' },
  { ms: 2 * YEAR, label: '2 years ago' },
  { ms: 5 * YEAR, label: '5 years ago' },
]

export interface TimeMarker {
  key: string
  label: string
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
      key: threshold.label,
      label: threshold.label,
      commitIndex,
    })
  }

  return markers
}
