import type { SnapshotScope, WireRepositorySnapshot } from '@shared/git/models'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * Lightweight in-memory cache keyed by repo HEAD + scope. Invalidated on
 * filesystem watcher events or explicit refresh.
 */
export class RepoCache {
  private headKey = ''
  private status: CacheEntry<WireRepositorySnapshot['workingTree']> | null = null
  private branches: CacheEntry<WireRepositorySnapshot['branches']> | null = null
  private ttlMs: number

  constructor(ttlMs = 2_000) {
    this.ttlMs = ttlMs
  }

  setHead(sha: string): void {
    if (sha !== this.headKey) {
      this.headKey = sha
      this.clear()
    }
  }

  clear(): void {
    this.status = null
    this.branches = null
  }

  invalidate(scopes?: SnapshotScope[]): void {
    if (!scopes || scopes.includes('status')) this.status = null
    if (!scopes || scopes.includes('branches')) this.branches = null
  }

  getStatus(): WireRepositorySnapshot['workingTree'] | null {
    return this.read(this.status)
  }

  setStatus(value: WireRepositorySnapshot['workingTree']): void {
    this.status = this.write(value)
  }

  getBranches(): WireRepositorySnapshot['branches'] | null {
    return this.read(this.branches)
  }

  setBranches(value: WireRepositorySnapshot['branches']): void {
    this.branches = this.write(value)
  }

  private write<T>(value: T): CacheEntry<T> {
    return { value, expiresAt: Date.now() + this.ttlMs }
  }

  private read<T>(entry: CacheEntry<T> | null): T | null {
    if (!entry) return null
    if (Date.now() > entry.expiresAt) return null
    return entry.value
  }
}
