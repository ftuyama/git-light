import { describe, expect, it } from 'vitest'
import { mergeMetaForMode } from './mergeMode'

describe('mergeMetaForMode', () => {
  it('maps merge modes to action meta flags', () => {
    expect(mergeMetaForMode('default')).toEqual({})
    expect(mergeMetaForMode('ff-only')).toEqual({ ffOnly: true })
    expect(mergeMetaForMode('no-ff')).toEqual({ noFf: true })
    expect(mergeMetaForMode('squash')).toEqual({ squash: true })
  })
})
