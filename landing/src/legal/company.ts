/**
 * The only file to edit when the company's legal details are settled.
 *
 * Every value marked TODO is a legal fact this codebase cannot invent — it must
 * come from the company's registration documents. Values left as TODO render on
 * the public pages as an explicit "to be completed" marker rather than silently
 * producing a false statement.
 */
export interface CompanyFacts {
  /** Registered legal name, e.g. "Ecobuilder SAS" */
  legalName: string
  /** Legal form, e.g. "Société par actions simplifiée (SAS)" */
  legalForm: string
  /** Share capital, e.g. "10 000 €" */
  shareCapital: string
  /** Registered address, single line */
  address: string
  /** Company register + number, e.g. "RCS Paris 912 345 678" */
  registration: string
  /** Intra-community VAT number, e.g. "FR12912345678" */
  vat: string
  /** Name of the person legally responsible for publication */
  publicationDirector: string
  /** General + privacy contact address */
  email: string
  /** Data protection officer, or empty when none is appointed */
  dpo: string
  /** Hosting provider legal name */
  hostName: string
  /** Hosting provider registered address */
  hostAddress: string
  /** Where the servers physically are */
  hostRegion: string
  /** Supervisory authority for complaints */
  authority: string
  authorityUrl: string
}

export const TODO = '[to be completed]'

export const COMPANY: CompanyFacts = {
  legalName: TODO,
  legalForm: TODO,
  shareCapital: TODO,
  address: TODO,
  registration: TODO,
  vat: TODO,
  publicationDirector: TODO,
  email: 'hello@ecobuilder.ai',
  dpo: '',
  hostName: 'Railway Corporation',
  hostAddress: TODO,
  // Verified: all Ecobuilder services run in Railway's europe-west4 region.
  hostRegion: 'Amsterdam, Netherlands (EU) — Railway region europe-west4',
  authority: 'Commission Nationale de l’Informatique et des Libertés (CNIL)',
  authorityUrl: 'https://www.cnil.fr',
}

/** ISO date the legal texts were last reviewed. Bump when editing them. */
export const LEGAL_UPDATED = '2026-08-09'
