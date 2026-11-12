/**
 * Minimal MD5 (RFC 1321) hex digest.
 *
 * Gravatar identifies avatars by the MD5 of the lowercased, trimmed email.
 * WebCrypto deliberately omits MD5, so this runs locally without a dependency:
 * the email never leaves the device except as a hash in the image URL.
 */

const SHIFT_AMOUNTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
  14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

/** floor(abs(sin(i + 1)) * 2^32) for i in 0..63, per RFC 1321. */
const SINE_TABLE = Array.from(
  { length: 64 },
  (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0,
)

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

function wordToHex(word: number): string {
  let hex = ''
  for (let index = 0; index < 4; index++) {
    hex += ((word >>> (index * 8)) & 0xff).toString(16).padStart(2, '0')
  }
  return hex
}

/** Lowercase MD5 hex digest of the UTF-8 encoding of `input`. */
export function md5Hex(input: string): string {
  const message = new TextEncoder().encode(input)
  const paddedLength = Math.ceil((message.length + 9) / 64) * 64
  const buffer = new Uint8Array(paddedLength)
  buffer.set(message)
  buffer[message.length] = 0x80

  const view = new DataView(buffer.buffer)
  const bitLength = message.length * 8
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000) >>> 0, true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  const words = new Uint32Array(16)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index++) {
      words[index] = view.getUint32(offset + index * 4, true)
    }

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let index = 0; index < 64; index++) {
      let mixed: number
      let wordIndex: number

      if (index < 16) {
        mixed = (b & c) | (~b & d)
        wordIndex = index
      } else if (index < 32) {
        mixed = (d & b) | (~d & c)
        wordIndex = (5 * index + 1) % 16
      } else if (index < 48) {
        mixed = b ^ c ^ d
        wordIndex = (3 * index + 5) % 16
      } else {
        mixed = c ^ (b | ~d)
        wordIndex = (7 * index) % 16
      }

      mixed = (mixed + a + SINE_TABLE[index]! + words[wordIndex]!) >>> 0
      a = d
      d = c
      c = b
      b = (b + rotateLeft(mixed, SHIFT_AMOUNTS[index]!)) >>> 0
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  return [a0, b0, c0, d0].map(wordToHex).join('')
}
