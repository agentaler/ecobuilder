/**
 * Static site generator for the Ecobuilder landing page.
 *
 * Emits a fully static tree under landing/dist/:
 *   /styles.css
 *   /en/index.html   /fr/index.html
 *   /en/privacy/…    /fr/privacy/…    (+ imprint)
 *   /sitemap.xml     /robots.txt
 *
 * Locale parity is enforced at compile time: both catalogs implement the
 * `Catalog` interface, so `bun build`/tsc fails on any missing key.
 */
import { mkdir, rm, cp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { en } from './src/locales/en'
import { fr } from './src/locales/fr'
import { renderHome } from './src/render'
import { renderLegalPage } from './src/legal'

const OUT = join(import.meta.dir, 'dist')
const SITE_ORIGIN = 'https://ecobuilder.ai'

async function writePage(path: string, html: string): Promise<void> {
  const file = join(OUT, path)
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, html)
}

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

// Content-hash the stylesheet URL so redeploys bust long-lived asset caches —
// stale CSS against fresh HTML renders the page broken.
const css = await Bun.file(join(import.meta.dir, 'src', 'styles.css')).text()
const cssHref = `/styles.css?v=${Bun.hash(css).toString(16).slice(0, 10)}`
await cp(join(import.meta.dir, 'src', 'styles.css'), join(OUT, 'styles.css'))
await cp(join(import.meta.dir, 'assets'), join(OUT, 'assets'), { recursive: true })

for (const [t, other] of [
  [en, fr],
  [fr, en],
] as const) {
  const base = t.meta.basePath.slice(1)
  await writePage(`${base}/index.html`, renderHome(t, other, cssHref))
  await writePage(`${base}/privacy/index.html`, renderLegalPage(t, 'privacy', cssHref))
  await writePage(`${base}/imprint/index.html`, renderLegalPage(t, 'imprint', cssHref))
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[en, fr]
  .map(
    (t) => `  <url>
    <loc>${SITE_ORIGIN}${t.meta.basePath}/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_ORIGIN}/en/"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${SITE_ORIGIN}/fr/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/en/"/>
  </url>`,
  )
  .join('\n')}
</urlset>
`
await writeFile(join(OUT, 'sitemap.xml'), sitemap)
await writeFile(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`)

console.log('[landing] built to', OUT)
