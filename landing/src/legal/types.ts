/**
 * Shape of a legal document. Both locales implement it identically, so a
 * missing section in one language fails the build rather than shipping a
 * half-translated legal page.
 */
export interface LegalSection {
  heading: string
  /** Paragraphs, rendered in order. */
  body?: string[]
  bullets?: string[]
  /** Definition rows — used for identity blocks and cookie/processor tables. */
  rows?: { label: string; value: string }[]
  table?: { head: string[]; rows: string[][] }
}

export interface LegalDoc {
  title: string
  lead: string
  sections: LegalSection[]
}

export interface LegalCatalog {
  updatedLabel: string
  back: string
  privacy: LegalDoc
  imprint: LegalDoc
}
