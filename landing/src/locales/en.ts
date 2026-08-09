import type { Catalog } from './types'

export const en: Catalog = {
  meta: {
    htmlLang: 'en',
    title: 'Ecobuilder — The eco-friendly website builder',
    description:
      'Ecobuilder is the eco-friendly AI website builder that grows your revenue. Describe your business, get a complete site in minutes — pages, copy, forms and SEO. Hosting, SEO and marketing included from €29/month, hosted in the EU.',
    basePath: '/en',
    switchLabel: 'Français',
    switchPath: '/fr',
  },
  nav: {
    how: 'How it works',
    features: 'Features',
    eco: 'Why eco',
    pricing: 'Pricing',
    faq: 'FAQ',
    openApp: 'Open the app',
  },
  howItWorks: {
    kicker: 'How it works',
    title: 'From an idea to a site that sells — in four steps.',
    body: 'No briefs, no agencies, no waiting weeks for a first draft. You describe the business; everything else is handled.',
    steps: [
      {
        title: 'Tell us about your business',
        body: 'What you sell, who you sell it to, and what a win looks like — a booking, a signup, a purchase. Plain sentences, no forms to fill in.',
      },
      {
        title: 'The AI builds your site',
        body: 'Pages, layout, copy, images placement, contact and lead forms, plus the SEO groundwork — a complete, on-brand site rather than a blank canvas.',
      },
      {
        title: 'Make it yours',
        body: 'Drag, edit and restyle anything in the visual editor, or just ask the AI in plain words. You approve every change before it goes live.',
      },
      {
        title: 'Publish and grow',
        body: 'One click puts it on your own domain with hosting, SSL and CDN-speed pages included. Then we help you rank and convert.',
      },
    ],
  },
  aiOutcomes: {
    kicker: 'AI that pays for itself',
    title: 'The AI is not a gimmick — it does the work that makes you money.',
    body: 'Every page it produces is aimed at the two things that decide whether a website earns: getting found, and turning visitors into customers.',
    items: [
      {
        title: 'Copy written to convert',
        body: 'Benefit-led headlines, clear offers and calls to action written for your audience and your goal — not filler text you have to rewrite.',
      },
      {
        title: 'SEO handled at publish time',
        body: 'Titles, meta descriptions, Open Graph, sitemaps, semantic structure and clean URLs generated for every page, so you rank without hiring a specialist.',
      },
      {
        title: 'A landing page per campaign',
        body: 'Spin up a dedicated page for each ad, audience or offer in minutes. More targeted pages means better ad spend and more leads from the same budget.',
      },
      {
        title: 'Speed that lifts conversion',
        body: 'The AI can only produce featherweight static pages — so your site passes Core Web Vitals by construction, which search engines reward and visitors reward more.',
      },
    ],
  },
  services: {
    kicker: 'SEO & marketing',
    title: 'What you actually get for your subscription.',
    body: 'Ecobuilder is not just software. Technical SEO is built into every published page, and on higher plans our team works on your growth with you.',
    note: 'Services are delivered by our team in English and French. Higher plans include more hands-on time — see Pricing for limits.',
    columns: [
      {
        name: 'Built into every plan',
        tag: 'Automatic',
        items: [
          'Technical SEO: semantic HTML, clean URLs, canonical tags',
          'Auto-generated sitemaps and robots.txt',
          'Full meta, Open Graph and social preview control',
          'Core Web Vitals-grade page speed by construction',
          'Redirects when you rename or move a page',
          'Lead capture forms with spam protection',
          'EU hosting, SSL and your custom domain',
        ],
      },
      {
        name: 'Growth services',
        tag: 'Optimize plan',
        items: [
          'SEO audit of your site with a prioritised action list',
          'Keyword and content plan for your market',
          'Conversion review of your key pages',
          'Campaign landing pages built with you',
          'Multi-site and team workspaces',
          'Priority support from the people who build the product',
        ],
      },
      {
        name: 'Done with you',
        tag: 'Convert plan',
        items: [
          'A dedicated SEO and marketing contact',
          'Ongoing content and campaign production',
          'Migration of your existing site, handled for you',
          'Custom reporting on traffic, leads and rankings',
          'Onboarding and training for your team',
          'SLA and custom contracts',
        ],
      },
    ],
  },
  hero: {
    badge: 'Powered by AI · Hosted in the EU',
    title: 'The eco-friendly website builder',
    titleAccent: 'that grows your revenue.',
    subtitle:
      'Describe your business and the AI builds your whole site — pages, copy, forms and SEO — live on your own domain in minutes. Every page ships featherweight, so it loads fast, ranks higher and converts better. Hosting, SEO and marketing included from €29/month.',
    ctaPrimary: 'Start your 7-day free trial',
    ctaSecondary: 'See pricing',
    stats: [
      { value: '~50 KB', label: 'typical published page' },
      { value: 'Minutes', label: 'from signup to live page' },
      { value: '0', label: 'web skills required' },
    ],
  },
  eco: {
    kicker: 'Why eco',
    title: 'Lighter pages. Lower costs. More sales.',
    body: 'Every extra megabyte costs you twice: visitors leave before your page loads, and the energy bill lands on the planet. Ecobuilder publishes plain, semantic HTML with hand-clean CSS — the kind of page a careful developer would write, generated for you. Green by construction, profitable by consequence.',
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
    kicker: 'All-in-one',
    title: 'AI does the heavy lifting. You stay in charge.',
    items: [
      {
        title: 'AI assistant built in',
        body: 'Describe the page you need in plain words — the AI drafts the layout, writes the copy and adjusts the design. You review and approve every change before it goes live.',
      },
      {
        title: 'Easy from the first minute',
        body: 'No code, no hosting setup, no web jargon. Sign up, pick a starting point, publish — your site is live on a real domain in minutes.',
      },
      {
        title: 'SEO built in',
        body: 'Semantic HTML, automatic sitemaps, full meta and Open Graph control, and pages fast enough to win Core Web Vitals — the ranking work is done at publish time.',
      },
      {
        title: 'Marketing toolkit & services',
        body: 'Lead capture, campaign-ready pages and conversion-focused templates — with hands-on SEO and marketing support from our team on higher plans.',
      },
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
    body: 'One all-in-one package from €29/month: AI builder, hosting, SEO and marketing together — no add-ons, no per-feature upsells. Save 25% with annual billing.',
    note: 'All plans start with a 7-day free trial — no credit card required. Prices exclude VAT.',
    tiers: [
      {
        name: 'Create',
        price: '€29',
        period: '/month',
        billingNote: 'billed annually (save 25%) — or €39 month-to-month',
        description: 'Everything you need to launch high-converting, lightweight pages.',
        features: [
          'Unlimited published pages',
          '30,000 unique visitors / month',
          'Connect your custom domain',
          'On-page SEO toolkit & sitemaps',
          'Forms & lead capture',
          'EU hosting & SSL included',
        ],
        cta: 'Start 7-day free trial',
      },
      {
        name: 'Optimize',
        price: '€59',
        period: '/month',
        billingNote: 'billed annually (save 25%) — or €79 month-to-month',
        description: 'For teams that iterate on conversion, at higher traffic.',
        features: [
          'Everything in Create',
          '100,000 unique visitors / month',
          'Multiple sites & workspaces',
          'SEO & conversion audits',
          'Buy domains directly from us',
          'Team roles & priority support',
        ],
        cta: 'Start 7-day free trial',
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
          'Dedicated SEO & marketing support',
          'Dedicated onboarding & migration',
          'SLA & custom contracts',
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
        q: 'Do I need technical or web skills?',
        a: 'None at all. Describe what you want and the AI assistant drafts it; the visual editor works like a design tool, and hosting, domains and SSL are handled for you. If you can write an email, you can publish a site.',
      },
      {
        q: 'Are SEO and marketing really included?',
        a: 'Yes — every plan is all-in-one. Technical SEO (clean markup, sitemaps, meta control, fast pages) is built into the product, and Optimize and Convert plans add hands-on SEO audits and marketing support from our team.',
      },
      {
        q: 'Can I use my own domain?',
        a: 'Yes — connect a domain you already own in a few clicks, or buy one directly from us and we configure everything automatically.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes — every plan starts with a 7-day free trial, no credit card required. Build and publish a real page before you decide.',
      },
      {
        q: 'Can my team edit together?',
        a: 'Yes — real-time collaborative editing is built into the core. Everyone sees everyone’s changes live, like a design tool.',
      },
    ],
  },
  ctaBand: {
    title: 'Turn visitors into customers.',
    body: 'Publish a site that sells for you — and that the planet barely notices.',
    cta: 'Start your free trial',
  },
  cookies: {
    title: 'We respect your privacy',
    body: 'We only set a cookie that remembers your language — that one is required for the site to work. Nothing else runs unless you allow it. You can change your mind at any time.',
    acceptAll: 'Accept all',
    rejectAll: 'Reject all',
    customize: 'Customise',
    save: 'Save choices',
    alwaysOn: 'Always on',
    manage: 'Cookie settings',
    categories: [
      {
        name: 'Strictly necessary',
        desc: 'Remembers your language and your cookie choice. Cannot be switched off — the site cannot work without it.',
      },
      {
        name: 'Analytics',
        desc: 'Would let us count visits and see which pages are useful. Nothing is loaded today; if we ever add it, it stays off until you allow it.',
      },
      {
        name: 'Marketing',
        desc: 'Would let us measure ad campaigns. We run no advertising or tracking scripts on this site today.',
      },
    ],
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
