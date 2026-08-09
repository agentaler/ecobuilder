import { COMPANY as C } from './company'
import type { LegalCatalog } from './types'

export const legalEn: LegalCatalog = {
  updatedLabel: 'Last updated',
  back: 'Back to home',

  imprint: {
    title: 'Legal notice',
    lead: 'Information about the publisher of ecobuilder.ai and the service operated at app.ecobuilder.ai, published in accordance with EU and French requirements for online services.',
    sections: [
      {
        heading: 'Publisher',
        rows: [
          { label: 'Legal name', value: C.legalName },
          { label: 'Legal form', value: C.legalForm },
          { label: 'Share capital', value: C.shareCapital },
          { label: 'Registered address', value: C.address },
          { label: 'Company registration', value: C.registration },
          { label: 'VAT number', value: C.vat },
          { label: 'Contact', value: C.email },
        ],
      },
      {
        heading: 'Director of publication',
        rows: [{ label: 'Responsible for publication', value: C.publicationDirector }],
      },
      {
        heading: 'Hosting',
        body: [
          'The website and the service are hosted on infrastructure operated by the provider below. All application servers, databases and backups run in the European Union.',
        ],
        rows: [
          { label: 'Host', value: C.hostName },
          { label: 'Host address', value: C.hostAddress },
          { label: 'Server location', value: C.hostRegion },
        ],
      },
      {
        heading: 'Intellectual property',
        body: [
          'The Ecobuilder software, brand, logo, interface and the content of this website are protected by intellectual property law and remain the property of the publisher. Ecobuilder is proprietary software; no licence to copy, modify or redistribute it is granted by access to this site.',
          'Content that customers create with Ecobuilder — their pages, text, images and data — remains entirely their own. The publisher claims no ownership over it.',
        ],
      },
      {
        heading: 'Liability',
        body: [
          'The publisher takes care to keep the information on this website accurate and up to date, but gives no warranty that it is complete or error-free, and may change it at any time. Links to third-party websites are provided for convenience; the publisher does not control and is not responsible for their content.',
          'Service commitments, including availability and support, are governed by the subscription terms agreed with each customer, not by this notice.',
        ],
      },
      {
        heading: 'Reporting illegal content',
        body: [
          `To report content published through the service that you believe to be unlawful, write to ${C.email} with the URL, a description of the issue and your contact details. Reports are reviewed promptly.`,
        ],
      },
      {
        heading: 'Consumer dispute resolution',
        body: [
          'Consumers in the European Union may submit a dispute to the European Commission’s online dispute resolution platform at https://ec.europa.eu/consumers/odr. We prefer to resolve any disagreement directly first — please contact us before opening a formal procedure.',
        ],
      },
      {
        heading: 'Privacy',
        body: ['How we handle personal data is described in our privacy policy.'],
      },
    ],
  },

  privacy: {
    title: 'Privacy policy',
    lead: 'This policy explains what personal data Ecobuilder collects, why, on what legal basis, how long it is kept, and the rights you have over it. It covers both this website (ecobuilder.ai) and the service (app.ecobuilder.ai).',
    sections: [
      {
        heading: 'Who is responsible for your data',
        body: [
          'The data controller is the company identified below. For anything relating to your personal data, including the requests described in “Your rights”, contact us at the address given.',
        ],
        rows: [
          { label: 'Controller', value: C.legalName },
          { label: 'Address', value: C.address },
          { label: 'Contact', value: C.email },
          { label: 'Data protection officer', value: C.dpo || 'None appointed — write to the contact address above' },
        ],
      },
      {
        heading: 'What we collect and why',
        body: [
          'We collect only what a given purpose requires. The table sets out each purpose, the data involved, and the legal basis under Article 6 GDPR.',
        ],
        table: {
          head: ['Purpose', 'Data', 'Legal basis'],
          rows: [
            [
              'Running this website',
              'Language preference and your cookie choice, stored in cookies on your device',
              'Legitimate interest in providing a working site (Art. 6(1)(f))',
            ],
            [
              'Answering your messages',
              'Your email address and the content of your message',
              'Legitimate interest in responding to enquiries (Art. 6(1)(f))',
            ],
            [
              'Creating and running your account',
              'Name, email address, password (stored only as a cryptographic hash), account settings',
              'Performance of the contract (Art. 6(1)(b))',
            ],
            [
              'Hosting the sites you build',
              'The pages, text, media and any data you choose to store in the service',
              'Performance of the contract (Art. 6(1)(b))',
            ],
            [
              'Keeping the service secure',
              'Login attempts, session and device information, IP address, audit log of sensitive actions',
              'Legal obligation and legitimate interest in security (Art. 6(1)(c), 6(1)(f))',
            ],
            [
              'Billing and accounting',
              'Billing details and invoice records handled by our payment provider; we do not store card numbers',
              'Contract and legal obligation (Art. 6(1)(b), 6(1)(c))',
            ],
            [
              'Optional analytics',
              'Nothing today. If introduced, only with your consent given through the cookie banner',
              'Consent (Art. 6(1)(a)) — withdrawable at any time',
            ],
          ],
        },
      },
      {
        heading: 'Cookies',
        body: [
          'This website runs no advertising, tracking or analytics scripts. Only the following strictly necessary cookies are set; they need no consent because the site cannot work without them.',
        ],
        table: {
          head: ['Cookie', 'Purpose', 'Retention'],
          rows: [
            ['lang', 'Remembers whether you read the site in English or French', '12 months'],
            ['eco_consent', 'Records your cookie choice so you are not asked again', '6 months'],
          ],
        },
      },
      {
        heading: 'Withdrawing consent',
        body: [
          'You can change or withdraw your cookie choice at any time using the “Cookie settings” link in the footer of every page. Withdrawal takes effect immediately and does not affect processing that took place beforehand.',
        ],
      },
      {
        heading: 'Who else processes your data',
        body: [
          'We use a small number of processors, each bound by a data processing agreement and permitted to act only on our instructions. We do not sell personal data, and we do not share it for advertising.',
        ],
        table: {
          head: ['Processor', 'Role', 'Location'],
          rows: [
            [C.hostName, 'Hosting of the application, database and backups', C.hostRegion],
            ['Payment provider', 'Subscription payments and invoicing (planned)', 'To be documented before launch'],
            ['AI provider', 'Generating page content when you use the AI features (planned)', 'To be documented before launch'],
          ],
        },
      },
      {
        heading: 'Where your data is stored',
        body: [
          `Your account, content, media and backups are stored in the European Union (${C.hostRegion}). Where a processor is established outside the EU, transfers are covered by the European Commission’s standard contractual clauses or an adequacy decision, and are documented in the table above before that processor is used.`,
        ],
      },
      {
        heading: 'How long we keep it',
        bullets: [
          'Account and content: for as long as your account exists, then deleted within 90 days of closure, unless you export it first.',
          'Security and audit logs: 12 months.',
          'Login attempt records: 12 months.',
          'Invoices and accounting records: retained for the period required by law (generally 10 years).',
          'Cookie choice: 6 months.',
          'Messages you send us: up to 24 months after our last exchange.',
        ],
      },
      {
        heading: 'How we protect it',
        bullets: [
          'All traffic is encrypted in transit with TLS.',
          'Passwords are never stored in readable form, only as salted cryptographic hashes.',
          'Sensitive values such as API credentials and two-factor secrets are encrypted at rest.',
          'Sensitive actions require re-authentication, and optional two-factor authentication is available.',
          'Access to production data is limited to the people who need it to operate the service.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'Under the GDPR you may exercise the following rights at any time, free of charge. Write to the contact address above; we reply within one month, and will ask for proof of identity only where we genuinely cannot identify you.',
        ],
        bullets: [
          'Access — obtain a copy of the personal data we hold about you.',
          'Rectification — have inaccurate or incomplete data corrected.',
          'Erasure — have your data deleted, where no legal obligation requires us to keep it.',
          'Restriction — ask us to limit how we use your data while a dispute is resolved.',
          'Portability — receive your data in a structured, machine-readable format, or have it sent to another provider.',
          'Objection — object to processing carried out on the basis of our legitimate interests.',
          'Withdraw consent — for anything you consented to, without affecting what happened before.',
          'Post-mortem instructions — set out how your data should be handled after your death.',
        ],
      },
      {
        heading: 'Complaints',
        body: [
          `If you believe we have handled your data improperly, please tell us first — we would rather fix it. You also have the right to lodge a complaint with your national supervisory authority, in our case the ${C.authority} (${C.authorityUrl}).`,
        ],
      },
      {
        heading: 'Automated decisions',
        body: [
          'We do not make decisions with legal or similarly significant effects about you by automated means, and we do not profile you. The AI features of the product generate content at your request; they do not make decisions about you.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'The service is intended for businesses and professional use. It is not directed at children, and we do not knowingly collect data from anyone under 15.',
        ],
      },
      {
        heading: 'Changes to this policy',
        body: [
          'We may update this policy as the service evolves. The date at the top shows when it was last reviewed, and we will tell account holders about significant changes by email before they take effect.',
        ],
      },
    ],
  },
}
