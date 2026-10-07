import type { MetadataTable } from '../../../shared/storage/consoleLibrary';
import type { AiRequest, PayloadItem } from '../types';

/**
 * Natural language → SuiteQL (F-5.5–F-5.7, NF-5.3). The prompt and the schema summary are
 * identifier-only: table and column names from the partial metadata index, never record data.
 */

export type SchemaTable = Pick<MetadataTable, 'name' | 'columns'>;

// VERIFY: type codes, the ROWNUM top-N pattern (FETCH FIRST n ROWS ONLY is not relied on) and
// BUILTIN.DF are documented SuiteQL usage but not confirmed for every account/role; the
// post-generation validator and the Console run are the real check.
export const SUITEQL_SYSTEM_PROMPT = [
  'You write SuiteQL queries for Oracle NetSuite. SuiteQL is read-only and close to Oracle SQL.',
  '',
  'Rules:',
  '- Write exactly one read-only SELECT statement (WITH ... SELECT is fine). Never write INSERT, UPDATE, DELETE, MERGE, DDL or several statements. Do not end with a semicolon.',
  '- Use only tables and columns listed in the schema summary. The summary is a partial index of the account: if the question needs a table or column that is not listed, say so plainly in the explanation instead of guessing, and keep such names out of the query when you can.',
  '- Give every table an alias and qualify every column with it (t.tranid, not tranid). Name computed columns with AS.',
  '- Limit rows with ROWNUM. For "the N latest/top" rows, sort inside a subquery and filter outside: SELECT * FROM (SELECT ... ORDER BY ...) WHERE ROWNUM <= N. Do not use LIMIT or TOP.',
  '- Use BUILTIN.DF(alias.column) for the display name of a list or record reference, e.g. BUILTIN.DF(t.entity) for the customer name of a transaction.',
  "- Every transaction kind lives in the transaction table; filter by type code, e.g. t.type = 'SalesOrd' (sales order), 'CustInvc' (invoice), 'PurchOrd' (purchase order), 'VendBill' (vendor bill), 'CustPymt' (customer payment), 'Estimate' (quote), 'ItemShip' (item fulfillment), 'Journal' (journal entry). Lines are in transactionline, joined on tl.transaction = t.id.",
  "- Compare dates with TO_DATE('2026-01-31', 'YYYY-MM-DD') or relative to SYSDATE. Booleans are 'T'/'F'.",
  '- Use literal values from the question; never invent internal IDs.',
  '',
  'Answer format: one ```sql code block with the query, then at most five short sentences explaining what it returns and any assumption or missing schema element. No other code blocks.',
].join('\n');

/** Canned answer streamed by the dev/E2E `fixture` provider for this feature. */
export const SUITEQL_FIXTURE_ANSWER = [
  '```sql',
  'SELECT *',
  'FROM (',
  '  SELECT t.id, t.tranid, t.trandate, BUILTIN.DF(t.entity) AS customer_name',
  '  FROM transaction t',
  "  WHERE t.type = 'SalesOrd'",
  '  ORDER BY t.trandate DESC, t.id DESC',
  ')',
  'WHERE ROWNUM <= 10',
  '```',
  '',
  "Returns the 10 most recent sales orders (type code 'SalesOrd') with document number, date and the customer's display name. Rows are sorted newest first inside the subquery, then limited with ROWNUM.",
].join('\n');

/**
 * Small built-in list of common tables, used only when the account has no metadata index yet.
 * Labelled as such in the UI and the payload: it is not read from the account.
 * VERIFY: column availability differs per account, feature set and role.
 */
export const BUILTIN_SCHEMA: SchemaTable[] = [
  {
    name: 'transaction',
    columns: [
      'id',
      'tranid',
      'trandate',
      'type',
      'entity',
      'status',
      'memo',
      'currency',
      'foreigntotal',
      'createddate',
      'lastmodifieddate',
    ],
  },
  {
    name: 'transactionline',
    columns: [
      'id',
      'transaction',
      'linesequencenumber',
      'item',
      'quantity',
      'rate',
      'netamount',
      'mainline',
      'taxline',
      'subsidiary',
      'department',
      'location',
    ],
  },
  {
    name: 'customer',
    columns: ['id', 'entityid', 'companyname', 'email', 'phone', 'isinactive', 'datecreated'],
  },
  { name: 'vendor', columns: ['id', 'entityid', 'companyname', 'email', 'isinactive'] },
  { name: 'employee', columns: ['id', 'entityid', 'firstname', 'lastname', 'email', 'isinactive'] },
  { name: 'item', columns: ['id', 'itemid', 'displayname', 'itemtype', 'isinactive'] },
];

export type SchemaSummaryLimits = { maxTables: number; maxColumns: number };
export const DEFAULT_SCHEMA_LIMITS: SchemaSummaryLimits = { maxTables: 6, maxColumns: 60 };

export type SchemaSummaryTable = {
  name: string;
  columns: string[];
  /** Columns left out because of the column cap. */
  omitted: number;
};
export type SchemaSummary = {
  tables: SchemaSummaryTable[];
  /** Index tables not included in the summary. */
  omittedTables: number;
};

