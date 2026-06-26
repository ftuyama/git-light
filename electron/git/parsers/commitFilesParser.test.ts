import { describe, expect, it } from 'vitest'
import { parseCommitFiles } from './commitFilesParser'

describe('parseCommitFiles', () => {
  it('parses modified and added files', () => {
    const nameStatus = 'M\0src/foo.ts\0A\0src/bar.ts\0'
    const numstat = '10\t5\tsrc/foo.ts\0' + '20\t0\tsrc/bar.ts\0'
    const files = parseCommitFiles(nameStatus, numstat)

    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({
      path: 'src/foo.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
    })
    expect(files[1]).toMatchObject({
      path: 'src/bar.ts',
      status: 'added',
      additions: 20,
      deletions: 0,
    })
  })

  it('parses renames with old path', () => {
    const nameStatus = 'R100\0src/old.ts\0src/new.ts\0'
    const numstat = '3\t3\tsrc/new.ts\0'
    const files = parseCommitFiles(nameStatus, numstat)

    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({
      path: 'src/new.ts',
      oldPath: 'src/old.ts',
      status: 'renamed',
    })
  })

  it('parses real diff-tree -z output with mixed change types', () => {
    // Typical `git diff-tree --no-commit-id --name-status -z -r <sha>` records.
    const nameStatus =
      'M\0electron/git/GitProvider.ts\0' +
      'A\0electron/git/parsers/commitFilesParser.ts\0' +
      'R100\0src/old-name.ts\0src/new-name.ts\0'
    const numstat =
      '45\t12\telectron/git/GitProvider.ts\0' +
      '67\t0\telectron/git/parsers/commitFilesParser.ts\0' +
      '3\t3\tsrc/new-name.ts\0'
    const files = parseCommitFiles(nameStatus, numstat)

    expect(files).toHaveLength(3)
    expect(files[0]).toMatchObject({
      path: 'electron/git/GitProvider.ts',
      status: 'modified',
      additions: 45,
      deletions: 12,
    })
    expect(files[1]).toMatchObject({
      path: 'electron/git/parsers/commitFilesParser.ts',
      status: 'added',
      additions: 67,
      deletions: 0,
    })
    expect(files[2]).toMatchObject({
      path: 'src/new-name.ts',
      oldPath: 'src/old-name.ts',
      status: 'renamed',
      additions: 3,
      deletions: 3,
    })
  })

  it('deduplicates paths from merge -m output', () => {
    const nameStatus = 'M\0src/foo.ts\0M\0src/foo.ts\0'
    const numstat = '10\t5\tsrc/foo.ts\0' + '3\t1\tsrc/foo.ts\0'
    const files = parseCommitFiles(nameStatus, numstat)

    expect(files).toHaveLength(1)
    expect(files[0]?.path).toBe('src/foo.ts')
  })
})
