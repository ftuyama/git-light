import { invoke } from '@tauri-apps/api/core'

/**
 * Download + verify + extract a macOS update asset, then spawn the detached
 * swap script and exit the app (backend exits the process before returning).
 */
export function selfUpdate(assetUrl: string, expectedSha256?: string): Promise<void> {
  return invoke('app_self_update', {
    assetUrl,
    expectedSha256: expectedSha256 ?? null,
  })
}
