import { describe, expect, it } from 'vitest'
import { fileNavTargetIndex, isFileNavKey, isPlainFileNavEvent, selectedFileIndex } from './fileNavigation'
import type { WorkingTreeFile } from '@/types/git'

function file(path: string, staged = false): WorkingTreeFile {
  return {
    id: `file:${path}:${staged ? 'staged' : 'unstaged'}`,
    path,
    fileName: path.split('/').pop() ?? path,
    directory: '',
    status: 'modified',
    staged,
    additions: 1,
    deletions: 0,
  }
}

describe('isFileNavKey', () => {
  it('accepts arrows, home/end and j/k', () => {
    expect(isFileNavKey('ArrowDown')).toBe(true)
    expect(isFileNavKey('arrowup')).toBe(true)
    expect(isFileNavKey('Home')).toBe(true)
    expect(isFileNavKey('end')).toBe(true)
    expect(isFileNavKey('j')).toBe(true)
    expect(isFileNavKey('K')).toBe(true)
  })

  it('rejects other keys', () => {
    expect(isFileNavKey('Enter')).toBe(false)
    expect(isFileNavKey('ArrowLeft')).toBe(false)
    expect(isFileNavKey(' ')).toBe(false)
  })
})

describe('fileNavTargetIndex', () => {
  const count = 4

  it('starts at the first file when nothing is selected', () => {
    expect(fileNavTargetIndex(-1, count, 'ArrowDown')).toBe(0)
    expect(fileNavTargetIndex(-1, count, 'j')).toBe(0)
  })

  it('starts at the last file when nothing is selected and moving up', () => {
    expect(fileNavTargetIndex(-1, count, 'ArrowUp')).toBe(3)
    expect(fileNavTargetIndex(-1, count, 'k')).toBe(3)
  })

  it('moves one row at a time and clamps at both ends', () => {
    expect(fileNavTargetIndex(1, count, 'ArrowDown')).toBe(2)
    expect(fileNavTargetIndex(1, count, 'ArrowUp')).toBe(0)
    expect(fileNavTargetIndex(3, count, 'ArrowDown')).toBe(3)
    expect(fileNavTargetIndex(0, count, 'ArrowUp')).toBe(0)
  })

  it('jumps to the first and last file with Home and End', () => {
    expect(fileNavTargetIndex(2, count, 'Home')).toBe(0)
    expect(fileNavTargetIndex(2, count, 'End')).toBe(3)
  })

  it('returns null for empty lists, other keys and other modifiers', () => {
    expect(fileNavTargetIndex(0, 0, 'ArrowDown')).toBeNull()
    expect(fileNavTargetIndex(0, count, 'Tab')).toBeNull()
  })
})

describe('selectedFileIndex', () => {
  const files = [file('a.ts'), file('b.ts'), file('c.ts', true)]

  it('matches path and staged state', () => {
    expect(selectedFileIndex(files, 'b.ts', false)).toBe(1)
    expect(selectedFileIndex(files, 'c.ts', true)).toBe(2)
  })

  it('does not match a row with the other staged state', () => {
    expect(selectedFileIndex(files, 'a.ts', true)).toBe(-1)
    expect(selectedFileIndex(files, 'c.ts', false)).toBe(-1)
  })

  it('returns -1 without a selection', () => {
    expect(selectedFileIndex(files, null, null)).toBe(-1)
  })
})

function keyEvent(init: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>>): KeyboardEvent {
  return { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...init } as KeyboardEvent
}

describe('isPlainFileNavEvent', () => {
  it('allows bare navigation keys', () => {
    expect(isPlainFileNavEvent(keyEvent({}))).toBe(true)
  })

  it('ignores modifier chords', () => {
    expect(isPlainFileNavEvent(keyEvent({ metaKey: true }))).toBe(false)
    expect(isPlainFileNavEvent(keyEvent({ ctrlKey: true }))).toBe(false)
    expect(isPlainFileNavEvent(keyEvent({ altKey: true }))).toBe(false)
    expect(isPlainFileNavEvent(keyEvent({ shiftKey: true }))).toBe(false)
  })
})
