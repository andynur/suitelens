import type { NetSuiteAdapter } from '../../../netsuite/adapter/NetSuiteAdapter';
import { t } from '../../../shared/i18n';
import { useAppStore } from '../../../shared/store';
import { Button } from '../../../shared/ui/Button';
import { SectionMessage } from '../../../shared/ui/SectionMessage';
import { useAiKeyStatus } from '../useAiKeyStatus';

export type AiAvailability = 'loading' | 'none' | 'locked' | 'ready';

/** Key status for an explain feature. Fixture mode streams canned answers without a key. */
export function useAiAvailability(adapter: NetSuiteAdapter): AiAvailability {
  const status = useAiKeyStatus();
  return adapter.kind === 'fixture' ? 'ready' : status;
}

/** Explains why AI Assist cannot run yet and links to AI setup ('none' / 'locked' only). */
export function AiKeyNotice({ availability }: { availability: AiAvailability }) {
  if (availability !== 'none' && availability !== 'locked') return null;
  return (
    <SectionMessage
      title={availability === 'none' ? t('ai.notConfigured.title') : undefined}
      actions={
        <Button onClick={() => useAppStore.getState().openAiSetup()}>{t('ai.openSettings')}</Button>
      }
    >
      {availability === 'locked' ? t('ai.locked.body') : t('ai.notConfigured.body')}
    </SectionMessage>
  );
}
