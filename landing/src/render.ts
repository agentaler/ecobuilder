import type { Catalog } from './locales/types'

const APP_URL = 'https://app.ecobuilder.ai/admin'
const SALES_URL = 'mailto:hello@ecobuilder.ai'
const SITE_ORIGIN = 'https://ecobuilder.ai'

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * The Ecobuilder mark: a gradient green tile with an organic leaf in negative
 * space — curved stem flowing out of the corner into an asymmetric blade with
 * a single vein. Fixed brand colors so the mark is identical everywhere.
 * `id` must be unique per inline instance (SVG gradient ids are global).
 */
const MARK_SVG = (size: number, id: string) =>
  `<svg class="logo-mark" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#2fa869"/><stop offset="1" stop-color="#155c38"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#${id})"/><path d="M25.9 6.1C26.6 15.7 20.3 23.6 11 24.8 9.3 15.3 15.9 7.3 25.9 6.1Z" fill="#ffffff"/><path d="M6 27.2C8.9 26.9 11.6 25.9 14 24.2" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M13.2 21.9C17.6 20.4 21.6 16.4 23.2 11.5" stroke="#1c7047" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`
const brandLockup = (id: string) =>
  `${MARK_SVG(30, id)}<span class="brand-word"><b>eco</b>builder</span>`

