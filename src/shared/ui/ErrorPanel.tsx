import type { SuiteLensErrorShape } from '../../netsuite/errors';
import { t } from '../i18n';
import { Button } from './Button';

/** Friendly error explanation with likely causes; never crashes the panel. */
export function ErrorPanel({
  error,
  onRetry,
}: {
  error: SuiteLensErrorShape;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="m-3 rounded-md border border-danger/30 bg-danger/5 p-3 text-xs">
      <p className="font-semibold text-danger">{t('error.title')}</p>
      <p className="mt-1 text-fg">{t(`error.${error.code}`)}</p>
      {error.detail && (
        <details className="mt-2 text-fg-muted">
          <summary className="cursor-pointer">{t('error.detail')}</summary>
          <p className="mt-1 font-mono break-words">{error.detail}</p>
        </details>
      )}
      {onRetry && (
        <Button className="mt-2" onClick={onRetry}>
          {t('app.retry')}
        </Button>
      )}
    </div>
  );
}
