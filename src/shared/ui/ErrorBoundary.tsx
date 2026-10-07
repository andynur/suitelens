import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';
import { createLogger } from '../logger';
import { Button } from './Button';
import { SectionMessage } from './SectionMessage';

const log = createLogger('ui');

type Props = {
  /** Name of the view, for logs only. */
  scope: string;
  children: ReactNode;
  /** Shows an "Open Settings" action in the fallback. */
  onOpenSettings?: () => void;
};
type State = { error?: Error };

/**
 * Render-error boundary (PRD-06 F-6.1). A crash in one view shows a friendly fallback
 * instead of a blank panel. The message may contain page data, so detail is shown
 * collapsed in the view and never sent to the logger.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = {};

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    log.error('view crashed', { scope: this.props.scope });
  }

  private readonly reset = () => this.setState({ error: undefined });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { onOpenSettings } = this.props;
    return (
      <SectionMessage
        appearance="error"
        role="alert"
        title={t('error.crash.title')}
        className="m-3"
        actions={
          <>
            <Button onClick={this.reset}>{t('app.retry')}</Button>
            {onOpenSettings && (
              <Button variant="ghost" onClick={onOpenSettings}>
                {t('error.crash.settings')}
              </Button>
            )}
          </>
        }
      >
        <p>{t('error.crash.body')}</p>
        <details className="mt-2 text-fg-muted">
          <summary className="cursor-pointer">{t('error.detail')}</summary>
          <p className="mt-1 font-mono break-words">{error.message || error.name}</p>
        </details>
      </SectionMessage>
    );
  }
}
