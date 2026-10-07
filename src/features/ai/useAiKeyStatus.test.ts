import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { lockAiKey, saveAiKey, unlockAiKey } from '../../shared/storage/aiSecret';
import { DEFAULT_SETTINGS } from '../../shared/storage/settings';
import { useAppStore } from '../../shared/store';
import { useAiKeyStatus } from './useAiKeyStatus';

describe('useAiKeyStatus', () => {
  it('follows key changes', async () => {
    useAppStore.setState({ settings: DEFAULT_SETTINGS });
    const { result } = renderHook(() => useAiKeyStatus());
    expect(result.current).toBe('loading');
    await waitFor(() => expect(result.current).toBe('none'));

    await act(() =>
      saveAiKey('anthropic', 'sk-ant-test-0123456789', {
        mode: 'encrypted',
        passphrase: 'passphrase1',
      }),
    );
    await waitFor(() => expect(result.current).toBe('ready'));

    await act(() => lockAiKey('anthropic'));
    await waitFor(() => expect(result.current).toBe('locked'));

    await act(() => unlockAiKey('anthropic', 'passphrase1'));
    await waitFor(() => expect(result.current).toBe('ready'));
  });

  it('follows the selected provider', async () => {
    useAppStore.setState({ settings: DEFAULT_SETTINGS });
    await saveAiKey('groq', 'gsk-test-0123456789', { mode: 'session' });
    const { result } = renderHook(() => useAiKeyStatus());
    await waitFor(() => expect(result.current).toBe('none'));
    act(() =>
      useAppStore.setState({
        settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, provider: 'groq' } },
      }),
    );
    await waitFor(() => expect(result.current).toBe('ready'));
  });
});
