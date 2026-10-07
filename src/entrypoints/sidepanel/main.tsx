import '../../netsuite/zodSetup';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import { createLogger } from '../../shared/logger';

const log = createLogger('ui');

const root = document.getElementById('root');
if (root) {
  createRoot(root, {
    // React otherwise logs raw caught exceptions, which may include record data.
    // The boundary owns the safe, scope-only diagnostic and collapsed local detail.
    onCaughtError: () => {},
    onUncaughtError: () => log.error('Root render failed'),
    onRecoverableError: () => log.warn('Render recovered from an error'),
  }).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
