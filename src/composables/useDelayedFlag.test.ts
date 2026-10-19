import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { useDelayedFlag } from './useDelayedFlag'

let scope: EffectScope

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

describe('useDelayedFlag', () => {
  it('stays false until the source has been on for the delay', async () => {
    const source = ref(false)
    const flag = scope.run(() => useDelayedFlag(source, 120))!

    expect(flag.value).toBe(false)

    source.value = true
    await nextTick()
    vi.advanceTimersByTime(119)
    expect(flag.value).toBe(false)

    vi.advanceTimersByTime(1)
    expect(flag.value).toBe(true)
  })

  it('drops immediately when the source turns off', async () => {
    const source = ref(true)
    const flag = scope.run(() => useDelayedFlag(source, 120))!

    vi.advanceTimersByTime(120)
    expect(flag.value).toBe(true)

    source.value = false
    await nextTick()
    expect(flag.value).toBe(false)
  })

  it('never shows for a source that comes and goes within the delay', async () => {
    const source = ref(false)
    const flag = scope.run(() => useDelayedFlag(source, 120))!

    source.value = true
    await nextTick()
    vi.advanceTimersByTime(60)
    source.value = false
    await nextTick()
    vi.advanceTimersByTime(500)

    expect(flag.value).toBe(false)
  })

  it('clears the pending timer when the owning scope is disposed', async () => {
    const source = ref(false)
    const flag = scope.run(() => useDelayedFlag(source, 120))!

    source.value = true
    await nextTick()
    scope.stop()
    vi.advanceTimersByTime(500)

    expect(flag.value).toBe(false)
  })
})
