import { expect, it } from 'vitest';
import { CONSOLE_EXAMPLES, fieldConsoleSql, recordConsoleSql } from './consoleExamples';
import { ConsoleRowsSchema, validateConsoleSql } from './console';
import { resolveConsoleFixture } from './consoleFixtures';
import { loadFixtureSet } from '../adapter/fixtureSet';
import { recordContext } from '../../test/adapters';
it('validates and maps every built-in example using fake result fixtures', () => {
  const fixtures = loadFixtureSet().suiteql;
  for (const example of CONSOLE_EXAMPLES) {
    const sql = validateConsoleSql(example.sql);
    const params = example.variables.map(() => 1);
    expect(
      ConsoleRowsSchema.parse(resolveConsoleFixture(sql, fixtures, params)).length,
    ).toBeGreaterThan(0);
  }
});
it('generates supported record reads and declines unknown types or unsafe IDs', () => {
  const context = recordContext();
  expect(recordConsoleSql(context)).toBe('SELECT * FROM transaction WHERE id = 1001 ORDER BY id');
  expect(recordConsoleSql({ ...context, recordType: 'customer', recordId: '2001' })).toContain(
    'FROM customer',
  );
  expect(
    recordConsoleSql({ ...context, recordType: 'customrecord_demo', recordId: '5' }),
  ).toContain('FROM customrecord_demo');
  expect(recordConsoleSql({ ...context, recordType: 'unknown' })).toBeUndefined();
  expect(recordConsoleSql({ ...context, recordId: '1; DELETE' })).toBeUndefined();
});

it('builds single custom field reads and declines standard, line or unsafe field IDs', () => {
  const context = recordContext();
  expect(fieldConsoleSql(context, 'custbody_demo_flag')).toBe(
    'SELECT id, custbody_demo_flag FROM transaction WHERE id = 1001',
  );
  expect(
    fieldConsoleSql({ ...context, recordType: 'customer', recordId: '2001' }, 'custentity_tier'),
  ).toContain('FROM customer');
  expect(
    fieldConsoleSql({ ...context, recordType: 'customrecord_demo', recordId: '5' }, 'custrecord_x'),
  ).toContain('FROM customrecord_demo');
  expect(fieldConsoleSql(context, 'memo')).toBeUndefined();
  expect(fieldConsoleSql(context, 'custcol_line')).toBeUndefined();
  expect(fieldConsoleSql(context, 'custentity_tier')).toBeUndefined();
  expect(fieldConsoleSql(context, 'custbody_x, password')).toBeUndefined();
  expect(fieldConsoleSql({ ...context, recordType: 'unknown' }, 'custbody_x')).toBeUndefined();
});
