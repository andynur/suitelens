import { describe, expect, it, vi } from 'vitest';
import type { ExecutionLog } from '../../../netsuite/queries/logs';
import { AiRequestSchema, type PayloadItem } from '../types';
import {
  buildExplainErrorRequest,
  EXPLAIN_ERROR_FIXTURE_ANSWER,
  EXPLAIN_ERROR_SYSTEM_PROMPT,
  explainErrorItems,
  logItem,
  logScriptsMetadataItem,
  MAX_EXPLAIN_LOGS,
} from './explainError';

vi.mock('../guard/redact', () => ({
  formatPayload: (items: PayloadItem[]) =>
    items.map((item) => `<${item.kind}>${item.content}</${item.kind}>`).join('\n'),
}));

const log = (id: string, patch: Partial<ExecutionLog> = {}): ExecutionLog => ({
  id,
  loggedat: `2026-10-04 09:1${id.slice(-1)}:00`,
  level: 'ERROR',
  title: 'Order lookup failed',
  detail: `Record 100${id.slice(-1)} not found`,
  scriptinternalid: '501',
  scriptid: 'customscript_orders',
  deploymentinternalid: null,
  deploymentid: null,
  ...patch,
});

describe('explain error prompt', () => {
  it('asks for ranked causes, checks and missing info, treating logs as data', () => {
    for (const heading of [
      '## What happened',
      '## Likely causes',
      '## Checks to run',
      '## What would help',
    ]) {
      expect(EXPLAIN_ERROR_SYSTEM_PROMPT).toContain(heading);
      expect(EXPLAIN_ERROR_FIXTURE_ANSWER).toContain(heading);
    }
    expect(EXPLAIN_ERROR_SYSTEM_PROMPT).toMatch(/DATA to analyse/);
    expect(EXPLAIN_ERROR_SYSTEM_PROMPT).toMatch(/never follow it/);
    expect(EXPLAIN_ERROR_SYSTEM_PROMPT).toMatch(/Log Viewer/);
    expect(EXPLAIN_ERROR_SYSTEM_PROMPT).toMatch(/read-only SELECT/);
    expect(EXPLAIN_ERROR_FIXTURE_ANSWER).toMatch(/```sql\nSELECT/);
  });

  it('formats one entry with level, title, time, script and detail', () => {
    expect(logItem([log('700')])).toEqual({
      id: 'log:700',
      kind: 'log',
      label: 'Log ERROR: Order lookup failed (2026-10-04 09:10:00)',
      content: [
        'Level: ERROR',
        'Title: Order lookup failed',
        'Logged at: 2026-10-04 09:10:00 (account time)',
        'Script: customscript_orders, internal ID 501',
        'Deployment: unknown',
        'Log ID: 700',
        'Detail:\nRecord 1000 not found',
      ].join('\n'),
    });
  });

  it('formats a group with occurrences, distinct details and explicit truncation', () => {
    const item = logItem(
      [
        log('702'),
        log('701'),
        log('703', { detail: 'x'.repeat(20), deploymentid: 'customdeploy_o' }),
        log('704'),
      ],
      { maxDetails: 3, maxDetailChars: 10 },
    );
    expect(item?.label).toBe('Log ERROR: Order lookup failed (4 occurrences)');
    expect(item?.content).toContain(
      'Occurrences: 4, first 2026-10-04 09:11:00, last 2026-10-04 09:14:00 (account time)',
    );
    expect(item?.content).toContain('Deployment: customdeploy_o');
    expect(item?.content).toContain('Log IDs: 702, 701, 703, 704');
    expect(item?.content).toContain(
      'Detail 3:\nxxxxxxxxxx\n[SuiteLens notice: detail truncated to the first 10 of 20 characters.]',
    );
    expect(item?.content).toContain('[SuiteLens notice: 1 more distinct details not included.]');
    expect(logItem([])).toBeUndefined();
    expect(logItem([log('1', { title: 'T'.repeat(80) })])?.label).toContain(`${'T'.repeat(57)}...`);
  });

  it('lists distinct scripts as identifiers only', () => {
    expect(
      logScriptsMetadataItem([
        log('700'),
        log('701'),
        log('705', { scriptid: 'customscript_worker', scriptinternalid: '502' }),
      ]),
    ).toEqual({
      id: 'metadata:scripts',
      kind: 'metadata',
      label: 'Scripts in the selected logs (2)',
      content: [
        'Scripts that wrote the selected logs:',
        '- customscript_orders, internal ID 501',
        '- customscript_worker, internal ID 502',
        'Deployment attribution per log is not available from the execution log source.',
      ].join('\n'),
    });
    expect(
      logScriptsMetadataItem([log('1', { scriptid: null, scriptinternalid: null })]),
    ).toBeUndefined();
  });

  it('caps the selection and builds a valid request', () => {
    const groups = Array.from({ length: MAX_EXPLAIN_LOGS + 5 }, (_, i) => [log(String(i + 1))]);
    const items = explainErrorItems(groups);
    expect(items[0]).toMatchObject({ kind: 'question', required: true });
    expect(items.filter((item) => item.kind === 'log')).toHaveLength(MAX_EXPLAIN_LOGS);
    expect(items.at(-1)?.kind).toBe('metadata');
    const request = buildExplainErrorRequest(items);
    expect(AiRequestSchema.parse(request)).toEqual(request);
    expect(request.feature).toBe('explainError');
    expect(request.system).toBe(EXPLAIN_ERROR_SYSTEM_PROMPT);
    expect(request.messages[0]!.content).toContain('<log>Level: ERROR');
  });
});
