import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PayloadItem } from '../types';
import type { AiRun, AiRunState } from '../useAiRequest';
import { AiResponse, splitFencedBlocks } from './AiResponse';

const ITEMS: PayloadItem[] = [
  { id: 'q', kind: 'question', label: 'Question', content: 'Open orders?', required: true },
];

function makeRun(state: Partial<AiRunState>): AiRun {
  return {
    state: { status: 'idle', items: ITEMS, text: '', ...state },
    preview: vi.fn(),
    cancelPreview: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
  };
}

describe('splitFencedBlocks', () => {
  it('splits prose and fenced code blocks in order', () => {
    const text = 'Try this:\n\n```SQL\nSELECT id\nFROM transaction\n```\nThen ~~~\n~~~js\nx()\n~~~';
    expect(splitFencedBlocks(text)).toEqual([
      { type: 'text', text: 'Try this:' },
      { type: 'code', lang: 'sql', code: 'SELECT id\nFROM transaction' },
      { type: 'text', text: 'Then ~~~' },
      { type: 'code', lang: 'js', code: 'x()' },
    ]);
  });

  it('treats an unclosed fence as code to the end and keeps longer fences intact', () => {
    expect(splitFencedBlocks('```\na\n')).toEqual([{ type: 'code', lang: '', code: 'a\n' }]);
    expect(splitFencedBlocks('````md\n```\ninner\n```\n````')).toEqual([
      { type: 'code', lang: 'md', code: '```\ninner\n```' },
    ]);
    expect(splitFencedBlocks('')).toEqual([]);
  });
});

describe('AiResponse', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<AiResponse run={makeRun({})} title="Ask" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the preview dialog and wires cancel and confirm', async () => {
    const user = userEvent.setup();
    const run = makeRun({ status: 'preview' });
    render(<AiResponse run={run} title="Ask SuiteQL" />);
    expect(screen.getByRole('dialog', { name: 'Ask SuiteQL' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(run.cancelPreview).toHaveBeenCalled();
    expect(run.confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(run.confirm).toHaveBeenCalledWith(ITEMS);
  });

  it('streams text with a spinner and a Cancel button', async () => {
    const user = userEvent.setup();
    const run = makeRun({ status: 'streaming', text: 'Partial ans' });
    render(<AiResponse run={run} title="Ask" />);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the AI response');
    expect(screen.getByText('Partial ans')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(run.cancel).toHaveBeenCalled();
  });

  it('renders final text safely with code blocks, usage and per-block actions', () => {
    const text = 'Use:\n```sql\nSELECT 1\n```\n<img src=x onerror=alert(1)>';
    render(
      <AiResponse
        run={makeRun({
          status: 'done',
          text,
          result: { text, usage: { inputTokens: 1200, outputTokens: 34 }, stopReason: 'end_turn' },
        })}
        title="Ask"
        renderCode={(code, lang) => <button type="button">{`open ${lang}: ${code}`}</button>}
      />,
    );
    const region = screen.getByRole('region', { name: 'AI response' });
    expect(within(region).getByText('SELECT 1').tagName).toBe('CODE');
    expect(within(region).getByText('<img src=x onerror=alert(1)>').tagName).toBe('P');
    expect(region.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'open sql: SELECT 1' })).toBeVisible();
    expect(screen.getByText('Input 1,200 tokens · output 34 tokens')).toBeVisible();
    expect(screen.queryByText('Answer cut off')).not.toBeInTheDocument();
  });

  it('warns about truncated and declined answers', () => {
    const usage = { inputTokens: 1, outputTokens: 1 };
    const { unmount } = render(
      <AiResponse
        run={makeRun({
          status: 'done',
          text: 'abc',
          result: { text: 'abc', usage, stopReason: 'max_tokens' },
        })}
        title="Ask"
      />,
    );
    expect(screen.getByText('Answer cut off')).toBeVisible();
    unmount();
    render(
      <AiResponse
        run={makeRun({
          status: 'done',
          text: '',
          result: { text: '', usage, stopReason: 'refusal' },
        })}
        title="Ask"
      />,
    );
    expect(screen.getByText('Request declined')).toBeVisible();
  });

  it('shows errors with Retry that re-opens the preview with the previous items', async () => {
    const user = userEvent.setup();
    const run = makeRun({ status: 'error', error: { code: 'AI_LIMIT_REACHED', message: 'limit' } });
    render(<AiResponse run={run} title="Ask" />);
    expect(screen.getByRole('alert')).toHaveTextContent('The AI token limit is reached');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(run.preview).toHaveBeenCalledWith(ITEMS);
  });

  it('shows the cancelled note with any partial text', () => {
    render(<AiResponse run={makeRun({ status: 'cancelled', text: 'Half' })} title="Ask" />);
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled');
    expect(screen.getByText('Half')).toBeVisible();
  });
});
