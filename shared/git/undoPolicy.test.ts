import { describe, expect, it } from 'vitest'
import { journalCaptureFor, journalLabel, isJournalableAction } from '@shared/git/undoPolicy'

describe('undoPolicy', () => {
  it('marks commit and stage actions as journalable', () => {
    expect(isJournalableAction('commit')).toBe(true)
    expect(journalCaptureFor('commit')).toBe('head')
    expect(isJournalableAction('stage')).toBe(true)
    expect(journalCaptureFor('stage')).toBe('index')
  })

  it('does not journal remote operations', () => {
    expect(isJournalableAction('fetch')).toBe(false)
    expect(isJournalableAction('push')).toBe(false)
    expect(isJournalableAction('undo')).toBe(false)
  })

  it('builds human-readable labels', () => {
    expect(journalLabel({ kind: 'commit' })).toBe('Commit')
    expect(journalLabel({ kind: 'stage', target: 'src/app.ts' })).toBe('Stage src/app.ts')
    expect(journalLabel({ kind: 'checkout', target: 'main' })).toBe('Checkout main')
  })
})
