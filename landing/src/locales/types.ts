/**
 * The locale catalog contract. Both `en.ts` and `fr.ts` must satisfy this
 * interface exactly, so a missing or extra key in either catalog fails
 * `tsc` at build time — locale parity is enforced by the type system, not
 * a runtime check.
 */
export interface Catalog {
  meta: {
    htmlLang: string
    title: string
    description: string
    /** URL path prefix for this locale, e.g. "/en" */
    basePath: string
    /** Label shown on the language switcher for the OTHER locale */
    switchLabel: string
    /** Path prefix the switcher links to */
    switchPath: string
  }
  nav: {
    how: string
    features: string
    eco: string
    pricing: string
    faq: string
    openApp: string
  }
  howItWorks: {
    kicker: string
    title: string
    body: string
    steps: { title: string; body: string }[]
  }
  aiOutcomes: {
    kicker: string
    title: string
    body: string
    items: { title: string; body: string }[]
  }
  services: {
    kicker: string
    title: string
    body: string
    note: string
    columns: { name: string; tag: string; items: string[] }[]
  }
  hero: {
    badge: string
    title: string
    titleAccent: string
    subtitle: string
    ctaPrimary: string
    ctaSecondary: string
    stats: { value: string; label: string }[]
  }
  eco: {
    kicker: string
    title: string
    body: string
    comparison: {
      title: string
      note: string
      bars: { label: string; value: string; percent: number; highlight?: boolean }[]
    }
    points: { title: string; body: string }[]
  }
  features: {
    kicker: string
    title: string
    items: { title: string; body: string }[]
  }
  europe: {
    kicker: string
    title: string
    body: string
    points: { title: string; body: string }[]
  }
  pricing: {
    kicker: string
    title: string
    body: string
    note: string
    tiers: {
      name: string
      price: string
      period: string
      billingNote: string
      description: string
      features: string[]
      cta: string
      highlight?: boolean
      /** Custom-priced tier: CTA links to sales contact instead of the app */
      custom?: boolean
    }[]
  }
  faq: {
    kicker: string
    title: string
    items: { q: string; a: string }[]
  }
  ctaBand: {
    title: string
    body: string
    cta: string
  }
  cookies: {
    title: string
    body: string
    acceptAll: string
    rejectAll: string
    customize: string
    save: string
    alwaysOn: string
    manage: string
    categories: { name: string; desc: string }[]
  }
  footer: {
    tagline: string
    product: string
    legal: string
    privacy: string
    imprint: string
    hostedInEu: string
  }
}
