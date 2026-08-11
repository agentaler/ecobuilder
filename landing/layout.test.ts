/**
 * Static guards against horizontal overflow on small screens.
 *
 * A decorative layer once used `max-width: 120vw` while animating sideways,
 * which intermittently made the whole page scroll horizontally on phones —
 * invisible to DOM inspection because it lived on a pseudo-element. These
 * assertions keep viewport-exceeding widths and the root clip in place.
 */
import { describe, expect, test } from 'bun:test'

const css = await Bun.file(new URL('./src/styles.css', import.meta.url)).text()

describe('landing layout safety', () => {
  test('no rule sizes an element wider than the viewport', () => {
    // e.g. `width: 120vw`, `max-width: 140vw`, `min-width: 105vw`
    const offenders = [...css.matchAll(/(?:^|[\s;{])(?:min-|max-)?(?:width|inline-size)\s*:\s*[^;}]*?(\d+(?:\.\d+)?)vw/g)]
      .map((m) => ({ vw: Number(m[1]), rule: m[0].trim() }))
      .filter((o) => o.vw > 100)
    expect(offenders).toEqual([])
  })

  test('the root clips horizontal overflow without breaking sticky', () => {
    expect(css).toMatch(/overflow-x:\s*clip/)
    // `overflow: hidden` on html/body would break the sticky header
    expect(css).not.toMatch(/^\s*(?:html|body)[^{]*\{[^}]*overflow\s*:\s*hidden/m)
  })

  test('wide tables scroll inside their own container', () => {
    expect(css).toMatch(/\.lg-table-wrap\s*\{[^}]*overflow-x:\s*auto/)
  })
})
