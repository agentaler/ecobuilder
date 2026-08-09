import type { Catalog } from './types'

export const en: Catalog = {
  meta: {
    htmlLang: 'en',
    title: 'Ecobuilder — The eco-friendly website builder',
    description:
      'Build beautiful landing pages and websites that tread lightly. Ecobuilder is the eco-friendly alternative to Instapage, Webflow and WordPress — clean static pages, EU hosting, no bloat.',
    basePath: '/en',
    switchLabel: 'Français',
    switchPath: '/fr',
  },
  nav: {
    features: 'Features',
    eco: 'Why eco',
    pricing: 'Pricing',
    faq: 'FAQ',
    openApp: 'Open the app',
  },
  hero: {
    badge: 'Built for Europe · Hosted in the EU',
    title: 'Build beautiful websites',
    titleAccent: 'that tread lightly.',
    subtitle:
      'Ecobuilder is a visual website builder that publishes clean, hand-quality static HTML and CSS. No framework runtime, no megabytes of JavaScript — just fast pages that cost less energy on every single visit.',
    ctaPrimary: 'Start your 14-day free trial',
    ctaSecondary: 'See pricing',
    stats: [
      { value: '~50 KB', label: 'typical published page' },
      { value: '0', label: 'framework runtimes shipped' },
      { value: '100%', label: 'static-first output' },
    ],
  },
  eco: {
    kicker: 'Why eco',
    title: 'The greenest byte is the one you never send.',
    body: 'The web produces more CO₂ than aviation, and page bloat is a big part of it. Ecobuilder attacks the problem at the source: the publisher emits plain, semantic HTML with hand-clean CSS — the kind of page a careful developer would write, generated for you.',
    comparison: {
      title: 'Average page weight',
      note: 'Typical values: HTTP Archive median vs. an Ecobuilder-published marketing page. Lighter pages mean less energy in networks, servers and devices — on every visit.',
      bars: [
        { label: 'Typical WordPress page', value: '2.5 MB', percent: 100 },
        { label: 'Typical site-builder page', value: '1.8 MB', percent: 72 },
        { label: 'Ecobuilder page', value: '50 KB', percent: 3, highlight: true },
      ],
    },
    points: [
      {
        title: 'Static by default',
        body: 'Pages are baked to static files at publish time and served with a single file read. Dynamic fragments load lazily, only where you actually need them.',
      },
      {
        title: 'No client-side framework',
        body: 'Your visitors download your content, not our tooling. Published pages ship zero framework JavaScript — interactivity is opt-in and measured in bytes.',
      },
      {
        title: 'Efficiency is a feature',
        body: 'Lighter pages rank better, convert better and cost less to serve. Being green and being fast are the same engineering decision.',
      },
    ],
  },
  features: {
    kicker: 'Features',
    title: 'A real visual builder. A real CMS. One tool.',
    items: [
      {
        title: 'Visual editor',
        body: 'Design on a true visual canvas with breakpoints, design tokens and reusable components — what you see is exactly what gets published.',
      },
      {
        title: 'Real-time co-editing',
        body: 'Edit together, live. Every change syncs instantly between editors — no save button, no overwrites, no “who has the file?”',
      },
      {
        title: 'Clean HTML & CSS output',
        body: 'Semantic markup and tidy class-based CSS you could hand to a developer without apologising. Your site remains yours, in code you can read.',
      },
      {
        title: 'Content & data tables',
        body: 'Posts, pages and fully custom content types with typed fields, list views and publishing workflows built in.',
      },
      {
        title: 'Plugin system',
        body: 'Extend the editor and the published site with sandboxed plugins — safe by construction, with explicit permissions.',
      },
      {
        title: 'Forms & media',
        body: 'Native forms that write straight into your content tables, and a media library with folders, variants and smart search.',
      },
    ],
  },
  europe: {
    kicker: 'Built for Europe',
    title: 'European hosting. European rules.',
    body: 'Ecobuilder Cloud runs on EU infrastructure, and the product is built for teams that take data protection seriously.',
    points: [
      {
        title: 'GDPR-first',
        body: 'No tracking scripts on published pages by default, strictly-necessary cookies only, and full data export whenever you want it.',
      },
      {
        title: 'EU data residency',
        body: 'Your content, media and backups live on servers in the European Union.',
      },
      {
        title: 'English & French',
        body: 'A European product for a multilingual market — starting with full English and French coverage.',
      },
    ],
  },
  pricing: {
    kicker: 'Pricing',
    title: 'Simple plans that scale with you.',
    body: 'Every plan includes the visual editor, real-time co-editing, EU hosting with SSL, and pages that publish featherweight by design.',
    note: 'All plans start with a 14-day free trial — no credit card required. Prices exclude VAT.',
    tiers: [
      {
        name: 'Create',
        price: '€79',
        period: '/month',
        billingNote: 'billed annually — or €99 month-to-month',
        description: 'Everything you need to launch high-converting, lightweight pages.',
        features: [
          'Unlimited published pages',
          '30,000 unique visitors / month',
          'Connect your custom domain',
          'Real-time co-editing',
          'Forms & lead capture',
          'EU hosting & SSL included',
        ],
        cta: 'Start 14-day free trial',
      },
      {
        name: 'Optimize',
        price: '€159',
        period: '/month',
        billingNote: 'billed annually — or €199 month-to-month',
        description: 'For teams that iterate on conversion, at higher traffic.',
        features: [
          'Everything in Create',
          '100,000 unique visitors / month',
          'Multiple sites & workspaces',
          'Buy domains directly from us',
          'Team roles & permissions',
          'Priority support',
        ],
        cta: 'Start 14-day free trial',
        highlight: true,
      },
      {
        name: 'Convert',
        price: 'Custom',
        period: '',
        billingNote: 'annual contract, tailored to your volume',
        description: 'For agencies and enterprises publishing at scale.',
        features: [
          'Everything in Optimize',
          'Unlimited visitors & sites',
          'Dedicated onboarding & migration',
          'SLA & dedicated support',
          'Custom contracts & invoicing',
        ],
        cta: 'Talk to sales',
        custom: true,
      },
    ],
  },
  faq: {
    kicker: 'FAQ',
    title: 'Questions, answered.',
    items: [
      {
        q: 'How is Ecobuilder different from Instapage or Webflow?',
        a: 'You get the same class of visual building and publishing power — but your pages ship as featherweight static HTML with no framework runtime, hosted in the EU. Faster pages, better ad-spend efficiency, and a dramatically smaller carbon footprint.',
      },
      {
        q: 'What makes a website “eco-friendly”?',
        a: 'Mostly weight and work: fewer bytes transferred and less computation per visit means less energy in data centres, networks and visitor devices. Ecobuilder minimises both by design.',
      },
      {
        q: 'Can I use my own domain?',
        a: 'Yes — connect a domain you already own in a few clicks, or buy one directly from us and we configure everything automatically.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes — every plan starts with a 14-day free trial, no credit card required. Build and publish a real page before you decide.',
      },
      {
        q: 'Can my team edit together?',
        a: 'Yes — real-time collaborative editing is built into the core. Everyone sees everyone’s changes live, like a design tool.',
      },
    ],
  },
  ctaBand: {
    title: 'Ready to build lighter?',
    body: 'Publish a site you’re proud of — and one the planet barely notices.',
    cta: 'Start your free trial',
  },
  footer: {
    tagline: 'The eco-friendly landing page & website builder.',
    product: 'Product',
    legal: 'Legal',
    privacy: 'Privacy policy',
    imprint: 'Imprint',
    hostedInEu: 'Proudly hosted in the European Union 🇪🇺',
  },
}
