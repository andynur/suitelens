import type { RecordPayloadNode } from '../../netsuite/parsers/recordPayload';

export type ComparedField = {
  path: string;
  left?: string;
  right?: string;
  status: 'same' | 'changed' | 'leftOnly' | 'rightOnly';
};

/** Match XML fields by name/identifier and occurrence, never by their values. */
function fields(root: RecordPayloadNode): Map<string, string> {
  const result = new Map<string, string>();
  const visit = (node: RecordPayloadNode, path: string) => {
    for (const [name, value] of Object.entries(node.attributes))
      result.set(`${path}/@${name}`, value);
    const children = node.content.filter((part) => typeof part !== 'string');
    if (!children.length) result.set(path, node.content.join(''));
    else {
      const occurrences = new Map<string, number>();
      for (const part of node.content) {
        if (typeof part === 'string') {
          const index = (occurrences.get('#text') ?? 0) + 1;
          occurrences.set('#text', index);
          result.set(`${path}/#text[${index}]`, part);
          continue;
        }
        const identity =
          part.attributes.name ?? (part.name === 'field' ? part.attributes.id : undefined);
        const segment = `${part.name}${identity === undefined ? '' : `[${JSON.stringify(identity)}]`}`;
        const index = (occurrences.get(segment) ?? 0) + 1;
        occurrences.set(segment, index);
        visit(part, `${path}/${segment}[${index}]`);
      }
    }
  };
  visit(root, root.name);
  return result;
}

export function comparePayloads(
  left: RecordPayloadNode,
  right: RecordPayloadNode,
): ComparedField[] {
  const a = fields(left);
  const b = fields(right);
  return Array.from(new Set([...a.keys(), ...b.keys()]), (path) => ({
    path,
    left: a.get(path),
    right: b.get(path),
    status: !a.has(path)
      ? 'rightOnly'
      : !b.has(path)
        ? 'leftOnly'
        : a.get(path) === b.get(path)
          ? 'same'
          : 'changed',
  }));
}
