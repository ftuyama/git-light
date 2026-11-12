import type { GraphLayout } from './computeGraphLayout'

export interface StashLaneOptions {
  layout: GraphLayout
  stashes: { baseSha: string | null }[]
  indexBySha: Map<string, number>
  headIndex: number
}

/**
 * Picks the lane for each stash box.
 *
 * A stash box sits in the lane immediately right of its base commit's lane, but
 * that lane may be taken by another branch: the band above the base commit is
 * where branches converging into the base run vertically. Placing the box there
 * would draw the dotted stash connector on top of another branch's line, so the
 * search continues rightwards until a lane free of band traffic is found.
 *
 * Stashes whose base commit is not loaded float above the list; they stay just
 * right of the HEAD lane, as there is no band to avoid there.
 */
export function resolveStashLanes(options: StashLaneOptions): number[] {
  const { layout, stashes, indexBySha, headIndex } = options

  return stashes.map((stash) => {
    const baseIndex = stash.baseSha ? (indexBySha.get(stash.baseSha) ?? -1) : -1
    const baseLane =
      baseIndex >= 0
        ? (layout.nodes[baseIndex]?.lane ?? 0)
        : (layout.nodes[headIndex]?.lane ?? 0)

    const occupied = new Set<number>([baseLane])
    // Stash rows are inserted directly above the base commit, so the connector
    // crosses the band that leads into that commit.
    const band = baseIndex > 0 ? layout.bands[baseIndex - 1] : undefined
    for (const edge of band ?? []) {
      occupied.add(edge.fromLane)
      occupied.add(edge.toLane)
    }

    let lane = baseLane + 1
    while (occupied.has(lane)) lane++
    return lane
  })
}
