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
  `<svg class="logo-mark" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#39b877"/><stop offset="1" stop-color="#125433"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#${id})"/><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#${id}s)"/><path d="M24.8 7.2C25.7 16.2 19.3 23.4 10.2 24.4 9.3 15.4 15.7 8.2 24.8 7.2Z" fill="#ffffff"/><path d="M11.6 23C15.9 21.3 20.2 17 21.9 12.6" stroke="#14603a" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`
const brandLockup = (id: string) =>
  `${MARK_SVG(30, id)}<span class="brand-word"><b>eco</b>builder</span>`

function nav(t: Catalog): string {
  const otherLang = t.meta.switchPath === '/fr' ? 'fr' : 'en'
  const links = [
    ['#how', t.nav.how],
    ['#eco', t.nav.eco],
    ['#features', t.nav.features],
    ['#services', t.services.kicker],
    ['#pricing', t.nav.pricing],
    ['#faq', t.nav.faq],
  ] as const
  const linkList = (cls: string) =>
    links.map(([href, label]) => `<a class="${cls}" href="${href}">${esc(label)}</a>`).join('')
  return `<header class="nav-wrap"><nav class="nav" aria-label="Main">
  <a class="brand" href="${t.meta.basePath}/">${brandLockup('nav-mark')}</a>
  <div class="nav-links">${linkList('')}</div>
  <div class="nav-actions">
    <a class="lang-switch" href="${t.meta.switchPath}/" rel="alternate" hreflang="${otherLang}">${esc(t.meta.switchLabel)}</a>
    <a class="btn btn-primary btn-sm" href="${APP_URL}">${esc(t.nav.openApp)}</a>
  </div>
  <details class="mnav">
    <summary aria-label="Menu"><span class="bars"><i></i><i></i><i></i></span></summary>
    <div class="mnav-panel">
      ${linkList('mnav-link')}
      <a class="btn btn-primary mnav-cta" href="${APP_URL}">${esc(t.nav.openApp)}</a>
      <a class="mnav-lang" href="${t.meta.switchPath}/" rel="alternate" hreflang="${otherLang}">${esc(t.meta.switchLabel)}</a>
    </div>
  </details>
</nav></header>`
}

/**
 * Static "letter rain" field behind the hero — columns of dim letters with a
 * few glowing ones, generated deterministically at build time (seeded LCG, so
 * builds stay reproducible). Pure markup + CSS; no runtime JS.
 */
function letterRain(): string {
  let seed = 0x5eedc0de
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  const chars = 'ECOBUILDRHTMLCSSVANTPKY'
  const columns: string[] = []
  for (let c = 0; c < 26; c++) {
    // Bias columns toward the beam in the center (sum of three uniforms ≈ normal)
    const x = Math.min(97, Math.max(2, 50 + ((rand() + rand() + rand()) / 1.5 - 1) * 52))
    const nearBeam = Math.abs(x - 50) < 20
    const y = -10 + rand() * 34
    const dur = (7 + rand() * 8).toFixed(1)
    const count = 8 + Math.floor(rand() * 11)
    let letters = ''
    for (let i = 0; i < count; i++) {
      const ch = chars[Math.floor(rand() * chars.length)]
      const glowChance = nearBeam ? 0.24 : 0.08
      if (rand() < glowChance) {
        const teal = rand() < 0.4 ? ' class="t"' : ''
        letters += `<b${teal} style="--gd:${(rand() * 4).toFixed(1)}s">${ch}</b>`
      } else {
        letters += ch
      }
      if (i < count - 1) letters += '\n'
    }
    columns.push(`<span class="lcol" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(0)}%;--dur:${dur}s">${letters}</span>`)
  }
  return `<div class="letter-field" aria-hidden="true">${columns.join('')}</div>`
}

function hero(t: Catalog): string {
  const stats = t.hero.stats
    .map((s) => `<div class="stat"><div class="stat-value">${esc(s.value)}</div><div class="stat-label">${esc(s.label)}</div></div>`)
    .join('')
  let dustSeed = 0xd05e77e
  const dustRand = () => {
    dustSeed = (dustSeed * 1664525 + 1013904223) >>> 0
    return dustSeed / 0xffffffff
  }
  const dust = Array.from({ length: 14 }, () => {
    const x = 38 + dustRand() * 24
    const s = (1.5 + dustRand() * 2.5).toFixed(1)
    const dur = (7 + dustRand() * 9).toFixed(1)
    const d = (dustRand() * 10).toFixed(1)
    const drift = ((dustRand() - 0.5) * 70).toFixed(0)
    return `<i style="--x:${x.toFixed(1)}%;--s:${s}px;--dur:${dur}s;--d:${d}s;--drift:${drift}px"></i>`
  }).join('')
  return `<section class="hero">
  <div class="hero-aurora" aria-hidden="true"></div>
  ${letterRain()}
  <div class="hero-beam" aria-hidden="true"></div>
  <div class="hero-dust" aria-hidden="true">${dust}</div>
  <div class="hero-vignette" aria-hidden="true"></div>
  <div class="hero-flare" aria-hidden="true"></div>
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
  <h2 class="reveal">${esc(t.eco.title)}</h2>
  <p class="section-body reveal">${esc(t.eco.body)}</p>
  <div class="compare-card reveal">
    <h3>${esc(t.eco.comparison.title)}</h3>
    <div class="bars">${bars}</div>
    <p class="compare-note">${esc(t.eco.comparison.note)}</p>
  </div>
  <div class="point-grid">${points}</div>
</section>`
}

