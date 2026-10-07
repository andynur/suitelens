import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { MetadataTable } from '../../shared/storage/consoleLibrary';

export function metadataCompletion(tables: MetadataTable[]) {
  const byName = new Map(tables.map((table) => [table.name.toLowerCase(), table.columns]));
  const names = tables.map((table) => ({ label: table.name, type: 'class' }));
  const functions = [
    'BUILTIN.DF',
    'BUILTIN.CONSOLIDATE',
    'COUNT',
    'SUM',
    'AVG',
    'MIN',
    'MAX',
    'NVL',
    'COALESCE',
    'TO_DATE',
    'TO_CHAR',
    'UPPER',
    'LOWER',
  ];
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[a-z0-9_.$]*/i);
    if (!word || (!word.text && !context.explicit)) return null;
    const dot = /^([a-z][a-z0-9_]*)\.([a-z0-9_]*)$/i.exec(word.text);
    if (dot) {
      const qualifier = dot[1]!.toLowerCase();
      // Skip literals/comments when discovering simple FROM/JOIN aliases.
      const document = context.state.doc
        .toString()
        .replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'/g, ' ');
      const aliases = [
        ...document.matchAll(
          /\b(?:FROM|JOIN)\s+([a-z][a-z0-9_]*)(?:\s+(?:AS\s+)?([a-z][a-z0-9_]*))?/gi,
        ),
      ];
      const table =
        aliases.find((match) => match[2]?.toLowerCase() === qualifier)?.[1]?.toLowerCase() ??
        qualifier;
      return {
        from: word.from + qualifier.length + 1,
        options: (byName.get(table) ?? []).map((label) => ({ label, type: 'property' })),
        validFor: /^[a-z0-9_]*$/i,
      };
    }
    return {
      from: word.from,
      options: [...names, ...functions.map((label) => ({ label, type: 'function' }))],
      validFor: /^[a-z0-9_.$]*$/i,
    };
  };
}
