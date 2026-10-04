import { detectFromUrl } from '../context/detect';
import { isNetSuiteUrl } from '../context/environment';
import { LoupeError, type ErrorCode } from '../errors';
import { mergeFieldSources, type CurrentRecordFields } from '../parsers/mergeFields';
import { parseRecordXml, type XmlParse } from '../parsers/recordXml';
import { loadAutomations } from '../queries/runner';
import type { PageContext } from '../types';
import type { GetTargetTab, NetSuiteAdapter } from './NetSuiteAdapter';

/**
 * Fake NetSuite data (fixtures/**). Fake data only — never real account data.
 * Keys for records are `<recordType>-<id>`; SuiteQL rows are keyed by `<queryId>.<variantId>`.
 */
export type FixtureSet = {
  records: Record<string, string>;
  currentRecords: Record<string, CurrentRecordFields>;
  suiteql: Record<string, unknown[]>;
  /** Numeric custom record type ID → script ID (what the DOM/bridge gives on live pages). */
  customRecordTypes: Record<string, string>;
};

export type FixtureAdapterOptions = {
  fixtures: FixtureSet;
  getTargetTab: GetTargetTab;
  /** URL used when the target tab is not a NetSuite page (development without an account). */
  fallbackUrl?: string;
  latencyMs?: number;
  /** Simulate an automation query failure (error UI development). */
  failAutomations?: ErrorCode;
  xmlParse?: XmlParse;
  now?: () => number;
};

export const DEFAULT_FIXTURE_URL =
  'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001';

export function createFixtureAdapter(options: FixtureAdapterOptions): NetSuiteAdapter {
  const { fixtures, latencyMs = 0, now = Date.now } = options;
  const delay = () =>
    latencyMs > 0 ? new Promise<void>((r) => setTimeout(r, latencyMs)) : Promise.resolve();

  const currentContext = async (): Promise<PageContext | null> => {
    const tab = await options.getTargetTab();
    const url = tab?.url && isNetSuiteUrl(tab.url) ? tab.url : options.fallbackUrl;
    if (!url) return null;
    const ctx = detectFromUrl(url, now());
    if (!ctx) return null;
    if (!ctx.recordType && ctx.customRecordTypeId) {
      const scriptId = fixtures.customRecordTypes[ctx.customRecordTypeId];
      if (scriptId) return { ...ctx, recordType: scriptId, recordTypeSource: 'dom' };
    }
    return ctx;
  };

  const requireContext = async (): Promise<PageContext> => {
    const ctx = await currentContext();
    if (!ctx) throw new LoupeError('NOT_NETSUITE', 'The active tab is not a NetSuite page.');
    return ctx;
  };

  const findKey = (map: Record<string, unknown>, recordType: string, id?: string) => {
    const exact = `${recordType}-${id ?? ''}`;
    if (exact in map) return exact;
    return Object.keys(map).find((k) => k.startsWith(`${recordType}-`));
  };

  return {
    kind: 'fixture',

    async getPageContext() {
      await delay();
      return currentContext();
    },

    async getRecordFields(ref) {
      await delay();
      const ctx = await requireContext();
      const xmlKey = findKey(fixtures.records, ref.recordType, ref.id);
      const crKey = findKey(fixtures.currentRecords, ref.recordType, ref.id);
      if (!xmlKey && !crKey) {
        throw new LoupeError('XML_UNAVAILABLE', `No fixture for ${ref.recordType}.`);
      }
      const xmlText = xmlKey ? fixtures.records[xmlKey] : undefined;
      const xml = xmlText ? parseRecordXml(xmlText, options.xmlParse) : undefined;
      const currentRecord = crKey ? fixtures.currentRecords[crKey] : undefined;
      const merged = mergeFieldSources({ xml, currentRecord });
      const result = {
        accountId: ctx.accountId,
        recordType: ref.recordType,
        ...merged,
        warnings: [],
        fetchedAt: now(),
      };
      return ref.id ? { ...result, recordId: ref.id } : result;
    },

    async getAutomations(recordType) {
      await delay();
      const ctx = await requireContext();
      if (options.failAutomations) {
        throw new LoupeError(options.failAutomations, 'Simulated failure (fixture mode).');
      }
      return loadAutomations(
        ctx.accountId,
        recordType,
        async (queryId, variantId) => {
          const rows = fixtures.suiteql[`${queryId}.${variantId}`];
          if (!rows) {
            throw new LoupeError('TABLE_UNAVAILABLE', `No fixture for ${queryId}.${variantId}.`);
          }
          return rows;
        },
        now,
      );
    },
  };
}
