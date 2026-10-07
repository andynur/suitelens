import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { EDITOR_MAX_HEIGHT, EDITOR_MIN_HEIGHT, SqlEditor } from './SqlEditor';

const props = {
  initialSql: 'SELECT 1 FROM dual',
  onRun: () => {},
  onSelectionChange: () => {},
  onChange: () => {},
  onReady: () => {},
};

it('resizes the editor with the keyboard, within bounds, and resets to auto height', () => {
  const onHeightChange = vi.fn();
  const view = render(<SqlEditor {...props} height={200} onHeightChange={onHeightChange} />);
  const handle = screen.getByRole('separator', { name: 'Resize editor' });
  expect(handle).toHaveAttribute('aria-valuenow', '200');
  fireEvent.keyDown(handle, { key: 'ArrowDown' });
  expect(onHeightChange).toHaveBeenLastCalledWith(224);
  fireEvent.keyDown(handle, { key: 'Home' });
  expect(onHeightChange).toHaveBeenLastCalledWith(EDITOR_MIN_HEIGHT);
  fireEvent.keyDown(handle, { key: 'End' });
  expect(onHeightChange).toHaveBeenLastCalledWith(EDITOR_MAX_HEIGHT);
  fireEvent.keyDown(handle, { key: 'Enter' });
  expect(onHeightChange).toHaveBeenLastCalledWith(undefined);
  view.rerender(
    <SqlEditor {...props} height={EDITOR_MAX_HEIGHT} onHeightChange={onHeightChange} />,
  );
  fireEvent.keyDown(handle, { key: 'ArrowDown' });
  expect(onHeightChange).toHaveBeenLastCalledWith(EDITOR_MAX_HEIGHT);
});

it('has no resize handle without a height handler', () => {
  render(<SqlEditor {...props} />);
  expect(screen.queryByRole('separator')).toBeNull();
});