function howItWorks(t: Catalog): string {
  const steps = t.howItWorks.steps
    .map(
      (s, i) => `<div class="step spot reveal">
      <span class="step-n">${i + 1}</span>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.body)}</p>
    </div>`,
    )
    .join('')
  return `<section class="section" id="how">
  <p class="kicker reveal">${esc(t.howItWorks.kicker)}</p>
  <h2 class="reveal">${esc(t.howItWorks.title)}</h2>
  <p class="section-body reveal">${esc(t.howItWorks.body)}</p>
  <div class="step-grid">${steps}</div>
</section>`
}

function aiOutcomes(t: Catalog): string {
  const items = t.aiOutcomes.items
    .map((p) => `<div class="point reveal"><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></div>`)
    .join('')
  return `<section class="section section-tinted" id="ai">
  <p class="kicker reveal">${esc(t.aiOutcomes.kicker)}</p>
  <h2 class="reveal">${esc(t.aiOutcomes.title)}</h2>
  <p class="section-body reveal">${esc(t.aiOutcomes.body)}</p>
  <div class="point-grid">${items}</div>
</section>`
}

function services(t: Catalog): string {
  const cols = t.services.columns
    .map(
      (c) => `<div class="svc spot reveal">
      <span class="svc-tag">${esc(c.tag)}</span>
      <h3>${esc(c.name)}</h3>
      <ul class="svc-list">${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>`,
    )
    .join('')
  return `<section class="section" id="services">
  <p class="kicker reveal">${esc(t.services.kicker)}</p>
  <h2 class="reveal">${esc(t.services.title)}</h2>
  <p class="section-body reveal">${esc(t.services.body)}</p>
  <div class="svc-grid">${cols}</div>
  <p class="pricing-note">${esc(t.services.note)}</p>
</section>`
}

function features(t: Catalog): string {
  const cards = t.features.items
    .map((f) => `<div class="card spot reveal"><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p></div>`)
    .join('')
  return `<section class="section" id="features">
  <p class="kicker reveal">${esc(t.features.kicker)}</p>
  <h2 class="reveal">${esc(t.features.title)}</h2>
  <div class="card-grid">${cards}</div>
</section>`
}

function europe(t: Catalog): string {
  const points = t.europe.points
    .map((p) => `<div class="point reveal"><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></div>`)
    .join('')
  return `<section class="section section-tinted" id="europe">
  <p class="kicker reveal">${esc(t.europe.kicker)}</p>
  <h2 class="reveal">${esc(t.europe.title)}</h2>
  <p class="section-body reveal">${esc(t.europe.body)}</p>
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
  <h2 class="reveal">${esc(t.pricing.title)}</h2>
  <p class="section-body reveal">${esc(t.pricing.body)}</p>
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
  <h2 class="reveal">${esc(t.faq.title)}</h2>
  <div class="faq-list">${items}</div>
</section>`
}

function ctaBand(t: Catalog): string {
  return `<section class="cta-band reveal">
  <h2 class="reveal">${esc(t.ctaBand.title)}</h2>
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
export function renderHome(t: Catalog, other: Catalog, cssHref: string): string {
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
<link rel="stylesheet" href="${cssHref}">
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
${howItWorks(t)}
${aiOutcomes(t)}
${eco(t)}
${features(t)}
${services(t)}
${europe(t)}
${pricing(t)}
${faq(t)}
${ctaBand(t)}
</main>
${footer(t)}
<noscript><style>.reveal{opacity:1;translate:none}</style></noscript>
<script>document.addEventListener('click',e=>{const d=document.querySelector('.mnav[open]');if(d&&(e.target.closest('.mnav-panel a')||!e.target.closest('.mnav')))d.removeAttribute('open')});document.addEventListener('pointermove',e=>{const c=e.target.closest&&e.target.closest('.spot');if(!c)return;const r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')},{passive:true});const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}},{threshold:.15});document.querySelectorAll('.reveal').forEach(el=>io.observe(el));</script>
</body>
</html>
`
}
