import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToggleChip } from './ToggleChip';

describe('ToggleChip', () => {
  it('exposes the pressed state and toggles it', async () => {
    const onChange = vi.fn();
    render(
      <ToggleChip pressed={false} onPressedChange={onChange}>
        Custom
      </ToggleChip>,
    );
    const chip = screen.getByRole('button', { name: 'Custom' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.setup().click(chip);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('leaves aria-pressed off when used as a switch', () => {
    render(
      <ToggleChip role="switch" aria-checked pressed onPressedChange={() => {}}>
        IDs
      </ToggleChip>,
    );
    expect(screen.getByRole('switch', { name: 'IDs' })).not.toHaveAttribute('aria-pressed');
  });
});
