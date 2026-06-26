import { describe, expect, it } from 'vitest'
import { scopesForAction } from './snapshotScopes'

describe('scopesForAction', () => {
  it('returns undefined for refresh (full snapshot)', () => {
    expect(scopesForAction('refresh')).toBeUndefined()
  })

  it('refreshes tags and commits for tag actions', () => {
    expect(scopesForAction('create-tag')).toEqual(['tags', 'commits'])
    expect(scopesForAction('delete-tag')).toEqual(['tags', 'commits'])
    expect(scopesForAction('tag')).toEqual(['tags', 'commits'])
  })

  it('refreshes stashes and status for stash actions', () => {
    expect(scopesForAction('stash')).toEqual(['stashes', 'status'])
    expect(scopesForAction('pop-stash')).toEqual(['stashes', 'status'])
    expect(scopesForAction('apply-stash')).toEqual(['stashes', 'status'])
    expect(scopesForAction('drop-stash')).toEqual(['stashes', 'status'])
    expect(scopesForAction('rename-stash')).toEqual(['stashes', 'status'])
  })

  it('refreshes status only for staging and conflict resolution', () => {
    expect(scopesForAction('stage')).toEqual(['status'])
    expect(scopesForAction('stage-all')).toEqual(['status'])
    expect(scopesForAction('resolve-conflict-ours')).toEqual(['status'])
    expect(scopesForAction('mark-conflict-resolved')).toEqual(['status'])
  })

  it('refreshes commits, branches, and status for integration actions', () => {
    expect(scopesForAction('merge')).toEqual(['commits', 'branches', 'status'])
    expect(scopesForAction('rebase')).toEqual(['commits', 'branches', 'status'])
    expect(scopesForAction('cherry-pick')).toEqual(['commits', 'branches', 'status'])
    expect(scopesForAction('reset-hard')).toEqual(['commits', 'branches', 'status'])
  })

  it('refreshes remote-related scopes for fetch and push', () => {
    expect(scopesForAction('fetch')).toEqual(['branches', 'commits', 'status'])
    expect(scopesForAction('push')).toEqual(['branches', 'commits', 'status'])
  })

  it('refreshes commits and status for commit actions', () => {
    expect(scopesForAction('commit')).toEqual(['commits', 'status'])
    expect(scopesForAction('amend')).toEqual(['commits', 'status'])
  })
})
