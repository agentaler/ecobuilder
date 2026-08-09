import type { Catalog } from './locales/types'

/**
 * Minimal legal stub pages (privacy / imprint) until E11-T03 supplies
 * lawyer-grade content. Kept out of the main catalogs deliberately: these
 * are placeholders with their own lifecycle.
 */
const LEGAL_COPY = {
  en: {
    privacyTitle: 'Privacy policy',
    privacyBody:
      'This site does not use tracking scripts or analytics cookies. The only cookie set is a strictly-necessary language preference. Full policy coming soon — for questions, contact hello@ecobuilder.ai.',
    imprintTitle: 'Imprint',
    imprintBody: 'Ecobuilder — contact: hello@ecobuilder.ai. Full legal information coming soon.',
    back: 'Back to home',
  },
  fr: {
    privacyTitle: 'Politique de confidentialité',
    privacyBody:
      'Ce site n’utilise ni scripts de pistage ni cookies d’analyse. Le seul cookie déposé est une préférence de langue strictement nécessaire. Politique complète à venir — pour toute question, contactez hello@ecobuilder.ai.',
    imprintTitle: 'Mentions légales',
    imprintBody: 'Ecobuilder — contact : hello@ecobuilder.ai. Informations légales complètes à venir.',
    back: 'Retour à l’accueil',
  },
} as const

export function renderLegalPage(t: Catalog, kind: 'privacy' | 'imprint', cssHref: string): string {
  const copy = LEGAL_COPY[t.meta.htmlLang as 'en' | 'fr']
  const title = kind === 'privacy' ? copy.privacyTitle : copy.imprintTitle
  const body = kind === 'privacy' ? copy.privacyBody : copy.imprintBody
  return `<!doctype html>
<html lang="${t.meta.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Ecobuilder</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
<main class="section">
<h1>${title}</h1>
<p class="section-body">${body}</p>
<p style="margin-top:2rem"><a class="btn btn-ghost" href="${t.meta.basePath}/">${copy.back}</a></p>
</main>
</body>
</html>
`
}
