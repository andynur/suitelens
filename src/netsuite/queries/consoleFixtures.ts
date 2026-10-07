import { EXECUTION_LOGS_SQL } from './logs';
import { RESTLET_DEPLOYMENTS_SQL } from './restlets';
import { transactionLinksQuery, TRANSACTION_LIMITS } from './transactions';
import { METADATA_SOURCES } from './metadata';
import { CONSOLE_EXAMPLES } from './consoleExamples';
import {
  FILE_BATCH_SIZE,
  fileDetailsSql,
  folderFilesSql,
  BUNDLE_ROOT_SQL,
  folderParentsSql,
  SCRIPT_FILE_IDS_SQL,
  subfoldersSql,
} from './impactFiles';
import { SuiteLensError } from '../errors';
import {
  CONTEXT_SOURCE_BATCH,
  contextFieldsSql,
  contextRecordNamesSql,
  contextCustomRecordsSql,
} from './contextSources';

/** Exact fixture examples, not a fake SQL engine. Unknown SQL must fail explicitly. */
export function resolveConsoleFixture(
  sql: string,
  fixtures: Record<string, unknown[]>,
  params: (string | number | boolean)[] = [],
): unknown[] {
  const normalized = sql.trim().replace(/;\s*$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (normalized === EXECUTION_LOGS_SQL.replace(/\s+/g, ' ').toLowerCase()) {
    const rows = fixtures['logs.execution'];
    if (!rows) throw new SuiteLensError('TABLE_UNAVAILABLE', 'No execution log fixture.');
    return rows;
  }
  if (normalized === RESTLET_DEPLOYMENTS_SQL.replace(/\s+/g, ' ').toLowerCase()) {
    const rows = fixtures['restlets.deployments'];
    if (!rows) throw new SuiteLensError('TABLE_UNAVAILABLE', 'No RESTlet deployment fixture.');
    return rows;
  }
  for (let size = 1; size <= TRANSACTION_LIMITS.batch; size++) {
    const candidate = transactionLinksQuery(Array.from({ length: size }, () => '1'));
    if (candidate.sql.replace(/\s+/g, ' ').toLowerCase() !== normalized) continue;
    const ids = params.slice(0, size).map(String);
    if (params.length !== size * 2 || ids.some((id, index) => id !== String(params[size + index])))
      throw new SuiteLensError('QUERY_FAILED', 'Invalid relationship fixture parameters.');
    const rows = fixtures['transactions.links'];
    if (!rows) throw new SuiteLensError('TABLE_UNAVAILABLE', 'No relationship fixture.');
    return rows.filter((raw) => {
      const row = raw as { previousid: string | number; nextid: string | number };
      return ids.includes(String(row.previousid)) || ids.includes(String(row.nextid));
    });
  }
  const impactRows = (key: string): unknown[] => {
    const rows = fixtures[key];
    if (!rows) throw new SuiteLensError('TABLE_UNAVAILABLE', 'No impact file fixture.');
    return rows;
  };
  const sameSql = (candidate: string) =>
    normalized === candidate.trim().replace(/\s+/g, ' ').toLowerCase();
  if (params.length >= 1 && params.length <= CONTEXT_SOURCE_BATCH) {
    const wanted = params.map(String);
    const matches = (key: string, column: string) => {
      const rows = fixtures[key];
      if (!rows) throw new SuiteLensError('TABLE_UNAVAILABLE', 'No context source fixture.');
      return rows.filter((raw) =>
        wanted.includes(String((raw as Record<string, unknown>)[column])),
      );
    };
    if (sameSql(contextFieldsSql(params.length))) return matches('context.fields', 'scriptid');
    if (sameSql(contextRecordNamesSql(params.length)))
      return matches('context.recordNames', 'name');
    if (sameSql(contextCustomRecordsSql(params.length)))
      return matches('context.customRecords', 'internalid');
  }
  if (sameSql(BUNDLE_ROOT_SQL)) return impactRows('impact.bundleRoot');
  if (sameSql(SCRIPT_FILE_IDS_SQL)) {
    const seen = new Set<string>();
    return impactRows('impact.scriptFiles')
      .map((raw) => (raw as { id: string | number }).id)
      .filter((id) => !seen.has(String(id)) && seen.add(String(id)))
      .map((id) => ({ id }));
  }
  const size = params.length;
  if (size >= 1 && size <= FILE_BATCH_SIZE) {
    const wanted = params.map(String);
    const matches = (column: string, key: string) =>
      impactRows(key).filter((raw) =>
        wanted.includes(String((raw as Record<string, unknown>)[column])),
      );
    if (sameSql(fileDetailsSql(size))) return matches('id', 'impact.scriptFiles');
    if (sameSql(folderFilesSql(size))) return matches('folder', 'impact.folderFiles');
    if (sameSql(subfoldersSql(size))) return matches('parent', 'impact.subfolders');
    if (sameSql(folderParentsSql(size))) return matches('id', 'impact.folderParents');
  }
  const source = METADATA_SOURCES.find((source) => source.sql.toLowerCase() === normalized);
  if (source && fixtures[`metadata.${source.id}`]) return fixtures[`metadata.${source.id}`]!;
  const example = CONSOLE_EXAMPLES.find((example) => example.sql.toLowerCase() === normalized);
  if (example && fixtures[`example.${example.id}`]) return fixtures[`example.${example.id}`]!;
  if (normalized === 'select * from transaction where id = 1001 order by id')
    return [{ id: 1001, tranid: 'SO-DEMO-001' }];
  const large = /^select id, tranid from transaction where rownum <= (6001|\?) order by id$/.exec(
    normalized,
  );
  if (large) {
    const count = large[1] === '?' ? Number(params[0]) : 6001;
    if (!Number.isInteger(count) || count < 0 || count > 100_000)
      throw new SuiteLensError('QUERY_FAILED', 'Invalid fixture row count.');
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      tranid: `SO-DEMO-${index + 1}`,
    }));
  }
  const key =
    normalized === 'select id, tranid from transaction where rownum <= 10'
      ? 'console.transactions'
      : normalized === 'select id from transaction where rownum <= 10'
        ? 'console.transactionIds'
        : undefined;
  if (!key || !fixtures[key])
    throw new SuiteLensError(
      'QUERY_FAILED',
      'No matching console fixture.',
      'Fixture mode supports SELECT id, tranid FROM transaction WHERE ROWNUM <= 10 and SELECT id FROM transaction WHERE ROWNUM <= 10.',
    );
  return fixtures[key];
}
