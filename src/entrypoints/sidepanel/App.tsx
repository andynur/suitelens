import { Panel } from './Panel';
import { useBootstrap, useTheme } from './useBootstrap';

export default function App() {
  useBootstrap();
  useTheme();
  return <Panel />;
}
