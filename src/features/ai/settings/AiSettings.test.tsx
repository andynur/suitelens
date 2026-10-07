import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  aiSecretKey,
  aiSessionKey,
  getAiKeyInfo,
  saveAiKey,
} from '../../../shared/storage/aiSecret';
import { DEFAULT_SETTINGS } from '../../../shared/storage/settings';
import { useAppStore } from '../../../shared/store';
import { AiSettings } from './AiSettings';

const KEY = 'sk-ant-test-0123456789abcdef';
const requestPermission = vi.fn<(request: { origins: string[] }) => Promise<boolean>>();

beforeEach(() => {
  useAppStore.setState({ settings: DEFAULT_SETTINGS });
  // fakeBrowser has no permissions API; grant by default.
  requestPermission.mockReset().mockResolvedValue(true);
  Object.assign(fakeBrowser, { permissions: { request: requestPermission } });
});

describe('AiSettings', () => {
  it.each([
    [
      'commandcode',
      'deepseek/deepseek-v4-flash',
      'https://api.commandcode.ai/*',
      /Zero data retention is required/,
    ],
    [
      'gemini',
      'gemini-3.8-flash',
      'https://generativelanguage.googleapis.com/*',
      /Do not send confidential/,
    ],
  ] as const)(
    'saves a separate key and permission for %s',
    async (provider, model, origin, notice) => {
      await saveAiKey('anthropic', KEY, { mode: 'session' });
      const user = userEvent.setup();
      render(<AiSettings />);
      await user.selectOptions(screen.getByLabelText('Provider'), provider);
      expect(useAppStore.getState().settings.ai).toMatchObject({ provider, model });
      expect(screen.getByText(notice)).toBeVisible();
      await user.type(await screen.findByLabelText('New API key'), 'test-provider-key-0123456789');
      await user.click(screen.getByLabelText('This browser session only'));
      await user.click(screen.getByRole('button', { name: 'Save key' }));
      await waitFor(async () => expect((await getAiKeyInfo(provider)).unlocked).toBe(true));
      expect(requestPermission).toHaveBeenCalledWith({ origins: [origin] });
      expect((await getAiKeyInfo('anthropic')).unlocked).toBe(true);
    },
  );

  it('saves an encrypted key after asking for host access', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    expect(await screen.findByText('No key saved.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('New API key'), KEY);
    await user.type(screen.getByLabelText('Passphrase'), 'passphrase1');
    await user.type(screen.getByLabelText('Repeat passphrase'), 'passphrase2');
    expect(screen.getByText('The passphrases do not match.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save key' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Repeat passphrase'));
    await user.type(screen.getByLabelText('Repeat passphrase'), 'passphrase1');
    await user.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(async () =>
      expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'encrypted', unlocked: true }),
    );
    expect(requestPermission).toHaveBeenCalledWith({
      origins: ['https://api.anthropic.com/*'],
    });
    expect(
      await screen.findByText('Key saved, encrypted with your passphrase.'),
    ).toBeInTheDocument();
  });

  it('warns when host access is denied but still stores a session key', async () => {
    requestPermission.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.type(await screen.findByLabelText('New API key'), KEY);
    await user.click(screen.getByLabelText('This browser session only'));
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    expect(await screen.findByText(/did not grant access/)).toBeInTheDocument();
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'session', unlocked: true });
    expect(
      (await fakeBrowser.storage.local.get(aiSecretKey('anthropic')))[aiSecretKey('anthropic')],
    ).toBeUndefined();
  });

  it('deletes the key after confirmation', async () => {
    await saveAiKey('anthropic', KEY, { mode: 'encrypted', passphrase: 'passphrase1' });
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(await screen.findByRole('button', { name: 'Delete key' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(async () => expect((await getAiKeyInfo('anthropic')).stored).toBe('none'));
    const local = await fakeBrowser.storage.local.get(aiSecretKey('anthropic'));
    const session = await fakeBrowser.storage.session.get(aiSessionKey('anthropic'));
    expect(local[aiSecretKey('anthropic')]).toBeUndefined();
    expect(session[aiSessionKey('anthropic')]).toBeUndefined();
    expect(await screen.findByText('No key saved.')).toBeInTheDocument();
  });

  it('unlocks a locked key and reports a wrong passphrase', async () => {
    await saveAiKey('anthropic', KEY, { mode: 'encrypted', passphrase: 'passphrase1' });
    await fakeBrowser.storage.session.clear();
    const user = userEvent.setup();
    render(<AiSettings />);
    const field = await screen.findByLabelText('Passphrase');
    await user.type(field, 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong passphrase.');
    await user.clear(field);
    await user.type(field, 'passphrase1');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(async () => expect((await getAiKeyInfo('anthropic')).unlocked).toBe(true));
  });

  it('saves model and limits and rejects an invalid model ID', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    const model = screen.getByLabelText('Model ID');
    await user.clear(model);
    await user.type(model, 'bad model{Enter}');
    expect(screen.getByText(/Enter a valid model ID/)).toBeInTheDocument();
    await user.clear(model);
    await user.type(model, 'claude-sonnet-5-5{Enter}');
    expect(useAppStore.getState().settings.ai.model).toBe('claude-sonnet-5-5');

    const perDay = screen.getByLabelText('Max tokens per day (0 = no limit)');
    await user.clear(perDay);
    await user.type(perDay, '50000{Enter}');
    expect(useAppStore.getState().settings.ai.maxTokensPerDay).toBe(50000);

    await user.click(screen.getByRole('switch', { name: /Redact sensitive patterns/ }));
    expect(useAppStore.getState().settings.ai.redact).toBe(false);
  });

  it('switches provider with its own default model, key and host permission', async () => {
    await saveAiKey('anthropic', KEY, { mode: 'session' });
    const user = userEvent.setup();
    render(<AiSettings />);
    expect(await screen.findByText('Key kept for this browser session only.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Provider'), 'DeepSeek');
    expect(useAppStore.getState().settings.ai).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-chat',
    });
    expect(screen.getByText(/Requests go directly to api\.deepseek\.com/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'API key for DeepSeek' })).toBeInTheDocument();
    expect(await screen.findByText('No key saved.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('New API key'), 'sk-deepseek-0123456789');
    await user.click(screen.getByLabelText('This browser session only'));
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    await waitFor(async () =>
      expect(await getAiKeyInfo('deepseek')).toEqual({ stored: 'session', unlocked: true }),
    );
    expect(requestPermission).toHaveBeenCalledWith({ origins: ['https://api.deepseek.com/*'] });
    // The Anthropic key is untouched.
    expect(await getAiKeyInfo('anthropic')).toEqual({ stored: 'session', unlocked: true });
  });

  it('accepts vendor/model IDs for OpenRouter', async () => {
    useAppStore.setState({
      settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, provider: 'openrouter' } },
    });
    const user = userEvent.setup();
    render(<AiSettings />);
    const model = screen.getByLabelText('Model ID');
    await user.clear(model);
    await user.type(model, 'deepseek/deepseek-chat{Enter}');
    expect(useAppStore.getState().settings.ai.model).toBe('deepseek/deepseek-chat');
  });
});
