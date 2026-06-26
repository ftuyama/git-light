/** Stable Gravatar URL for a commit author email (404 when no image is registered). */
export function gravatarUrl(email: string, size = 80): string {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return ''
  const hash = md5(normalized)
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=${size}`
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Compact MD5 — works in both Electron main and Vite renderer bundles. */
function md5(input: string): string {
  function rotateLeft(value: number, shift: number): number {
    return (value << shift) | (value >>> (32 - shift))
  }

  function toWords(str: string): number[] {
    const bytes = new TextEncoder().encode(str)
    const bitLength = bytes.length * 8
    const words: number[] = []
    for (let i = 0; i < bytes.length; i++) {
      words[i >> 2] |= bytes[i] << ((i % 4) * 8)
    }
    words[bitLength >> 5] |= 0x80 << bitLength % 32
    words[(((bitLength + 64) >>> 9) << 4) + 14] = bitLength
    return words
  }

  function wordToHex(value: number): string {
    let hex = ''
    for (let i = 0; i < 4; i++) {
      hex += ((value >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    }
    return hex
  }

  const words = toWords(input)
  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476

  for (let i = 0; i < words.length; i += 16) {
    const originalA = a
    const originalB = b
    const originalC = c
    const originalD = d

    const rounds = [
      [0, 7, 0xd76aa478], [1, 12, 0xe8c7b756], [2, 17, 0x242070db], [3, 22, 0xc1bdceee],
      [4, 7, 0xf57c0faf], [5, 12, 0x4787c62a], [6, 17, 0xa8304613], [7, 22, 0xfd469501],
      [8, 7, 0x698098d8], [9, 12, 0x8b44f7af], [10, 17, 0xffff5bb1], [11, 22, 0x895cd7be],
      [12, 7, 0x6b901122], [13, 12, 0xfd987193], [14, 17, 0xa679438e], [15, 22, 0x49b40821],
      [1, 5, 0xf61e2562], [6, 9, 0xc040b340], [11, 14, 0x265e5a51], [0, 20, 0xe9b6c7aa],
      [5, 5, 0xd62f105d], [10, 9, 0x02441453], [15, 14, 0xd8a1e681], [4, 20, 0xe7d3fbc8],
      [9, 5, 0x21e1cde6], [14, 9, 0xc33707d6], [3, 14, 0xf4d50d87], [8, 20, 0x455a14ed],
      [13, 5, 0xa9e3e905], [2, 9, 0xfcefa3f8], [7, 14, 0x676f02d9], [12, 20, 0x8d2a4c8a],
      [5, 4, 0xfffa3942], [8, 11, 0x8771f681], [11, 16, 0x6d9d6122], [14, 23, 0xfde5380c],
      [1, 4, 0xa4beea44], [4, 11, 0x4bdecfa9], [7, 16, 0xf6bb4b60], [10, 23, 0xbebfbc70],
      [13, 4, 0x289b7ec6], [0, 11, 0xeaa127fa], [3, 16, 0xd4ef3085], [6, 23, 0x04881d05],
      [9, 4, 0xd9d4d039], [12, 11, 0xe6db99e5], [15, 16, 0x1fa27cf8], [2, 23, 0xc4ac5665],
      [0, 6, 0xf4292244], [7, 10, 0x432aff97], [14, 15, 0xab9423a7], [5, 21, 0xfc93a039],
      [12, 6, 0x655b59c3], [3, 10, 0x8f0ccc92], [10, 15, 0xffeff47d], [1, 21, 0x85845dd1],
      [8, 6, 0x6fa87e4f], [15, 10, 0xfe2ce6e0], [6, 15, 0xa3014314], [13, 21, 0x4e0811a1],
      [4, 6, 0xf7537e82], [11, 10, 0xbd3af235], [2, 15, 0x2ad7d2bb], [9, 21, 0xeb86d391],
    ] as const

    for (const [index, shift, constant] of rounds) {
      const f =
        index < 16
          ? (b & c) | (~b & d)
          : index < 32
            ? (d & b) | (~d & c)
            : index < 48
              ? b ^ c ^ d
              : c ^ (b | ~d)
      const temp = b + rotateLeft(a + f + constant + (words[i + index] ?? 0), shift)
      a = d
      d = c
      c = b
      b = b + temp
    }

    a = (a + originalA) | 0
    b = (b + originalB) | 0
    c = (c + originalC) | 0
    d = (d + originalD) | 0
  }

  return [a, b, c, d].map(wordToHex).join('')
}
