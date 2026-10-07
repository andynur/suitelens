import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ErrorPanel } from './ErrorPanel';

afterEach(cleanup);

it('keeps invalid-response diagnostics accessible even when no detail was attached', () => {
  render(
    <ErrorPanel
      error={{ code: 'INVALID_RESPONSE', message: 'Unexpected response from the page bridge.' }}
    />,
  );
  fireEvent.click(screen.getByText('Details'));
  expect(screen.getByRole('alert')).toHaveTextContent('Unexpected response from the page bridge.');
});
