import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../shared/store';
import { DEFAULT_SETTINGS } from '../../../shared/storage/settings';
import { MAX_AI_PAYLOAD_CHARS, type PayloadItem } from '../types';
import { AiPreviewDialog } from './AiPreviewDialog';

const ITEMS: PayloadItem[] = [
  {
    id: 'q',
    kind: 'question',
    label: 'Question',
    content: 'Email jane@example.com about open orders',
    required: true,
  },
  { id: 's', kind: 'schema', label: 'Schema: transaction', content: 'id\ntrandate\nentity' },
];

function setRedactDefault(redact: boolean) {
  useAppStore.setState({
    settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, model: 'test-model', redact } },
  });
}

beforeEach(() => setRedactDefault(true));

it.each([
  ['commandcode', /Command Code forwards your request/],
  ['gemini', /Do not send confidential or personal data/],
] as const)('discloses %s data handling before Send', (provider, notice) => {
  useAppStore.setState({
    settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, provider } },
  });
  const confirm = vi.fn();
  render(<AiPreviewDialog title="Ask" items={ITEMS} onCancel={vi.fn()} onConfirm={confirm} />);
  expect(screen.getByText(notice)).toBeVisible();
  expect(confirm).not.toHaveBeenCalled();
});

it('shows provider, model and every item with its full content, kind and token estimate', () => {
  render(<AiPreviewDialog title="Ask" items={ITEMS} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  const dialog = screen.getByRole('dialog', { name: 'Ask' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAccessibleDescription(
    /Anthropic \(Claude\) \(test-model, api\.anthropic\.com\)/,
  );
  expect(screen.getByLabelText('Content of Question')).toHaveValue(ITEMS[0]!.content);
  expect(screen.getByLabelText('Content of Schema: transaction')).toHaveValue(
    'id\ntrandate\nentity',
  );
  expect(screen.getByText('Schema', { selector: 'span' })).toBeVisible();
  expect(screen.getByText('~5 tokens')).toBeVisible();
  expect(screen.getByText(/About \d+ input tokens in total/)).toBeVisible();
  expect(screen.getByText(/Record values .* are not included/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Remove Question' })).not.toBeInTheDocument();
});

it('moves focus into the dialog and cancels with Escape without confirming', async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(<AiPreviewDialog title="Ask" items={ITEMS} onCancel={onCancel} onConfirm={onConfirm} />);
  expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  await user.keyboard('{Escape}');
  expect(onCancel).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(2);
  expect(onConfirm).not.toHaveBeenCalled();
});

it('applies edits and removals and sends redacted content by default', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<AiPreviewDialog title="Ask" items={ITEMS} onCancel={vi.fn()} onConfirm={onConfirm} />);
  expect(screen.getByText('1 redaction applied')).toBeVisible();
  expect(screen.getByLabelText('Sent as (redacted)')).toHaveTextContent(
    'Email [email] about open orders',
  );
  const question = screen.getByLabelText('Content of Question');
  await user.clear(question);
  await user.type(question, 'Call 555-123-4567');
  await user.click(screen.getByRole('button', { name: 'Remove Schema: transaction' }));
  await user.click(screen.getByRole('button', { name: 'Send' }));
  expect(onConfirm).toHaveBeenCalledWith([{ ...ITEMS[0], content: 'Call [phone]' }]);
});

it('sends the original text when redaction is switched off', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<AiPreviewDialog title="Ask" items={ITEMS} onCancel={vi.fn()} onConfirm={onConfirm} />);
  await user.click(screen.getByRole('switch', { name: /Redact personal data/ }));
  expect(screen.queryByLabelText('Sent as (redacted)')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Send' }));
  expect(onConfirm).toHaveBeenCalledWith(ITEMS);
});

it('uses the redaction default from settings', () => {
  setRedactDefault(false);
  render(<AiPreviewDialog title="Ask" items={ITEMS} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.getByRole('switch', { name: /Redact personal data/ })).not.toBeChecked();
});

it('disables Send when nothing is left or the payload is too large', async () => {
  const user = userEvent.setup();
  const { unmount } = render(
    <AiPreviewDialog title="Ask" items={[ITEMS[1]!]} onCancel={vi.fn()} onConfirm={vi.fn()} />,
  );
  await user.click(screen.getByRole('button', { name: 'Remove Schema: transaction' }));
  expect(screen.getByText(/Nothing to send/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  unmount();

  const huge: PayloadItem = { ...ITEMS[1]!, content: 'x'.repeat(MAX_AI_PAYLOAD_CHARS + 1) };
  render(<AiPreviewDialog title="Ask" items={[huge]} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent(/too large/);
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
});

it('returns focus to the trigger when closed', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const { unmount } = render(
    <AiPreviewDialog title="Ask" items={ITEMS} onCancel={vi.fn()} onConfirm={vi.fn()} />,
  );
  expect(document.activeElement).not.toBe(trigger);
  unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
