import { describe, expect, it } from 'vitest'
import {
  clampLeftSidebarSize,
  clampRightSidebarSize,
  LEFT_SIDEBAR_COLLAPSE_HINT_SIZE,
  LEFT_SIDEBAR_COLLAPSE_SIZE,
  LEFT_SIDEBAR_SIZE_MIN,
  RIGHT_SIDEBAR_COLLAPSE_HINT_SIZE,
  RIGHT_SIDEBAR_COLLAPSE_SIZE,
  RIGHT_SIDEBAR_SIZE_MIN,
  isInLeftSidebarCollapseHintZone,
  isInRightSidebarCollapseHintZone,
  shouldCollapseLeftSidebar,
  shouldCollapseRightSidebar,
  shouldShowLeftSidebarCollapseHint,
  shouldShowRightSidebarCollapseHint,
} from './preferences'

describe('sidebar layout', () => {
  it('clamps expanded sidebar sizes to their usable range', () => {
    expect(clampLeftSidebarSize(8)).toBe(LEFT_SIDEBAR_SIZE_MIN)
    expect(clampRightSidebarSize(10)).toBe(RIGHT_SIDEBAR_SIZE_MIN)
  })

  it('collapses sidebars resized below their collapse threshold', () => {
    expect(shouldCollapseLeftSidebar(LEFT_SIDEBAR_COLLAPSE_SIZE)).toBe(true)
    expect(shouldCollapseLeftSidebar(LEFT_SIDEBAR_COLLAPSE_SIZE + 1)).toBe(false)
    expect(shouldCollapseRightSidebar(RIGHT_SIDEBAR_COLLAPSE_SIZE)).toBe(true)
    expect(shouldCollapseRightSidebar(RIGHT_SIDEBAR_COLLAPSE_SIZE + 1)).toBe(false)
  })

  it('detects collapse hint zones above the hard collapse threshold', () => {
    expect(isInLeftSidebarCollapseHintZone(LEFT_SIDEBAR_COLLAPSE_HINT_SIZE)).toBe(true)
    expect(isInLeftSidebarCollapseHintZone(LEFT_SIDEBAR_COLLAPSE_HINT_SIZE + 1)).toBe(false)
    expect(isInRightSidebarCollapseHintZone(RIGHT_SIDEBAR_COLLAPSE_HINT_SIZE)).toBe(true)
    expect(isInRightSidebarCollapseHintZone(RIGHT_SIDEBAR_COLLAPSE_HINT_SIZE + 1)).toBe(false)
  })

  it('shows collapse hints only when shrinking into the hint zone', () => {
    expect(shouldShowLeftSidebarCollapseHint(17, 18)).toBe(true)
    expect(shouldShowLeftSidebarCollapseHint(19, 18)).toBe(false)
    expect(shouldShowLeftSidebarCollapseHint(18, 18)).toBe(false)
    expect(shouldShowRightSidebarCollapseHint(20, 24)).toBe(true)
    expect(shouldShowRightSidebarCollapseHint(21, 24)).toBe(false)
    expect(shouldShowRightSidebarCollapseHint(20, 20)).toBe(false)
  })
})
