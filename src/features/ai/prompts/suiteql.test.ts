import { describe, expect, it } from 'vitest';
import {
  BUILTIN_SCHEMA,
  buildSchemaSummary,
  buildSuiteqlRequest,
  formatSchemaTable,
  schemaHeader,
  SUITEQL_FIXTURE_ANSWER,
  SUITEQL_SYSTEM_PROMPT,
  type SchemaTable,
} from './suiteql';
import { AiRequestSchema } from '../types';
import { extractSqlBlocks, validateSuiteQL } from '../suiteql/validate';

const INDEX: SchemaTable[] = [
  { name: 'item', columns: ['id', 'itemid'] },
  {
    name: 'transaction',
    columns: ['custbody_demo', 'memo', 'entity', 'trandate', 'tranid', 'id', 'type'],
  },
  { name: 'customer', columns: ['id', 'entityid'] },
  { name: 'customrecord_suitelens_demo', columns: ['id', 'custrecord_demo_field'] },
  { name: 'transactionline', columns: ['custcol_demo'] },
];
const QUESTION = 'List the 10 latest sales orders with customer names';

describe('SUITEQL_SYSTEM_PROMPT', () => {
  it('states the dialect, read-only and schema rules and the answer format', () => {
    for (const rule of [
      'read-only SELECT',
      'ROWNUM',
      'BUILTIN.DF',
      "'SalesOrd'",
      'Use only tables and columns listed in the schema summary',
      'say so plainly',
      '```sql',
    ])
      expect(SUITEQL_SYSTEM_PROMPT).toContain(rule);
  });
});

describe('buildSchemaSummary', () => {
  it('picks transaction and customer for the acceptance question', () => {
    const summary = buildSchemaSummary(INDEX, QUESTION);
    expect(summary).toEqual({
      tables: [
        {
          name: 'transaction',
          columns: ['id', 'tranid', 'trandate', 'type', 'entity', 'custbody_demo', 'memo'],
          omitted: 0,
        },
        { name: 'customer', columns: ['id', 'entityid'], omitted: 0 },
      ],
      omittedTables: 3,
    });
    expect(summary.tables.map(formatSchemaTable)).toEqual([
      'transaction: id, tranid, trandate, type, entity, custbody_demo, memo',
      'customer: id, entityid',
    ]);
  });

  it('caps tables and columns, keeping mentioned columns first', () => {
    const summary = buildSchemaSummary(INDEX, 'orders by custbody_demo', {
      maxTables: 1,
      maxColumns: 3,
    });
    expect(summary.tables).toEqual([
      { name: 'transaction', columns: ['custbody_demo', 'id', 'tranid'], omitted: 4 },
    ]);
    expect(formatSchemaTable(summary.tables[0]!)).toBe(
      'transaction: custbody_demo, id, tranid (+4 more columns not listed)',
    );
  });

  it('matches custom record names and falls back to the first tables', () => {
    expect(buildSchemaSummary(INDEX, 'suitelens demo records').tables[0]?.name).toBe(
      'customrecord_suitelens_demo',
    );
    expect(
      buildSchemaSummary(INDEX, 'hello', { maxTables: 2, maxColumns: 5 }).tables.map((t) => t.name),
    ).toEqual(['item', 'transaction']);
  });

  it('never contains anything but identifier names', () => {
    const text = buildSchemaSummary(BUILTIN_SCHEMA, QUESTION)
      .tables.map(formatSchemaTable)
      .join('\n');
    expect(text).toMatch(/^[a-z0-9_:,() +\n]*$/);
  });
});

describe('buildSuiteqlRequest', () => {
  it('sends schema first, then the question, with the system prompt', () => {
    const request = buildSuiteqlRequest([
      { id: 'q', kind: 'question', label: 'Question', content: ` ${QUESTION} `, required: true },
      { id: 'h', kind: 'schema', label: 'Schema', content: schemaHeader('index') },
      { id: 's', kind: 'schema', label: 'transaction', content: 'transaction: id, tranid' },
    ]);
    expect(AiRequestSchema.parse(request)).toEqual({
      feature: 'suiteql',
      system: SUITEQL_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${schemaHeader('index')}\ntransaction: id, tranid\n\nQuestion: ${QUESTION}`,
        },
      ],
    });
  });
});

describe('SUITEQL_FIXTURE_ANSWER', () => {
  it('has exactly one sql block that validates against the fixture schema and built-in list', () => {
    const blocks = extractSqlBlocks(SUITEQL_FIXTURE_ANSWER);
    expect(blocks).toHaveLength(1);
    expect(validateSuiteQL(blocks[0]!, INDEX).issues).toEqual([]);
    expect(validateSuiteQL(blocks[0]!, BUILTIN_SCHEMA).issues).toEqual([]);
  });
});
