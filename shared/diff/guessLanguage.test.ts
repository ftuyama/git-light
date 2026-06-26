import { describe, expect, it } from 'vitest'
import { guessLanguage } from './guessLanguage'

describe('guessLanguage', () => {
  it('maps Ruby extensions', () => {
    expect(guessLanguage('app/models/user.rb')).toBe('ruby')
    expect(guessLanguage('lib/tasks/deploy.rake')).toBe('ruby')
    expect(guessLanguage('my_gem.gemspec')).toBe('ruby')
    expect(guessLanguage('app/views/show.html.erb')).toBe('ruby')
  })

  it('maps JavaScript extensions', () => {
    expect(guessLanguage('src/index.js')).toBe('javascript')
    expect(guessLanguage('src/App.jsx')).toBe('javascript')
    expect(guessLanguage('dist/index.mjs')).toBe('javascript')
    expect(guessLanguage('config.cjs')).toBe('javascript')
  })

  it('maps TypeScript extensions', () => {
    expect(guessLanguage('src/main.ts')).toBe('typescript')
    expect(guessLanguage('src/App.tsx')).toBe('typescript')
    expect(guessLanguage('src/worker.mts')).toBe('typescript')
    expect(guessLanguage('config.cts')).toBe('typescript')
  })

  it('maps other known extensions', () => {
    expect(guessLanguage('main.py')).toBe('python')
    expect(guessLanguage('lib.rs')).toBe('rust')
    expect(guessLanguage('README.md')).toBe('markdown')
  })

  it('returns plaintext for unknown extensions', () => {
    expect(guessLanguage('Gemfile')).toBe('plaintext')
    expect(guessLanguage('data.bin')).toBe('plaintext')
  })
})
