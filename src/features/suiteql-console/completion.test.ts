import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { expect, it } from 'vitest';
import { metadataCompletion } from './completion';
it('suggests table columns after aliases and completes table names locally', () => {
  const complete = metadataCompletion([
    { name: 'transaction', columns: ['id', 'tranid'], source: 'observed' },
  ]);
  const state = EditorState.create({ doc: 'SELECT t. FROM transaction t' });
  const result = complete(new CompletionContext(state, 9, true));
  expect(result?.options.map((option) => option.label)).toEqual(['id', 'tranid']);
  const table = EditorState.create({ doc: 'SELECT * FROM tra' });
  expect(
    complete(new CompletionContext(table, table.doc.length, true))?.options.map(
      (option) => option.label,
    ),
  ).toContain('transaction');
});
