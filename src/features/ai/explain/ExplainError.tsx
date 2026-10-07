import type { NetSuiteAdapter } from '../../../netsuite/adapter/NetSuiteAdapter';
import type { ExecutionLog } from '../../../netsuite/queries/logs';
import { t } from '../../../shared/i18n';
import { Button } from '../../../shared/ui/Button';
import { AiResponse } from '../guard/AiResponse';
import {
  buildExplainErrorRequest,
  explainErrorItems,
  MAX_EXPLAIN_LOGS,
} from '../prompts/explainError';
import { useAiRequest } from '../useAiRequest';
import { AiKeyNotice, useAiAvailability } from './AiKeyGate';

/**
 * Explain Error (F-5.9) for the log entries or groups selected in the Log Viewer. Selected
 * logs and their script IDs open in the preview; nothing is sent before the user confirms.
 */
export function ExplainError({
  adapter,
  groups,
  onClear,
}: {
  adapter: NetSuiteAdapter;
  /** Selected entries; a group of repeated errors is one element. */
  groups: ExecutionLog[][];
  onClear(): void;
}) {
  const availability = useAiAvailability(adapter);
  const run = useAiRequest(buildExplainErrorRequest);
  const count = Math.min(groups.length, MAX_EXPLAIN_LOGS);
  return (
    <div className="flex flex-col gap-2">
      <AiKeyNotice availability={availability} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          title={
            availability !== 'ready'
              ? t('ai.explain.error.disabled.setup')
              : !count
                ? t('ai.explain.error.disabled.select')
                : undefined
          }
          disabled={!count || availability !== 'ready' || run.state.status === 'streaming'}
          onClick={() => run.preview(explainErrorItems(groups))}
        >
          {t('ai.explain.error.explain')}
        </Button>
        {count > 0 && (
          <Button variant="ghost" onClick={onClear}>
            {t('ai.explain.error.clear')}
          </Button>
        )}
        <span className="text-xs text-fg-subtlest">
          {count
            ? t('ai.explain.error.selected', { count, max: MAX_EXPLAIN_LOGS })
            : t('ai.explain.error.selectHint', { max: MAX_EXPLAIN_LOGS })}
        </span>
      </div>
      <AiResponse run={run} title={t('ai.explain.error.previewTitle')} />
    </div>
  );
}
