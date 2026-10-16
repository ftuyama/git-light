import { describe, expect, it } from 'vitest'
import {
  COMMAND_META,
  bindingSignature,
  bindingsEqual,
  defaultKeymap,
  eventToBinding,
  findConflicts,
  formatBinding,
  formatBindings,
  matchesBinding,
  normalizeKey,
  sanitizeKeymap,
} from './keybindings'

function keyEvent(key: string, opts?: { meta?: boolean; shift?: boolean; alt?: boolean }): KeyboardEvent {
  return {
    key,
    metaKey: opts?.meta ?? false,
    ctrlKey: false,
    shiftKey: opts?.shift ?? false,
    altKey: opts?.alt ?? false,
  } as KeyboardEvent
}

describe('keybindings defaults (browser/tab pattern)', () => {
  it('maps Cmd+T to new tab and frees it from terminal', () => {
    const defaults = defaultKeymap()
    expect(defaults.newTab).toEqual([{ key: 't', ctrlMeta: true, shift: false, alt: false }])
    expect(defaults.openTerminal).toEqual([{ key: 'j', ctrlMeta: true, shift: false, alt: false }])
  })

  it('defines next/prev tab, 1-8, last(9), close and reopen', () => {
    const defaults = defaultKeymap()
    expect(defaults.nextTab).toEqual([{ key: 'tab', ctrlMeta: true, shift: false, alt: false }])
    expect(defaults.prevTab).toEqual([{ key: 'tab', ctrlMeta: true, shift: true, alt: false }])
    expect(defaults.switchTab1[0]?.key).toBe('1')
    expect(defaults.switchTab8[0]?.key).toBe('8')
    expect(defaults.switchTabLast[0]?.key).toBe('9')
    expect(defaults.closeTab[0]).toMatchObject({ key: 'w', ctrlMeta: true })
    expect(defaults.reopenClosedTab[0]).toMatchObject({ key: 't', ctrlMeta: true, shift: true })
  })

  it('has metadata for every command id', () => {
    for (const [id, bindings] of Object.entries(defaultKeymap())) {
      expect(COMMAND_META[id as keyof typeof COMMAND_META]).toBeDefined()
      expect(Array.isArray(bindings)).toBe(true)
    }
  })

  it('ships without default conflicts', () => {
    expect(findConflicts(defaultKeymap()).size).toBe(0)
  })
})

describe('sanitizeKeymap', () => {
  it('falls back to defaults for garbage input', () => {
    expect(sanitizeKeymap(null)).toEqual(defaultKeymap())
    expect(sanitizeKeymap({ undo: 'nope' })).toEqual(defaultKeymap())
  })

  it('keeps an explicitly disabled (empty) binding', () => {
    const clean = sanitizeKeymap({ undo: [] })
    expect(clean.undo).toEqual([])
    expect(clean.redo).toEqual(defaultKeymap().redo)
  })

  it('drops unknown ids and invalid entries', () => {
    const clean = sanitizeKeymap({
      undo: [{ key: 'z', ctrlMeta: true, shift: false, alt: false }],
      nope: [{ key: 'x', ctrlMeta: true, shift: false, alt: false }],
    })
    expect((clean as Record<string, unknown>)['nope']).toBeUndefined()
    expect(clean.undo).toEqual([{ key: 'z', ctrlMeta: true, shift: false, alt: false }])
  })
})

describe('matching and formatting', () => {
  it('matches meta as Cmd-or-Ctrl with exact modifiers', () => {
    const binding = { key: 't', ctrlMeta: true, shift: true, alt: false }
    expect(matchesBinding(binding, keyEvent('T', { meta: true, shift: true }))).toBe(true)
    expect(matchesBinding(binding, keyEvent('t', { meta: true }))).toBe(false)
  })

  it('matches Tab and digits', () => {
    expect(matchesBinding({ key: 'tab', ctrlMeta: true, shift: false, alt: false }, keyEvent('Tab', { meta: true }))).toBe(true)
    expect(matchesBinding({ key: '1', ctrlMeta: true, shift: false, alt: false }, keyEvent('1', { meta: true }))).toBe(true)
  })

  it('round-trips eventToBinding with bindingsEqual', () => {
    const event = keyEvent('Z', { meta: true, shift: true })
    expect(bindingsEqual(eventToBinding(event), { key: 'z', ctrlMeta: true, shift: true, alt: false })).toBe(true)
    expect(bindingSignature(eventToBinding(event))).toBe('z|1|1|0')
  })

  it('normalizes space', () => {
    expect(normalizeKey(' ')).toBe('space')
  })

  it('formats mac and win labels', () => {
    const binding = { key: 't', ctrlMeta: true, shift: true, alt: false }
    expect(formatBinding(binding, true)).toBe('⌘⇧T')
    expect(formatBinding(binding, false)).toBe('Ctrl+Shift+T')
    expect(formatBindings([], true)).toBe('—')
  })

  it('detects conflicts across commands', () => {
    const keymap = defaultKeymap()
    keymap.redo = [{ key: 'z', ctrlMeta: true, shift: false, alt: false }]
    const conflicts = findConflicts(keymap)
    expect(conflicts.get('z|1|0|0')).toEqual(expect.arrayContaining(['undo', 'redo']))
  })
})
