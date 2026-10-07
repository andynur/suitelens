import type { SuiteLensErrorShape } from '../../netsuite/errors';
import { t } from '../i18n';
import { Button } from './Button';
import { SectionMessage } from './SectionMessage';

/** Friendly error explanation with likely causes; never crashes the panel. */
export function ErrorPanel({
  error,
  onRetry,
}: {
  error: SuiteLensErrorShape;
  onRetry?: () => void;
}) {
  const detail = error.detail ?? (error.code === 'INVALID_RESPONSE' ? error.message : undefined);
  return (
    <SectionMessage
      appearance="error"
      role="alert"
      title={t('error.title')}
      className="m-3"
      actions={onRetry && <Button onClick={onRetry}>{t('app.retry')}</Button>}
    >
      <p>{t(`error.${error.code}`)}</p>
      {detail && (
        <details className="mt-2 text-fg-muted">
          <summary className="cursor-pointer">{t('error.detail')}</summary>
          <p className="mt-1 font-mono break-words">{detail}</p>
        </details>
      )}
    </SectionMessage>
  );
}
