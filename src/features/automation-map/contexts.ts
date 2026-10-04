/**
 * Execution contexts returned for a deployment set to "All" contexts, as seen in a sandbox
 * (2026-10-04). NetSuite lists every context instead of "All", which made cards very long.
 * VERIFY: the list changes between releases and enabled features; the summary tolerates
 * a few missing or extra values.
 */
export const KNOWN_EXECUTION_CONTEXTS: readonly string[] = [
  'ACTION',
  'ADVANCEDREVREC',
  'BANKCONNECTIVITY',
  'BANKSTATEMENTPARSER',
  'BUNDLEINSTALLATION',
  'CLIENT',
  'CONSOLRATEADJUSTOR',
  'CSVIMPORT',
  'CUSTOMGLLINES',
  'CUSTOMMASSUPDATE',
  'DATASETBUILDER',
  'DEBUGGER',
  'EMAILCAPTURE',
  'FICONNECTIVITY',
  'FIPARSER',
  'MAPREDUCE',
  'OCRPLUGIN',
  'OTHER',
  'PAYMENTGATEWAY',
  'PAYMENTPOSTBACK',
  'PLATFORMEXTENSION',
  'PORTLET',
  'PROMOTIONS',
  'RECORDACTION',
  'RESTLET',
  'RESTWEBSERVICES',
  'SCHEDULED',
  'SDFINSTALLATION',
  'SHIPPINGPARTNERS',
  'SUITELET',
  'TAXCALCULATION',
  'USEREVENT',
  'USERINTERFACE',
  'WEBSERVICES',
  'WORKBOOKBUILDER',
  'WORKFLOW',
];

/** Lists at least this long that miss only a few known contexts read as "All except …". */
const ALL_EXCEPT_MIN_LENGTH = 20;
const ALL_EXCEPT_MAX_MISSING = 5;
/** Contexts shown before the rest is folded away. */
export const CONTEXTS_SHOWN = 6;

export type ContextSummary =
  | { kind: 'all' }
  | { kind: 'allExcept'; missing: string[] }
  | { kind: 'list'; shown: string[]; hidden: string[] };

export function summarizeContexts(contexts: readonly string[]): ContextSummary {
  const present = new Set(contexts.map((c) => c.trim().toUpperCase()).filter(Boolean));
  const missing = KNOWN_EXECUTION_CONTEXTS.filter((c) => !present.has(c));
  if (missing.length === 0) return { kind: 'all' };
  if (present.size >= ALL_EXCEPT_MIN_LENGTH && missing.length <= ALL_EXCEPT_MAX_MISSING) {
    return { kind: 'allExcept', missing };
  }
  const list = Array.from(present);
  return { kind: 'list', shown: list.slice(0, CONTEXTS_SHOWN), hidden: list.slice(CONTEXTS_SHOWN) };
}
