import type { Catalog } from './locales/types'

const APP_URL = 'https://app.ecobuilder.ai/admin'
const GITHUB_URL = 'https://github.com/agentaler/ecobuilder'
const SITE_ORIGIN = 'https://ecobuilder.ai'

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const leafLogo = `<svg class="logo-mark" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M20 4c-8 0-14 3-15 11 0 2 .6 3.7 1.5 5l1.6-1.4C7 14 10 10.6 15 8.6c-4 2.6-7 6-8.6 9.9A8.6 8.6 0 0 0 11 20c8 0 9-8.5 9-16Z"/></svg>`

function nav(t: Catalog): string {
  return `<header class="nav-wrap"><nav class="nav" aria-label="Main">
  <a class="brand" href="${t.meta.basePath}/">${leafLogo}<span>Ecobuilder</span></a>
  <div class="nav-links">
    <a href="#features">${esc(t.nav.features)}</a>
    <a href="#eco">${esc(t.nav.eco)}</a>
    <a href="#open-source">${esc(t.nav.openSource)}</a>
    <a href="#faq">${esc(t.nav.faq)}</a>
  </div>
  <div class="nav-actions">
    <a class="lang-switch" href="${t.meta.switchPath}/" rel="alternate" hreflang="${t.meta.switchPath === '/fr' ? 'fr' : 'en'}">${esc(t.meta.switchLabel)}</a>
    <a class="btn btn-primary btn-sm" href="${APP_URL}">${esc(t.nav.openApp)}</a>
  </div>
</nav></header>`
}

function hero(t: Catalog): string {
  const stats = t.hero.stats
    .map((s) => `<div class="stat"><div class="stat-value">${esc(s.value)}</div><div class="stat-label">${esc(s.label)}</div></div>`)
    .join('')
  return `<section class="hero">
  <p class="badge">${esc(t.hero.badge)}</p>
  <h1>${esc(t.hero.title)}<br><em>${esc(t.hero.titleAccent)}</em></h1>
  <p class="hero-sub">${esc(t.hero.subtitle)}</p>
  <div class="cta-row">
    <a class="btn btn-primary" href="${APP_URL}">${esc(t.hero.ctaPrimary)}</a>
    <a class="btn btn-ghost" href="${GITHUB_URL}">${esc(t.hero.ctaSecondary)}</a>
  </div>
  <div class="stat-strip">${stats}</div>
</section>`
}

function eco(t: Catalog): string {
  const bars = t.eco.comparison.bars
    .map(
      (b) => `<div class="bar-row${b.highlight ? ' bar-highlight' : ''}">
      <span class="bar-label">${esc(b.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="--w:${b.percent}%"></span></span>
      <span class="bar-value">${esc(b.value)}</span>
    </div>`,
    )
    .join('')
  const points = t.eco.points
    .map((p) => `<div class="point"><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></div>`)
    .join('')
  return `<section class="section" id="eco">
  <p class="kicker">${esc(t.eco.kicker)}</p>
  <h2>${esc(t.eco.title)}</h2>
  <p class="section-body">${esc(t.eco.body)}</p>
  <div class="compare-card">
    <h3>${esc(t.eco.comparison.title)}</h3>
    <div class="bars">${bars}</div>
    <p class="compare-note">${esc(t.eco.comparison.note)}</p>
  </div>
  <div class="point-grid">${points}</div>
</section>`
}

function features(t: Catalog): string {
  const cards = t.features.items
    .map((f) => `<div class="card"><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p></div>`)
    .join('')
  return `<section class="section" id="features">
  <p class="kicker">${esc(t.features.kicker)}</p>
  <h2>${esc(t.features.title)}</h2>
  <div class="card-grid">${cards}</div>
</section>`
}

function europe(t: Catalog): string {
  const points = t.europe.points
    .map((p) => `<div class="point"><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></div>`)
    .join('')
  return `<section class="section section-tinted" id="europe">
  <p class="kicker">${esc(t.europe.kicker)}</p>
  <h2>${esc(t.europe.title)}</h2>
  <p class="section-body">${esc(t.europe.body)}</p>
  <div class="point-grid">${points}</div>
</section>`
}

