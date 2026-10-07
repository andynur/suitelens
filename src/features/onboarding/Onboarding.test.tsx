import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, getSettings } from '../../shared/storage/settings';
import { useAppStore } from '../../shared/store';
import { Onboarding } from './Onboarding';
beforeEach(() =>
  useAppStore.setState({ settings: DEFAULT_SETTINGS, settingsLoaded: true, context: null }),
);
describe('first-open onboarding', () => {
  it('has three steps, persists completion and supports explicit replay', async () => {
    const user = userEvent.setup();
    const view = render(<Onboarding />);
    expect(screen.getByText('Step 1 of 3')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Choose what you share')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 3 of 3')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start exploring' }));
    expect((await getSettings()).onboardingComplete).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<Onboarding replay />);
    expect(screen.getByRole('dialog')).toBeVisible();
  });
  it('waits for settings and keeps the tour visible if saving fails', async () => {
    useAppStore.setState({ settingsLoaded: false });
    const view = render(<Onboarding />);
    expect(screen.queryByRole('dialog')).toBeNull();
    useAppStore.setState({ settingsLoaded: true });
    view.rerender(<Onboarding />);
    vi.spyOn(browser.storage.local, 'set').mockRejectedValueOnce(new Error('storage'));
    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(
      await screen.findByText('Could not save the tour preference. Please retry.'),
    ).toBeVisible();
    expect(useAppStore.getState().settings.onboardingComplete).toBe(false);
  });
});
