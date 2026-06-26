import { describe, expect, it } from 'vitest'
import { formatRebaseTodo } from './rebaseSequenceEditor'

describe('formatRebaseTodo', () => {
  it('formats actions oldest-first with full sha', () => {
    const todo = formatRebaseTodo([
      { action: 'pick', sha: 'aaa1111', subject: 'First commit' },
      { action: 'squash', sha: 'bbb2222', subject: 'Second commit' },
      { action: 'drop', sha: 'ccc3333', subject: 'Remove me' },
    ])

    expect(todo).toBe(
      'pick aaa1111 First commit\nsquash bbb2222 Second commit\ndrop ccc3333 Remove me\n',
    )
  })
})
