import { describe, expect, it } from 'vitest'
import { credentialHintFor } from './credentialHints'

describe('credentialHintFor', () => {
  it('returns SSH guidance for authentication errors', () => {
    const hint = credentialHintFor('Authentication')
    expect(hint).toContain('SSH')
  })

  it('returns network guidance', () => {
    expect(credentialHintFor('Network')).toContain('remote URL')
  })

  it('returns undefined for unknown codes', () => {
    expect(credentialHintFor('Unknown')).toBeUndefined()
  })
})
