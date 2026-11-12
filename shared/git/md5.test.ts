import { describe, expect, it } from 'vitest'
import { md5Hex } from './md5'

describe('md5Hex', () => {
  it('matches the RFC 1321 test vectors', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5Hex('a')).toBe('0cc175b9c0f1b6a831c399e269772661')
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5Hex('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0')
    expect(md5Hex('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b')
    expect(md5Hex('The quick brown fox jumps over the lazy dog')).toBe(
      '9e107d9d372bb6826bd81d3542a419d6',
    )
  })

  it('handles multi-block input', () => {
    expect(md5Hex('a'.repeat(200))).toBe('887f30b43b2867f4a9accceee7d16e6c')
  })

  it('hashes the Gravatar documentation example', () => {
    expect(md5Hex('myemailaddress@example.com')).toBe('0bc83cb571cd1c50ba6f3e8a78ef1346')
  })

  it('hashes UTF-8 text', () => {
    expect(md5Hex('café')).toBe('07117fe4a1ebd544965dc19573183da2')
    expect(md5Hex('é')).not.toBe(md5Hex('e'))
  })
})
