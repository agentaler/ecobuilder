import type { Catalog } from './types'

export const en: Catalog = {
  meta: {
    htmlLang: 'en',
    title: 'Ecobuilder — The eco-friendly website builder',
    description:
      'Build beautiful websites that tread lightly. Ecobuilder is the open-source, eco-friendly alternative to Webflow, Framer and WordPress — clean static pages, EU hosting, no bloat.',
    basePath: '/en',
    switchLabel: 'Français',
    switchPath: '/fr',
  },
  nav: {
    features: 'Features',
    eco: 'Why eco',
    openSource: 'Open source',
    faq: 'FAQ',
    openApp: 'Open the app',
  },
  hero: {
    badge: 'Open source · Hosted in the EU',
    title: 'Build beautiful websites',
    titleAccent: 'that tread lightly.',
    subtitle:
      'Ecobuilder is a visual website builder that publishes clean, hand-quality static HTML and CSS. No framework runtime, no megabytes of JavaScript — just fast pages that cost less energy on every single visit.',
    ctaPrimary: 'Start building — it’s free',
    ctaSecondary: 'View on GitHub',
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
  openSource: {
    kicker: 'Open source',
    title: 'Use our cloud, or run it yourself.',
    body: 'Ecobuilder is open source. Host it on your own server with Docker and own every byte, or let us run it for you at app.ecobuilder.ai — same product, your choice of control.',
    ctaGithub: 'Star on GitHub',
    ctaCloud: 'Try Ecobuilder Cloud',
  },
  faq: {
    kicker: 'FAQ',
    title: 'Questions, answered.',
    items: [
      {
        q: 'How is Ecobuilder different from Webflow or Framer?',
        a: 'Ecobuilder publishes plain static HTML and CSS with no framework runtime, is fully open source, and can be self-hosted. You keep your content, your code and your independence.',
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
        q: 'Is it really free to start?',
        a: 'Yes. Self-hosting is free forever under the open-source license, and Ecobuilder Cloud has a free tier to build and publish your first site.',
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
    cta: 'Start building free',
  },
  footer: {
    tagline: 'The eco-friendly, open-source website builder.',
    product: 'Product',
    legal: 'Legal',
    privacy: 'Privacy policy',
    imprint: 'Imprint',
    hostedInEu: 'Proudly hosted in the European Union 🇪🇺',
  },
}
