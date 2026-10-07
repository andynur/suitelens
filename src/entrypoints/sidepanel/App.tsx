import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { Panel } from './Panel';
import { useBootstrap, useTheme } from './useBootstrap';

export default function App() {
  useBootstrap();
  useTheme();
  // Last resort: each tab has its own boundary; this one catches header and overlay crashes.
  return (
    <ErrorBoundary scope="panel">
      <Panel />
    </ErrorBoundary>
  );
}
