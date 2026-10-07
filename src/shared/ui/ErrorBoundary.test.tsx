import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('boom');
  return <p>recovered</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React reports caught render errors to console.error; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders children when nothing throws', () => {
    shouldThrow = false;
    render(
      <ErrorBoundary scope="test">
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('shows a friendly fallback with collapsed detail and recovers on retry', async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary scope="test">
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This view stopped working');
    expect(screen.getByText('boom')).not.toBeVisible();
    expect(screen.queryByRole('button', { name: 'Open Settings' })).toBeNull();
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('offers Open Settings when a handler is given', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <ErrorBoundary scope="test" onOpenSettings={onOpenSettings}>
        <Bomb />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
  it('logs only the view scope, never exception text, names or component stacks', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const error = new Error('PRIVATE-RECORD-VALUE');
    error.name = 'PRIVATE-ERROR-NAME';
    const boundary = new ErrorBoundary({ scope: 'record', children: null });
    boundary.componentDidCatch(error, { componentStack: 'PRIVATE-COMPONENT-STACK' });
    expect(console.error).toHaveBeenCalledWith('[SuiteLens:ui] view crashed', { scope: 'record' });
    expect(debug).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('PRIVATE');
  });
});
