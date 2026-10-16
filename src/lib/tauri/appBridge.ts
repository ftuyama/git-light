import { openUrl } from '@tauri-apps/plugin-opener'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { isTauri } from '../backend'

export type OpenUrlFn = (url: string) => Promise<void>
export type SetBackgroundFn = (color: string) => Promise<void>

const defaultOpenUrl: OpenUrlFn = (url) => openUrl(url)

const defaultSetBackground: SetBackgroundFn = (color) =>
  getCurrentWebviewWindow().setBackgroundColor(color)

/** Open a URL in the system browser on either backend (no-op without a bridge). */
export async function openExternalUrl(url: string, opener: OpenUrlFn = defaultOpenUrl): Promise<void> {
  if (isTauri()) {
    await opener(url)
    return
  }
}

/** Match the native window background to the theme (no-op without a bridge). */
export async function setWindowBackground(
  color: string,
  setter: SetBackgroundFn = defaultSetBackground,
): Promise<void> {
  if (isTauri()) {
    try {
      await setter(color)
    } catch {
      /* webview may not support background colors */
    }
  }
}
