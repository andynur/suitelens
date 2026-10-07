import { describe, expect, it } from 'vitest';
import transactionRows from '../../../../fixtures/suiteql/metadata.transaction.json';
import { mapMetadata } from '../../../netsuite/queries/metadata';
import { SUITEQL_FIXTURE_ANSWER, type SchemaTable } from '../prompts/suiteql';
import { extractSql, extractSqlBlocks, validateSuiteQL } from './validate';

/** Fixture schema: identifier names the fixture index holds for the acceptance question. */
const INDEX: SchemaTable[] = [
  { name: 'transaction', columns: ['id', 'tranid', 'trandate', 'type', 'entity', 'custbody_demo'] },
  { name: 'customer', columns: ['id', 'entityid'] },
  { name: 'transactionline', columns: ['custcol_demo'] },
];

describe('extractSqlBlocks', () => {
  it('returns sql and untagged blocks, skipping other languages', () => {
    const text = 'a\n```js\nx()\n```\n```sql\nSELECT 1 FROM dual\n```\n```\nSELECT 2\n```';
    expect(extractSqlBlocks(text)).toEqual(['SELECT 1 FROM dual', 'SELECT 2']);
  });
  it('accepts an unterminated block while streaming', () => {
    expect(extractSql('```sql\nSELECT t.id FROM transaction t')).toBe(
      'SELECT t.id FROM transaction t',
    );
    expect(extractSql('no code here')).toBeUndefined();
  });
});

describe('validateSuiteQL', () => {
  it('validates the acceptance answer cleanly against the fixture schema', () => {
    const sql = extractSql(SUITEQL_FIXTURE_ANSWER)!;
    expect(sql).toMatch(/^SELECT \*/);
    expect(validateSuiteQL(sql, INDEX)).toEqual({ issues: [], tables: ['transaction'] });
  });

  it('validates the acceptance answer against the index built from the fixture account', () => {
    const index = mapMetadata('transaction', transactionRows);
    expect(validateSuiteQL(extractSql(SUITEQL_FIXTURE_ANSWER)!, index).issues).toEqual([]);
  });

  it('flags a made-up column before running', () => {
    const sql = extractSql(SUITEQL_FIXTURE_ANSWER)!.replace(
      't.trandate,',
      't.trandate, t.salesrepname,',
    );
    expect(validateSuiteQL(sql, INDEX).issues).toEqual([
      { kind: 'unknownColumn', table: 'transaction', column: 'salesrepname' },
    ]);
  });

  it('resolves join aliases, unqualified columns and ignores literals, comments and functions', () => {
    const sql = `-- latest orders: t.ignored
      SELECT t.tranid, c.entityid AS name, TO_CHAR(t.trandate, 'YYYY') AS yr, /* c.nope */ tranid
      FROM transaction t LEFT JOIN customer c ON c.id = t.entity
      WHERE t.type = 'SalesOrd' AND t.tranid LIKE 'x.y%' AND t.id > :minid
      ORDER BY name DESC, yr`;
    expect(validateSuiteQL(sql, INDEX).issues).toEqual([]);
  });

  it('flags unknown tables, aliases and unqualified columns', () => {
    const result = validateSuiteQL(
      'SELECT v.id, x.foo FROM vendor v, transaction t WHERE t.bogus = 1',
      INDEX,
    );
    expect(result.tables).toEqual(['vendor', 'transaction']);
    expect(result.issues).toEqual([
      { kind: 'unknownTable', table: 'vendor' },
      { kind: 'unknownAlias', alias: 'x', column: 'foo' },
      { kind: 'unknownColumn', table: 'transaction', column: 'bogus' },
    ]);
    expect(validateSuiteQL('SELECT nope FROM transaction', INDEX).issues).toEqual([
      { kind: 'unknownColumn', table: 'transaction', column: 'nope' },
    ]);
  });

  it('does not judge unqualified columns when a table is outside the index', () => {
    expect(validateSuiteQL('SELECT foo FROM vendor', INDEX).issues).toEqual([
      { kind: 'unknownTable', table: 'vendor' },
    ]);
  });

  it('handles CTEs, derived tables and EXTRACT … FROM', () => {
    const sql = `WITH so AS (SELECT t.id FROM transaction t)
      SELECT so.id, d.n, EXTRACT(YEAR FROM t2.trandate) AS y
      FROM so JOIN (SELECT c.id AS n FROM customer c) d ON d.n = so.id
      JOIN transaction t2 ON t2.id = so.id`;
    expect(validateSuiteQL(sql, INDEX)).toEqual({
      issues: [],
      tables: ['transaction', 'customer'],
    });
  });

  it('flags non-SELECT and multiple statements', () => {
    expect(validateSuiteQL("UPDATE transaction SET memo = 'x'", INDEX).issues).toContainEqual({
      kind: 'notSelect',
    });
    expect(
      validateSuiteQL('SELECT t.id FROM transaction t; DELETE FROM transaction', INDEX).issues,
    ).toContainEqual({ kind: 'multipleStatements' });
    expect(validateSuiteQL('SELECT t.id FROM transaction t;', INDEX).issues).toEqual([]);
  });
});
