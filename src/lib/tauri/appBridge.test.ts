import { describe, expect, it, vi } from 'vitest'
import { openExternalUrl, setWindowBackground } from './appBridge'

function stubWindow(value: unknown): void {
  ;(globalThis as unknown as { window: unknown }).window = value
}

const TAURI_WINDOW = { __TAURI_INTERNALS__: {} }

describe('tauri appBridge', () => {
  it('opens urls via the tauri opener', async () => {
    const opener = vi.fn(async () => {})
    stubWindow(TAURI_WINDOW)
    try {
      await openExternalUrl('https://example.com', opener)
      expect(opener).toHaveBeenCalledWith('https://example.com')
    } finally {
      stubWindow(undefined)
    }
  })

  it('sets window background via the tauri setter', async () => {
    const setter = vi.fn(async () => {})
    stubWindow(TAURI_WINDOW)
    try {
      await setWindowBackground('#fff', setter)
      expect(setter).toHaveBeenCalledWith('#fff')
    } finally {
      stubWindow(undefined)
    }
  })

  it('swallows setter failures', async () => {
    stubWindow(TAURI_WINDOW)
    try {
      await expect(
        setWindowBackground('#fff', async () => {
          throw new Error('unsupported')
        }),
      ).resolves.toBeUndefined()
    } finally {
      stubWindow(undefined)
    }
  })

  it('is a no-op without the tauri runtime', async () => {
    stubWindow({})
    const opener = vi.fn()
    await expect(openExternalUrl('https://example.com', opener)).resolves.toBeUndefined()
    expect(opener).not.toHaveBeenCalled()
    stubWindow(undefined)
  })
})
