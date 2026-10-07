import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownView, parseMarkdown } from './MarkdownView';

describe('parseMarkdown', () => {
  it('reads headings, lists, paragraphs and tables and hides empty columns', () => {
    const blocks = parseMarkdown(
      [
        '# Title',
        'Intro line',
        'continues.',
        '',
        '- one',
        '- two',
        '',
        '| ID | Label | Help |',
        '| --- | --- | --- |',
        '| memo | Memo | — |',
        '| entity | Customer |  |',
      ].join('\n'),
    );
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list', 'table']);
    expect(blocks[1]).toEqual({ kind: 'paragraph', text: 'Intro line continues.' });
    expect(blocks[3]).toEqual({
      kind: 'table',
      header: ['ID', 'Label'],
      rows: [
        ['memo', 'Memo'],
        ['entity', 'Customer'],
      ],
    });
  });
});

describe('MarkdownView', () => {
  it('renders text, never HTML', () => {
    render(<MarkdownView label="Preview" source={'## A\n<img src=x onerror=alert(1)> `code`'} />);
    const view = screen.getByRole('article', { name: 'Preview' });
    expect(view.querySelector('img')).toBeNull();
    expect(view).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(screen.getByRole('heading', { name: 'A' })).toBeInTheDocument();
  });
});
