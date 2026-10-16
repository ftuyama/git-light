import { describe, expect, it } from 'vitest'
import { currentBackend, isTauri } from './backend'

describe('backend detector (Tauri scaffold)', () => {
  it('reports no native backend inside vitest', () => {
    expect(isTauri()).toBe(false)
    expect(currentBackend()).toBe('web')
  })
})
