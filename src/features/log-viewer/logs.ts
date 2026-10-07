import type { ExecutionLog } from '../../netsuite/queries/logs';
export type LogFilters = {
  script: string;
  deployment: string;
  level: string;
  from: string;
  to: string;
  text: string;
};
export const EMPTY_LOG_FILTERS: LogFilters = {
  script: '',
  deployment: '',
  level: '',
  from: '',
  to: '',
  text: '',
};
/** Dates use the normalized account timestamp, without guessing a UTC offset. */
export function filterLogs(items: ExecutionLog[], filters: LogFilters) {
  const includes = (value: string | null, needle: string) =>
    (value ?? '').toLowerCase().includes(needle.trim().toLowerCase());
  return items.filter(
    (item) =>
      (!filters.script ||
        [item.scriptid, item.scriptinternalid].some((v) => includes(v, filters.script))) &&
      (!filters.deployment ||
        [item.deploymentid, item.deploymentinternalid].some((v) =>
          includes(v, filters.deployment),
        )) &&
      (!filters.level || item.level === filters.level) &&
      (!filters.from || item.loggedat >= filters.from.replace('T', ' ') + ':00') &&
      (!filters.to || item.loggedat <= filters.to.replace('T', ' ') + ':59') &&
      (!filters.text || [item.title, item.detail].some((v) => includes(v, filters.text))),
  );
}
/** Conservative normalization: retain error codes, replacing volatile UUIDs, timestamps and IDs. */
export function normalizeLogMessage(message: string) {
  return message
    .toLowerCase()
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, '<uuid>')
    .replace(/\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?\b/g, '<time>')
    .replace(/\b\d+\b/g, '<number>')
    .replace(/\s+/g, ' ')
    .trim();
}
export function groupLogs(items: ExecutionLog[]) {
  const groups = new Map<string, { key: string; items: ExecutionLog[] }>();
  for (const item of items) {
    const key =
      item.level === 'ERROR' || item.level === 'EMERGENCY'
        ? JSON.stringify([
            item.level,
            item.title.trim().toLowerCase(),
            normalizeLogMessage(item.detail),
          ])
        : JSON.stringify(['entry', item.id]);
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, items: [item] });
  }
  return [...groups.values()];
}
export function prettyLogDetail(detail: string) {
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    return detail;
  }
}
