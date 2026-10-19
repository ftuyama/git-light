import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRepoTabsStore } from './repoTabs'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedTabs(paths: string[]): void {
  const tabs = useRepoTabsStore()
  for (const path of paths) tabs.addTab(path, path.split('/').pop() ?? path)
}

describe('repo tabs cycling and restore', () => {
  it('cycles next/prev in visual index order with wrap-around', () => {
    seedTabs(['/a', '/b', '/c'])
    const tabs = useRepoTabsStore()
    expect(tabs.activePath).toBe('/c')

    expect(tabs.cycleTab(1)).toBe('/a')
    expect(tabs.cycleTab(1)).toBe('/b')
    expect(tabs.cycleTab(-1)).toBe('/a')
    expect(tabs.cycleTab(-1)).toBe('/c')
  })

  it('switches by index and to last tab (⌘9 convention)', () => {
    seedTabs(['/a', '/b', '/c'])
    const tabs = useRepoTabsStore()
    expect(tabs.switchToIndex(0)).toBe('/a')
    expect(tabs.switchToLast()).toBe('/c')
    expect(tabs.switchToIndex(99)).toBeNull()
  })

  it('pushes closed tabs onto a bounded restore stack', () => {
    seedTabs(['/a', '/b'])
    const tabs = useRepoTabsStore()
    tabs.removeTab('/b')
    tabs.removeTab('/a')
    expect(tabs.tabs).toEqual([])
    expect(tabs.peekClosed()).toMatchObject({ path: '/a' })

    const first = tabs.reopenLastClosed()
    expect(first).toMatchObject({ path: '/a' })
    expect(tabs.activePath).toBe('/a')
    const second = tabs.reopenLastClosed()
    expect(second).toMatchObject({ path: '/b' })
    expect(tabs.reopenLastClosed()).toBeNull()
  })

  it('applies an explicit tab order', () => {
    seedTabs(['/a', '/b', '/c'])
    const tabs = useRepoTabsStore()

    tabs.reorderTabs(['/c', '/a', '/b'])
    expect(tabs.tabs.map((tab) => tab.path)).toEqual(['/c', '/a', '/b'])

    tabs.reorderTabs(['/b', '/c', '/a'])
    expect(tabs.tabs.map((tab) => tab.path)).toEqual(['/b', '/c', '/a'])
  })

  it('ignores unknown paths and appends omitted tabs when reordering', () => {
    seedTabs(['/a', '/b'])
    const tabs = useRepoTabsStore()

    tabs.reorderTabs(['/missing', '/b'])
    expect(tabs.tabs.map((tab) => tab.path)).toEqual(['/b', '/a'])

    tabs.reorderTabs([])
    expect(tabs.tabs.map((tab) => tab.path)).toEqual(['/b', '/a'])
  })

  it('does not duplicate a restored tab that is already open', () => {
    seedTabs(['/a'])
    const tabs = useRepoTabsStore()
    tabs.addTab('/b', 'b')
    tabs.removeTab('/a')
    tabs.addTab('/a', 'a')
    const restored = tabs.reopenLastClosed()
    expect(restored).toMatchObject({ path: '/a' })
    expect(tabs.tabs.filter((t) => t.path === '/a')).toHaveLength(1)
  })
})