/** Words in the question (lower case) → tables they usually mean. */
const SYNONYMS: [RegExp, string[]][] = [
  [
    /\b(sales ?orders?|invoices?|purchase ?orders?|bills?|payments?|credit ?memos?|estimates?|quotes?|fulfill?ments?|journals?|transactions?|orders?|cash ?sales?|returns?|deposits?|checks?|receipts?)\b/,
    ['transaction'],
  ],
  [/\b(lines?|line items?|quantit(y|ies))\b/, ['transactionline']],
  [/\b(customers?|clients?)\b/, ['customer', 'entity']],
  [/\b(vendors?|suppliers?)\b/, ['vendor', 'entity']],
  [/\b(employees?|sales ?reps?)\b/, ['employee', 'entity']],
  [/\b(contacts?)\b/, ['contact', 'entity']],
  [/\b(items?|products?|skus?|inventory)\b/, ['item']],
  [/\b(subsidiar(y|ies))\b/, ['subsidiary']],
  [/\b(departments?)\b/, ['department']],
  [/\b(locations?|warehouses?)\b/, ['location']],
  [/\b(class|classes)\b/, ['classification']],
  [/\b(gl accounts?|accounts?)\b/, ['account']],
  [/\b(currenc(y|ies))\b/, ['currency']],
];

/** Columns listed first when a table has more columns than the cap. */
const PRIORITY_COLUMNS = [
  'id',
  'tranid',
  'trandate',
  'type',
  'entity',
  'status',
  'transaction',
  'item',
  'quantity',
  'rate',
  'netamount',
  'foreigntotal',
  'entityid',
  'companyname',
  'itemid',
  'displayname',
  'name',
  'email',
  'isinactive',
  'createddate',
  'lastmodifieddate',
];

const words = (text: string) => text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];

/**
 * Picks the tables relevant to the question (names, simple synonyms, mentioned column IDs) and
 * caps their columns so the payload stays small. Identifier names only, never record data.
 * Falls back to the first tables of the index when nothing matches.
 */
export function buildSchemaSummary(
  tables: SchemaTable[],
  question: string,
  limits: SchemaSummaryLimits = DEFAULT_SCHEMA_LIMITS,
): SchemaSummary {
  const lower = question.toLowerCase();
  const tokens = new Set(words(question));
  const wanted = new Set<string>();
  for (const [pattern, names] of SYNONYMS)
    if (pattern.test(lower)) names.forEach((name) => wanted.add(name));
  const score = (table: SchemaTable) => {
    const name = table.name.toLowerCase();
    let value = 0;
    if (tokens.has(name) || wanted.has(name)) value += 10;
    const bare = name.replace(/^customrecord_/, '');
    if (bare !== name && bare.split('_').some((part) => part.length > 2 && tokens.has(part)))
      value += 5;
    if (table.columns.some((column) => tokens.has(column.toLowerCase()))) value += 3;
    return value;
  };
  const ranked = tables
    .map((table, order) => ({ table, order, score: score(table) }))
    .sort((a, b) => b.score - a.score || a.order - b.order);
  const matched = ranked.filter((entry) => entry.score > 0);
  const chosen = (matched.length ? matched : ranked).slice(0, Math.max(0, limits.maxTables));
  const cap = Math.max(0, limits.maxColumns);
  const rank = (column: string) => {
    if (tokens.has(column)) return -1;
    const index = PRIORITY_COLUMNS.indexOf(column);
    return index === -1 ? PRIORITY_COLUMNS.length : index;
  };
  return {
    tables: chosen.map(({ table }) => {
      const sorted = [...new Set(table.columns.map((column) => column.toLowerCase()))]
        .map((column, order) => ({ column, order }))
        .sort((a, b) => rank(a.column) - rank(b.column) || a.order - b.order)
        .map((entry) => entry.column);
      return {
        name: table.name.toLowerCase(),
        columns: sorted.slice(0, cap),
        omitted: Math.max(0, sorted.length - cap),
      };
    }),
    omittedTables: tables.length - chosen.length,
  };
}

/** One summary line: `transaction: id, tranid, … (+12 more columns not listed)`. */
export function formatSchemaTable(table: SchemaSummaryTable): string {
  const more = table.omitted ? ` (+${table.omitted} more columns not listed)` : '';
  return `${table.name}: ${table.columns.join(', ')}${more}`;
}

export type SchemaSource = 'index' | 'builtin';

/** Header for the schema payload, so the model knows how complete the list is. */
export function schemaHeader(source: SchemaSource): string {
  return source === 'index'
    ? 'Schema summary from the partial metadata index of this account (table: columns). Other tables and columns may exist.'
    : 'No metadata index for this account yet. Built-in list of common NetSuite tables (table: columns), not read from the account; columns may differ.';
}

/**
 * Builds the request from the confirmed preview items (as edited by the user): schema items
 * first, then the question.
 */
export function buildSuiteqlRequest(items: PayloadItem[]): AiRequest {
  const context = items.filter((item) => item.kind !== 'question').map((item) => item.content);
  const question = items
    .filter((item) => item.kind === 'question')
    .map((item) => item.content.trim())
    .filter(Boolean)
    .join('\n');
  const content = [
    ...(context.length ? [context.join('\n')] : []),
    `Question: ${question || '(no question)'}`,
  ].join('\n\n');
  return {
    feature: 'suiteql',
    system: SUITEQL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  };
}
