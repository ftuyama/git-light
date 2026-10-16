/**
 * Image-file detection for the diff panel. Mirrors `image_mime` in
 * `src-tauri/src/image.rs` — keep both lists in sync.
 */
const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'cur',
  'avif',
  'svg',
])

export function isImagePath(path: string): boolean {
  const trimmed = path.trim()
  if (!trimmed) return false
  const fileName = trimmed.split('/').pop() ?? trimmed
  const dot = fileName.lastIndexOf('.')
  if (dot < 0 || dot === fileName.length - 1) return false
  return IMAGE_EXTENSIONS.has(fileName.slice(dot + 1).toLowerCase())
}

export function formatImageBytes(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return '0 B'
  if (sizeBytes < 1024) return `${sizeBytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = sizeBytes / 1024
  let unit = units[0]
  for (const next of units) {
    unit = next
    if (value < 1024 || next === 'GB') break
    value /= 1024
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${unit}`
}
