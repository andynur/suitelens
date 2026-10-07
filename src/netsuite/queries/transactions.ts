import { z } from 'zod';
import { findMappingByType } from '../context/recordTypeMap';
import { SuiteLensError } from '../errors';
import {
  throwIfCancelled,
  waitForConsole,
  type ConsoleOptions,
  type ConsoleResult,
} from './console';

export const TRANSACTION_LIMITS = { nodes: 100, edges: 500, depth: 4, batch: 25 } as const;
const idSchema = z
  .union([z.string(), z.number().int().positive()])
  .transform(String)
  .pipe(
    z
      .string()
      .regex(/^[1-9]\d*$/)
      .max(20),
  );
const text = z.string().max(1000);
export const TransactionLinkRowSchema = z.object({
  previousid: idSchema,
  previousnumber: text.nullable(),
  previoustype: text.min(1),
  nextid: idSchema,
  nextnumber: text.nullable(),
  nexttype: text.min(1),
  linktype: text.nullable(),
});
export type TransactionNode = { id: string; number: string; type: string };
export type TransactionEdge = { previous: string; next: string; linkType: string };
export type TransactionGraph = {
  rootId: string;
  nodes: TransactionNode[];
  edges: TransactionEdge[];
  limited: boolean;
};
export type TransactionBranch = {
  node: TransactionNode;
  direction?: 'previous' | 'next';
  linkType?: string;
  reference: boolean;
  children: TransactionBranch[];
};

export function isTransactionType(recordType: string): boolean {
  return !!findMappingByType(recordType)?.path.startsWith('/app/accounting/transactions/');
}

/** VERIFY: NextTransactionLineLink, previousdoc/nextdoc/linktype and transaction
 * id/tranid/type in the account Records Catalog; visibility and link semantics vary by role.
 * Do not manufacture a chronological chain from transaction types. */
export function transactionLinksQuery(ids: readonly string[]) {
  if (
    !ids.length ||
    ids.length > TRANSACTION_LIMITS.batch ||
    ids.some((id) => !idSchema.safeParse(id).success)
  )
    throw new SuiteLensError('UNSUPPORTED', 'Invalid transaction IDs.');
  const placeholders = ids.map(() => '?').join(', ');
  return {
    sql: `SELECT DISTINCT
  p.id AS previousid, p.tranid AS previousnumber, p.type AS previoustype,
  n.id AS nextid, n.tranid AS nextnumber, n.type AS nexttype,
  l.linktype AS linktype
FROM NextTransactionLineLink l
INNER JOIN transaction p ON p.id = l.previousdoc
INNER JOIN transaction n ON n.id = l.nextdoc
WHERE l.previousdoc IN (${placeholders}) OR l.nextdoc IN (${placeholders})
ORDER BY previousid, nextid, linktype`,
    params: [...ids, ...ids],
  };
}

export function mapTransactionLinks(rows: unknown[]) {
  const nodes = new Map<string, TransactionNode>();
  const edges = new Map<string, TransactionEdge>();
  for (const raw of rows) {
    const parsed = TransactionLinkRowSchema.safeParse(raw);
    if (!parsed.success)
      throw new SuiteLensError(
        'INVALID_RESPONSE',
        'Unexpected transaction relationship columns.',
        'Related transactions could not be read. Verify relationship table columns in the account Records Catalog.',
      );
    const row = parsed.data;
    nodes.set(row.previousid, {
      id: row.previousid,
      number: row.previousnumber || row.previousid,
      type: row.previoustype,
    });
    nodes.set(row.nextid, {
      id: row.nextid,
      number: row.nextnumber || row.nextid,
      type: row.nexttype,
    });
    if (row.previousid === row.nextid) continue;
    const edge = { previous: row.previousid, next: row.nextid, linkType: row.linktype ?? '' };
    edges.set(JSON.stringify(edge), edge);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/** Bounded bidirectional breadth-first walk. Results remain in caller memory only. */
export async function loadTransactionGraph(
  root: TransactionNode,
  run: (sql: string, options: ConsoleOptions) => Promise<ConsoleResult>,
  options: Pick<ConsoleOptions, 'accountId' | 'signal'>,
): Promise<TransactionGraph> {
  if (!idSchema.safeParse(root.id).success)
    throw new SuiteLensError('UNSUPPORTED', 'Open a saved transaction with a valid internal ID.');
  return waitForConsole(async (signal) => {
    const nodes = new Map([[root.id, root]]);
    const edges = new Map<string, TransactionEdge>();
    const visited = new Set<string>();
    let frontier = [root.id];
    let limited = false;
    for (let depth = 0; frontier.length && depth < TRANSACTION_LIMITS.depth; depth++) {
      const next = new Set<string>();
      for (let offset = 0; offset < frontier.length; offset += TRANSACTION_LIMITS.batch) {
        throwIfCancelled(signal);
        const batch = frontier.slice(offset, offset + TRANSACTION_LIMITS.batch);
        batch.forEach((id) => visited.add(id));
        const query = transactionLinksQuery(batch);
        const result = await run(query.sql, {
          ...options,
          signal,
          params: query.params,
          maxRows: TRANSACTION_LIMITS.edges,
        });
        throwIfCancelled(signal);
        if (result.accountId !== options.accountId)
          throw new SuiteLensError(
            'ACCOUNT_MISMATCH',
            'Account changed while loading related transactions.',
          );
        limited ||= result.atLimit;
        const mapped = mapTransactionLinks(result.rows);
        const linked = new Set<string>();
        for (const edge of mapped.edges) {
          if (!batch.includes(edge.previous) && !batch.includes(edge.next))
            throw new SuiteLensError('INVALID_RESPONSE', 'Unrelated transaction returned.');
          for (const id of [edge.previous, edge.next]) {
            if (nodes.has(id)) {
              nodes.set(
                id,
                mapped.nodes.find((node) => node.id === id)!,
              );
              continue;
            }
            if (nodes.size >= TRANSACTION_LIMITS.nodes) {
              limited = true;
              continue;
            }
            nodes.set(
              id,
              mapped.nodes.find((node) => node.id === id)!,
            );
          }
          if (!nodes.has(edge.previous) || !nodes.has(edge.next)) continue;
          const key = JSON.stringify(edge);
          if (!edges.has(key) && edges.size >= TRANSACTION_LIMITS.edges) {
            limited = true;
            continue;
          }
          edges.set(key, edge);
          linked.add(edge.previous);
          linked.add(edge.next);
        }
        for (const id of linked) if (!visited.has(id)) next.add(id);
      }
      frontier = [...next].filter((id) => !visited.has(id));
    }
    limited ||= frontier.length > 0;
    return { rootId: root.id, nodes: [...nodes.values()], edges: [...edges.values()], limited };
  }, options.signal);
}

/** A disclosure tree projection of a graph; shared/cyclic nodes become reference leaves. */
export function transactionBranches(graph: TransactionGraph): TransactionBranch {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const walk = (
    id: string,
    parent?: string,
    direction?: TransactionBranch['direction'],
    linkType?: string,
  ): TransactionBranch => {
    const reference = seen.has(id);
    seen.add(id);
    const children: TransactionBranch[] = [];
    if (!reference) {
      for (const edge of graph.edges) {
        if (edge.previous === id && edge.next !== parent)
          children.push(walk(edge.next, id, 'next', edge.linkType));
        else if (edge.next === id && edge.previous !== parent)
          children.push(walk(edge.previous, id, 'previous', edge.linkType));
      }
    }
    return { node: nodes.get(id)!, direction, linkType, reference, children };
  };
  return walk(graph.rootId);
}
