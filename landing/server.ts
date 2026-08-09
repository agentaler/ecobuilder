/**
 * Tiny static server for the landing site with locale negotiation.
 *
 * `/` 302-redirects to `/en/` or `/fr/`:
 *   1. explicit `lang` cookie (set whenever a visitor opens a locale tree,
 *      so following the language switcher persists the choice),
 *   2. `Accept-Language` q-values,
 *   3. default `en` (crawlers with no preference land on English).
 *
 * Everything else is static files from `dist/` with long-lived caching for
 * assets and short caching for HTML.
 */
import { join, normalize } from 'node:path'

const DIST = join(import.meta.dir, 'dist')
const PORT = Number(process.env.PORT ?? 4173)
type Locale = 'en' | 'fr'

export function pickLocale(acceptLanguage: string | null, cookie: string | null): Locale {
  const fromCookie = /(?:^|;\s*)lang=(en|fr)(?:;|$)/.exec(cookie ?? '')?.[1]
  if (fromCookie === 'en' || fromCookie === 'fr') return fromCookie
  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(',')
      .map((part) => {
        const [tag, ...params] = part.trim().split(';')
        const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? '1')
        return { lang: tag.trim().slice(0, 2).toLowerCase(), q: Number.isFinite(q) ? q : 0 }
      })
      .sort((a, b) => b.q - a.q)
    for (const { lang } of ranked) {
      if (lang === 'fr') return 'fr'
      if (lang === 'en') return 'en'
    }
  }
  return 'en'
}

function localeCookie(locale: Locale): string {
  return `lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
}

async function serveFile(pathname: string): Promise<Response | null> {
  // Resolve to a normalized path inside dist; reject traversal.
  const clean = normalize(pathname).replaceAll('\\', '/')
  if (clean.includes('..')) return null
  const candidates = clean.endsWith('/')
    ? [`${clean}index.html`]
    : [clean, `${clean}/index.html`]
  for (const rel of candidates) {
    const file = Bun.file(join(DIST, rel))
    if (await file.exists()) {
      const isHtml = rel.endsWith('.html')
      return new Response(file, {
        headers: {
          'cache-control': isHtml ? 'public, max-age=300' : 'public, max-age=86400',
          'x-content-type-options': 'nosniff',
        },
      })
    }
  }
  return null
}

if (import.meta.main) {
  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/health') {
        return Response.json({ status: 'ok' })
      }
      if (url.pathname === '/') {
        const locale = pickLocale(req.headers.get('accept-language'), req.headers.get('cookie'))
        return new Response(null, {
          status: 302,
          headers: {
            location: `/${locale}/`,
            vary: 'Accept-Language, Cookie',
            'cache-control': 'no-store',
          },
        })
      }
      const res = await serveFile(url.pathname)
      if (res) {
        // Visiting a locale tree records the preference for future visits to `/`.
        const localeMatch = /^\/(en|fr)(?:\/|$)/.exec(url.pathname)
        if (localeMatch) res.headers.set('set-cookie', localeCookie(localeMatch[1] as Locale))
        return res
      }
      return new Response('Not found', { status: 404 })
    },
  })
  console.log(`[landing] serving ${DIST} on http://localhost:${PORT}`)
}
