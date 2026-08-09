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
      'This site uses no tracking, analytics or advertising scripts. Two strictly-necessary cookies are set: one remembering your language preference, and one recording your cookie choice (kept 6 months). You can change or withdraw that choice at any time via “Cookie settings” in the footer. Data is hosted in the European Union. Full policy coming soon — for questions or any GDPR request (access, deletion, portability), contact hello@ecobuilder.ai.',
    imprintTitle: 'Imprint',
    imprintBody: 'Ecobuilder — contact: hello@ecobuilder.ai. Full legal information coming soon.',
    back: 'Back to home',
  },
  fr: {
    privacyTitle: 'Politique de confidentialité',
    privacyBody:
      'Ce site n’utilise aucun script de pistage, de mesure d’audience ou de publicité. Deux cookies strictement nécessaires sont déposés : l’un retient votre préférence de langue, l’autre votre choix en matière de cookies (conservé 6 mois). Vous pouvez modifier ou retirer ce choix à tout moment via « Gestion des cookies » en pied de page. Les données sont hébergées dans l’Union européenne. Politique complète à venir — pour toute question ou demande RGPD (accès, suppression, portabilité), contactez hello@ecobuilder.ai.',
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
