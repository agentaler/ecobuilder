/**
 * Guards the GDPR/ePrivacy properties of the consent banner that are easy to
 * regress silently in generated markup:
 *   - refusing is offered at the same level as accepting (no dark pattern),
 *   - optional categories ship unchecked (opt-in, never opt-out),
 *   - the choice can be withdrawn later from the footer,
 *   - no analytics/marketing/tracking script is embedded in the page at all,
 *   - the banner is present in both locales.
 */
import { describe, expect, test } from 'bun:test'
import { en } from './src/locales/en'
import { fr } from './src/locales/fr'
import { renderHome } from './src/render'

const pages = [
  ['en', renderHome(en, fr, '/styles.css')],
  ['fr', renderHome(fr, en, '/styles.css')],
] as const

describe('cookie consent banner', () => {
  for (const [locale, html] of pages) {
    test(`${locale}: offers reject as prominently as accept`, () => {
      expect(html).toContain('data-cc-act="reject"')
      expect(html).toContain('data-cc-act="accept"')
      // both sit in the same action row, so neither can be visually demoted
      const actions = html.slice(html.indexOf('cc-actions'), html.indexOf('</div>', html.indexOf('cc-actions')))
      expect(actions).toContain('data-cc-act="reject"')
      expect(actions).toContain('data-cc-act="accept"')
    })

    test(`${locale}: optional categories are opt-in (never pre-checked)`, () => {
      expect(html).toContain('data-cc="analytics"')
      expect(html).toContain('data-cc="marketing"')
      const inputs = html.match(/<input[^>]*>/g) ?? []
      expect(inputs.length).toBe(2)
      for (const input of inputs) expect(input).not.toContain('checked')
    })

    test(`${locale}: consent can be withdrawn from the footer`, () => {
      expect(html).toContain('data-cc-open')
    })

    test(`${locale}: no tracking scripts are embedded`, () => {
      for (const tracker of ['googletagmanager', 'google-analytics', 'gtag(', 'facebook.net', 'hotjar', 'segment.com']) {
        expect(html).not.toContain(tracker)
      }
    })

    test(`${locale}: banner starts hidden and is revealed only by script`, () => {
      expect(html).toContain('id="cc"')
      expect(html).toMatch(/<div id="cc"[^>]*hidden>/)
    })
  }
})