function nav(t: Catalog): string {
  return `<header class="nav-wrap"><nav class="nav" aria-label="Main">
  <a class="brand" href="${t.meta.basePath}/">${brandLockup('nav-mark')}</a>
  <div class="nav-links">
    <a href="#features">${esc(t.nav.features)}</a>
    <a href="#eco">${esc(t.nav.eco)}</a>
    <a href="#pricing">${esc(t.nav.pricing)}</a>
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
  <div class="hero-aurora" aria-hidden="true"></div>
  <svg class="hero-leaf" viewBox="0 0 32 32" aria-hidden="true"><path d="M25.5 6.5C25.5 17 17 25.5 6.5 25.5 6.5 15 15 6.5 25.5 6.5Z" fill="currentColor"/></svg>
  <p class="badge intro intro-1">${esc(t.hero.badge)}</p>
  <h1 class="intro intro-2">${esc(t.hero.title)}<br><em>${esc(t.hero.titleAccent)}</em></h1>
  <p class="hero-sub intro intro-3">${esc(t.hero.subtitle)}</p>
  <div class="cta-row intro intro-4">
    <a class="btn btn-primary btn-glow" href="${APP_URL}">${esc(t.hero.ctaPrimary)}</a>
    <a class="btn btn-ghost" href="#pricing">${esc(t.hero.ctaSecondary)}</a>
  </div>
  <div class="stat-strip border-beam intro intro-5">${stats}</div>
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
    .map((p) => `<div class="point reveal"><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></div>`)
    .join('')
  return `<section class="section" id="eco">
  <p class="kicker reveal">${esc(t.eco.kicker)}</p>
  <h2>${esc(t.eco.title)}</h2>
  <p class="section-body">${esc(t.eco.body)}</p>
  <div class="compare-card reveal">
    <h3>${esc(t.eco.comparison.title)}</h3>
    <div class="bars">${bars}</div>
    <p class="compare-note">${esc(t.eco.comparison.note)}</p>
  </div>
  <div class="point-grid">${points}</div>
</section>`
}

function features(t: Catalog): string {
  const cards = t.features.items
    .map((f) => `<div class="card reveal"><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p></div>`)
    .join('')
  return `<section class="section" id="features">
  <p class="kicker reveal">${esc(t.features.kicker)}</p>
  <h2>${esc(t.features.title)}</h2>
  <div class="card-grid">${cards}</div>
</section>`
}

function europe(t: Catalog): string {
  const points = t.europe.points
    .map((p) => `<div class="point reveal"><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></div>`)
    .join('')
  return `<section class="section section-tinted" id="europe">
  <p class="kicker reveal">${esc(t.europe.kicker)}</p>
  <h2>${esc(t.europe.title)}</h2>
  <p class="section-body">${esc(t.europe.body)}</p>
  <div class="point-grid">${points}</div>
</section>`
}

function pricing(t: Catalog): string {
  const tiers = t.pricing.tiers
    .map((tier) => {
      const features = tier.features.map((f) => `<li>${esc(f)}</li>`).join('')
      const ctaHref = tier.custom ? SALES_URL : APP_URL
      const ctaClass = tier.highlight ? 'btn-primary' : 'btn-ghost'
      return `<div class="tier reveal${tier.highlight ? ' tier-highlight border-beam' : ''}">
      <h3>${esc(tier.name)}</h3>
      <p class="tier-desc">${esc(tier.description)}</p>
      <p class="tier-price">${esc(tier.price)}<span>${esc(tier.period)}</span></p>
      <p class="tier-billing">${esc(tier.billingNote)}</p>
      <ul class="tier-features">${features}</ul>
      <a class="btn ${ctaClass}" href="${ctaHref}">${esc(tier.cta)}</a>
    </div>`
    })
    .join('')
  return `<section class="section" id="pricing">
  <p class="kicker reveal">${esc(t.pricing.kicker)}</p>
  <h2>${esc(t.pricing.title)}</h2>
  <p class="section-body">${esc(t.pricing.body)}</p>
  <div class="tier-grid">${tiers}</div>
  <p class="pricing-note">${esc(t.pricing.note)}</p>
</section>`
}

function faq(t: Catalog): string {
  const items = t.faq.items
    .map(
      (i) => `<details class="faq-item reveal"><summary>${esc(i.q)}</summary><p>${esc(i.a)}</p></details>`,
    )
    .join('')
  return `<section class="section" id="faq">
  <p class="kicker reveal">${esc(t.faq.kicker)}</p>
  <h2>${esc(t.faq.title)}</h2>
  <div class="faq-list">${items}</div>
</section>`
}

function ctaBand(t: Catalog): string {
  return `<section class="cta-band reveal">
  <h2>${esc(t.ctaBand.title)}</h2>
  <p>${esc(t.ctaBand.body)}</p>
  <a class="btn btn-inverse" href="${APP_URL}">${esc(t.ctaBand.cta)}</a>
</section>`
}

function footer(t: Catalog): string {
  return `<footer class="footer">
  <div class="footer-cols">
    <div class="footer-brand">
      <span class="brand">${brandLockup('footer-mark')}</span>
      <p>${esc(t.footer.tagline)}</p>
    </div>
    <div>
      <h4>${esc(t.footer.product)}</h4>
      <a href="#features">${esc(t.nav.features)}</a>
      <a href="#pricing">${esc(t.nav.pricing)}</a>
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
<meta name="theme-color" content="#060807">
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
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#2fa869"/><stop offset="1" stop-color="#155c38"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#g)"/><path d="M25.9 6.1C26.6 15.7 20.3 23.6 11 24.8 9.3 15.3 15.9 7.3 25.9 6.1Z" fill="#fff"/><path d="M6 27.2C8.9 26.9 11.6 25.9 14 24.2" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M13.2 21.9C17.6 20.4 21.6 16.4 23.2 11.5" stroke="#1c7047" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`)}">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Ecobuilder',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    url: SITE_ORIGIN,
    offers: { '@type': 'Offer', price: '29', priceCurrency: 'EUR' },
  })}</script>
</head>
<body>
${nav(t)}
<main>
${hero(t)}
${eco(t)}
${features(t)}
${europe(t)}
${pricing(t)}
${faq(t)}
${ctaBand(t)}
</main>
${footer(t)}
<noscript><style>.reveal{opacity:1;translate:none}</style></noscript>
<script>const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}},{threshold:.15});document.querySelectorAll('.reveal').forEach(el=>io.observe(el));</script>
</body>
</html>
`
}
