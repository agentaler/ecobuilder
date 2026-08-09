import type { Catalog } from './locales/types'
import { LEGAL_UPDATED, TODO } from './legal/company'
import { legalEn } from './legal/en'
import { legalFr } from './legal/fr'
import type { LegalDoc, LegalSection } from './legal/types'

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Renders a value that may still be an unfilled legal fact. Placeholders are
 * marked up distinctly so an incomplete document is obvious to the operator
 * rather than reading as a finished statement.
 */
function value(raw: string): string {
  return raw === TODO ? `<span class="lg-todo">${esc(raw)}</span>` : esc(raw)
}

/** Linkifies bare URLs and the contact email so the documents stay actionable. */
function rich(raw: string): string {
  return esc(raw)
    .replace(/(https?:\/\/[^\s,)]+)/g, '<a href="$1">$1</a>')
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>')
}

function section(s: LegalSection, id: string): string {
  const parts: string[] = [`<h2>${esc(s.heading)}</h2>`]
  if (s.body) parts.push(...s.body.map((p) => `<p>${rich(p)}</p>`))
  if (s.rows) {
    parts.push(
      `<dl class="lg-dl">${s.rows
        .map((r) => `<div><dt>${esc(r.label)}</dt><dd>${value(r.value)}</dd></div>`)
        .join('')}</dl>`,
    )
  }
  if (s.bullets) parts.push(`<ul class="lg-ul">${s.bullets.map((b) => `<li>${rich(b)}</li>`).join('')}</ul>`)
  if (s.table) {
    parts.push(
      `<div class="lg-table-wrap"><table class="lg-table"><thead><tr>${s.table.head
        .map((h) => `<th>${esc(h)}</th>`)
        .join('')}</tr></thead><tbody>${s.table.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${value(cell)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`,
    )
  }
  return `<section class="lg-section" id="${id}">${parts.join('\n')}</section>`
}

export function renderLegalPage(t: Catalog, kind: 'privacy' | 'imprint', cssHref: string): string {
  const legal = t.meta.htmlLang === 'fr' ? legalFr : legalEn
  const doc: LegalDoc = legal[kind]
  const toc = doc.sections.map((s, i) => `<li><a href="#s${i + 1}">${esc(s.heading)}</a></li>`).join('')
  const body = doc.sections.map((s, i) => section(s, `s${i + 1}`)).join('\n')
  const other = kind === 'privacy' ? legal.imprint.title : legal.privacy.title
  const otherPath = kind === 'privacy' ? 'imprint' : 'privacy'
  return `<!doctype html>
<html lang="${t.meta.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#060807">
<title>${esc(doc.title)} — Ecobuilder</title>
<meta name="description" content="${esc(doc.lead.slice(0, 180))}">
<link rel="preload" href="/assets/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
<main class="lg">
  <a class="lg-back" href="${t.meta.basePath}/">← ${esc(legal.back)}</a>
  <h1>${esc(doc.title)}</h1>
  <p class="lg-updated">${esc(legal.updatedLabel)}: ${esc(LEGAL_UPDATED)}</p>
  <p class="lg-lead">${rich(doc.lead)}</p>
  <nav class="lg-toc" aria-label="${esc(doc.title)}"><ol>${toc}</ol></nav>
  ${body}
  <p class="lg-foot"><a href="${t.meta.basePath}/">← ${esc(legal.back)}</a> · <a href="${t.meta.basePath}/${otherPath}/">${esc(other)}</a></p>
</main>
</body>
</html>
`
}
