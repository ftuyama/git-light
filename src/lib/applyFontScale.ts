import { getCurrentWebview } from '@tauri-apps/api/webview'
import { isTauri } from './backend'

/**
 * Apply the global text scale.
 *
 * This uses webview page zoom (the same mechanism as browser zoom) instead of a
 * CSS font-size multiplier: the UI is built from fixed pixel row heights and
 * font sizes, so scaling only the text would clip dense rows. Page zoom scales
 * text and the layout around it together, keeping the density intact.
 *
 * In the browser/mock build there is no native webview to zoom, so CSS `zoom`
 * is used as a fallback.
 */
export async function applyFontScale(scale: number): Promise<void> {
  const root = document.documentElement
  root.style.removeProperty('zoom')

  if (isTauri()) {
    try {
      await getCurrentWebview().setZoom(scale)
      return
    } catch {
      /* fall through to CSS zoom */
    }
  }

  root.style.setProperty('zoom', String(scale))
}
