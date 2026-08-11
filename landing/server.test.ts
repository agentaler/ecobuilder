import { describe, expect, test } from 'bun:test'
import { pickLocale } from './server'

describe('pickLocale', () => {
  test('cookie wins over header', () => {
    expect(pickLocale('fr-FR,fr;q=0.9', 'lang=en')).toBe('en')
    expect(pickLocale('en-US', 'theme=x; lang=fr')).toBe('fr')
  })

  test('Accept-Language q-values ranked', () => {
    expect(pickLocale('fr-FR,fr;q=0.9,en;q=0.8', null)).toBe('fr')
    expect(pickLocale('en-US,en;q=0.9', null)).toBe('en')
    expect(pickLocale('de-DE,fr;q=0.7,en;q=0.9', null)).toBe('en')
    expect(pickLocale('de-DE,fr;q=0.9,en;q=0.7', null)).toBe('fr')
  })

  test('unsupported or missing language defaults to en', () => {
    expect(pickLocale('de-DE,es;q=0.9', null)).toBe('en')
    expect(pickLocale(null, null)).toBe('en')
    expect(pickLocale('', '')).toBe('en')
  })

  test('malformed cookie values ignored', () => {
    expect(pickLocale('fr', 'lang=zz')).toBe('fr')
    expect(pickLocale(null, 'lang=')).toBe('en')
  })
})