function openSource(t: Catalog): string {
  return `<section class="section" id="open-source">
  <p class="kicker">${esc(t.openSource.kicker)}</p>
  <h2>${esc(t.openSource.title)}</h2>
  <p class="section-body">${esc(t.openSource.body)}</p>
  <div class="cta-row">
    <a class="btn btn-ghost" href="${GITHUB_URL}">${esc(t.openSource.ctaGithub)}</a>
    <a class="btn btn-primary" href="${APP_URL}">${esc(t.openSource.ctaCloud)}</a>
  </div>
</section>`
}

function faq(t: Catalog): string {
  const items = t.faq.items
    .map(
      (i) => `<details class="faq-item"><summary>${esc(i.q)}</summary><p>${esc(i.a)}</p></details>`,
    )
    .join('')
  return `<section class="section" id="faq">
  <p class="kicker">${esc(t.faq.kicker)}</p>
  <h2>${esc(t.faq.title)}</h2>
  <div class="faq-list">${items}</div>
</section>`
}

function ctaBand(t: Catalog): string {
  return `<section class="cta-band">
  <h2>${esc(t.ctaBand.title)}</h2>
  <p>${esc(t.ctaBand.body)}</p>
  <a class="btn btn-inverse" href="${APP_URL}">${esc(t.ctaBand.cta)}</a>
</section>`
}

function footer(t: Catalog): string {
  return `<footer class="footer">
  <div class="footer-cols">
    <div class="footer-brand">
      <span class="brand">${leafLogo}<span>Ecobuilder</span></span>
      <p>${esc(t.footer.tagline)}</p>
    </div>
    <div>
      <h4>${esc(t.footer.product)}</h4>
      <a href="#features">${esc(t.nav.features)}</a>
      <a href="${GITHUB_URL}">GitHub</a>
      <a href="${APP_URL}">${esc(t.nav.openApp)}</a>
    </div>
    <div>
      <h4>${esc(t.footer.legal)}</h4>
      <a href="${t.meta.basePath}/privacy/">${esc(t.footer.privacy)}</a>
      <a href="${t.meta.basePath}/imprint/">${esc(t.footer.imprint)}</a>
      <a class="lang-switch" href="${t.meta.switchPath}/">${esc(t.meta.switchLabel)}</a>
    </div>
  </div>
  <p class="footer-eu">${esc(t.footer.hostedInEu)}</p>
</footer>`
}

/** Renders the full home page for one locale as a standalone HTML document. */
export function renderHome(t: Catalog, other: Catalog): string {
  return `<!doctype html>
<html lang="${t.meta.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.meta.title)}</title>
<meta name="description" content="${esc(t.meta.description)}">
<link rel="canonical" href="${SITE_ORIGIN}${t.meta.basePath}/">
<link rel="alternate" hreflang="${t.meta.htmlLang}" href="${SITE_ORIGIN}${t.meta.basePath}/">
<link rel="alternate" hreflang="${other.meta.htmlLang}" href="${SITE_ORIGIN}${other.meta.basePath}/">
<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/en/">
<meta property="og:title" content="${esc(t.meta.title)}">
<meta property="og:description" content="${esc(t.meta.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_ORIGIN}${t.meta.basePath}/">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#2f9e63" d="M20 4c-8 0-14 3-15 11 0 2 .6 3.7 1.5 5l1.6-1.4C7 14 10 10.6 15 8.6c-4 2.6-7 6-8.6 9.9A8.6 8.6 0 0 0 11 20c8 0 9-8.5 9-16Z"/></svg>')}">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Ecobuilder',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    url: SITE_ORIGIN,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  })}</script>
</head>
<body>
${nav(t)}
<main>
${hero(t)}
${eco(t)}
${features(t)}
${europe(t)}
${openSource(t)}
${faq(t)}
${ctaBand(t)}
</main>
${footer(t)}
</body>
</html>
`
}
