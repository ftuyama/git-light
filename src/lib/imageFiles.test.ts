import { describe, expect, it } from 'vitest'
import { formatImageBytes, isImagePath } from './imageFiles'

describe('isImagePath', () => {
  it('matches common raster and vector extensions case-insensitively', () => {
    expect(isImagePath('img/photo.png')).toBe(true)
    expect(isImagePath('img/photo.JPG')).toBe(true)
    expect(isImagePath('img/photo.jpeg')).toBe(true)
    expect(isImagePath('img/anim.gif')).toBe(true)
    expect(isImagePath('img/pic.webp')).toBe(true)
    expect(isImagePath('img/icon.svg')).toBe(true)
    expect(isImagePath('img/pic.avif')).toBe(true)
    expect(isImagePath('img/pic.bmp')).toBe(true)
    expect(isImagePath('img/icon.ico')).toBe(true)
  })

  it('rejects non-images and extensionless names', () => {
    expect(isImagePath('archive.zip')).toBe(false)
    expect(isImagePath('doc.pdf')).toBe(false)
    expect(isImagePath('Makefile')).toBe(false)
    expect(isImagePath('img/photo.png ')).toBe(true)
    expect(isImagePath('')).toBe(false)
    expect(isImagePath('img/photo.')).toBe(false)
  })
})

describe('formatImageBytes', () => {
  it('formats bytes and larger units', () => {
    expect(formatImageBytes(0)).toBe('0 B')
    expect(formatImageBytes(512)).toBe('512 B')
    expect(formatImageBytes(2048)).toBe('2.0 KB')
    expect(formatImageBytes(8 * 1024 * 1024)).toBe('8.0 MB')
  })
})
