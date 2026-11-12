import { describe, expect, it } from 'vitest'
import { resolveStashLanes } from './stashLanes'
import type { GraphLayout } from './computeGraphLayout'

function layout(partial: Partial<GraphLayout>): GraphLayout {
  return {
    nodes: partial.nodes ?? [],
    bands: partial.bands ?? [],
    maxLanes: partial.maxLanes ?? 1,
  }
}

const indexBySha = new Map([
  ['head', 0],
  ['branch', 1],
  ['base', 2],
])

describe('resolveStashLanes', () => {
  it('uses the lane right of the base commit when it is free', () => {
    const lanes = resolveStashLanes({
      layout: layout({
        nodes: [
          { sha: 'head', row: 0, lane: 0, color: '' },
          { sha: 'branch', row: 1, lane: 1, color: '' },
          { sha: 'base', row: 2, lane: 0, color: '' },
        ],
        bands: [[], [{ fromLane: 0, toLane: 0, kind: 'straight', color: '' }]],
      }),
      stashes: [{ baseSha: 'base' }],
      indexBySha,
      headIndex: 0,
    })
    expect(lanes).toEqual([1])
  })

  it('skips a lane occupied by a branch converging into the base commit', () => {
    const lanes = resolveStashLanes({
      layout: layout({
        nodes: [
          { sha: 'head', row: 0, lane: 0, color: '' },
          { sha: 'branch', row: 1, lane: 1, color: '' },
          { sha: 'base', row: 2, lane: 0, color: '' },
        ],
        bands: [
          [],
          [
            { fromLane: 0, toLane: 0, kind: 'straight', color: '' },
            { fromLane: 1, toLane: 0, kind: 'converge', color: '' },
          ],
        ],
      }),
      stashes: [{ baseSha: 'base' }],
      indexBySha,
      headIndex: 0,
    })
    expect(lanes).toEqual([2])
  })

  it('keeps walking right while lanes are occupied', () => {
    const lanes = resolveStashLanes({
      layout: layout({
        nodes: [
          { sha: 'head', row: 0, lane: 0, color: '' },
          { sha: 'branch', row: 1, lane: 2, color: '' },
          { sha: 'base', row: 2, lane: 0, color: '' },
        ],
        bands: [
          [],
          [
            { fromLane: 0, toLane: 0, kind: 'straight', color: '' },
            { fromLane: 1, toLane: 3, kind: 'merge', color: '' },
            { fromLane: 2, toLane: 2, kind: 'straight', color: '' },
          ],
        ],
      }),
      stashes: [{ baseSha: 'base' }],
      indexBySha,
      headIndex: 0,
    })
    expect(lanes).toEqual([4])
  })

  it('places a stash with a loaded base at index 0 to the right of it', () => {
    const lanes = resolveStashLanes({
      layout: layout({
        nodes: [{ sha: 'base', row: 0, lane: 1, color: '' }],
        bands: [[]],
      }),
      stashes: [{ baseSha: 'base' }],
      indexBySha: new Map([
        ['head', 0],
        ['base', 0],
      ]),
      headIndex: 0,
    })
    expect(lanes).toEqual([2])
  })

  it('floats a stash without a loaded base right of the HEAD lane', () => {
    const lanes = resolveStashLanes({
      layout: layout({
        nodes: [{ sha: 'head', row: 0, lane: 0, color: '' }],
        bands: [[]],
      }),
      stashes: [{ baseSha: 'missing' }, { baseSha: null }],
      indexBySha,
      headIndex: 0,
    })
    expect(lanes).toEqual([1, 1])
  })

  it('gives stashes sharing a base the same lane', () => {
    const lanes = resolveStashLanes({
      layout: layout({
        nodes: [
          { sha: 'head', row: 0, lane: 0, color: '' },
          { sha: 'base', row: 2, lane: 0, color: '' },
        ],
        bands: [[], [{ fromLane: 0, toLane: 0, kind: 'straight', color: '' }]],
      }),
      stashes: [{ baseSha: 'base' }, { baseSha: 'base' }],
      indexBySha,
      headIndex: 0,
    })
    expect(lanes).toEqual([1, 1])
  })
})
