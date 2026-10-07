import { t } from '../../shared/i18n';
import type { PageContext } from '../types';
import type { Snippet } from '../../shared/storage/consoleLibrary';

// VERIFY: metadata table columns and role visibility in the account Records Catalog.
export const CONSOLE_EXAMPLES: Snippet[] = [
  {
    id: 'transactions',
    name: t('console.exampleTransactions'),
    description: t('console.exampleTransactionsBody'),
    tags: ['transactions'],
    sql: 'SELECT id, tranid FROM transaction WHERE ROWNUM <= 10 ORDER BY id DESC',
    variables: [],
  },
  {
    id: 'scripts',
    name: t('console.exampleScripts'),
    description: t('console.exampleScriptsBody'),
    tags: ['scripts'],
    sql: "SELECT id, scriptid, name FROM script WHERE isinactive = 'F' ORDER BY id",
    variables: [],
  },
  {
    id: 'fields',
    name: t('console.exampleFields'),
    description: t('console.exampleFieldsBody'),
    tags: ['metadata'],
    sql: 'SELECT scriptid, name FROM customfield WHERE recordtype = ? ORDER BY scriptid',
    variables: [{ name: t('console.exampleRecordType'), type: 'number', value: '' }],
  },
];
function recordTable(context: PageContext): string | undefined {
  if (!context.recordId || !/^\d+$/.test(context.recordId)) return;
  const type = context.recordType ?? '';
  const table =
    /^(salesorder|purchaseorder|invoice|vendorbill|cashsale|creditmemo|itemreceipt|itemfulfillment|journalentry)$/.test(
      type,
    )
      ? 'transaction'
      : type;
  if (!/^(customer|vendor|employee|contact|item|transaction|customrecord_[a-z0-9_]+)$/.test(table))
    return;
  return table;
}

export function recordConsoleSql(context: PageContext): string | undefined {
  const table = recordTable(context);
  if (!table) return;
  // VERIFY: custom record and item visibility depends on the account's analytics schema.
  return `SELECT * FROM ${table} WHERE id = ${context.recordId} ORDER BY id`;
}

/** Custom body field prefixes per SuiteQL table. Line fields (custcol_) are not offered. */
const CUSTOM_FIELD_PREFIX: Record<string, RegExp> = {
  transaction: /^custbody_/,
  customer: /^custentity_/,
  vendor: /^custentity_/,
  employee: /^custentity_/,
  contact: /^custentity_/,
  item: /^custitem_/,
};

/**
 * One custom body field of the current record. Only custom field IDs are used, because standard
 * record field IDs often differ from SuiteQL column names.
 */
export function fieldConsoleSql(context: PageContext, fieldId: string): string | undefined {
  const table = recordTable(context);
  if (!table || !/^[a-z0-9_]{1,100}$/.test(fieldId)) return;
  const prefix = table.startsWith('customrecord_') ? /^custrecord_/ : CUSTOM_FIELD_PREFIX[table];
  if (!prefix?.test(fieldId)) return;
  // VERIFY: a custom field is a column of its record table only when it is stored and exposed
  // to SuiteQL (not every field type is); the console shows NetSuite's error otherwise.
  return `SELECT id, ${fieldId} FROM ${table} WHERE id = ${context.recordId}`;
}
