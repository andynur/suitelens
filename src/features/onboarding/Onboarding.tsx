import { useState } from 'react';
import { updateSettings } from '../../shared/storage/settings';
import { t } from '../../shared/i18n';
import { useAppStore } from '../../shared/store';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { WorkspaceRolePicker } from '../settings/WorkspaceRolePicker';

/** First-open tour. Dismissal is persisted only after an explicit action. */
export function Onboarding({
  replay = false,
  onClose,
}: {
  replay?: boolean;
  onClose?: () => void;
}) {
  const { settings, settingsLoaded, context, setSettings } = useAppStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!settingsLoaded || (!replay && settings.onboardingComplete)) return null;
  const close = async () => {
    setSaving(true);
    setFailed(false);
    try {
      setSettings(await updateSettings({ onboardingComplete: true }));
      onClose?.();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      title={t('onboarding.title')}
      description={t('onboarding.step', { step: step + 1 })}
      onClose={() => {
        if (!saving) void close();
      }}
      footer={
        <>
          <Button disabled={saving} onClick={() => void close()}>
            {t('onboarding.skip')}
          </Button>
          {step > 0 && (
            <Button disabled={saving} onClick={() => setStep(step - 1)}>
              {t('onboarding.back')}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={saving}
            onClick={() => (step === 2 ? void close() : setStep(step + 1))}
          >
            {t(step === 2 ? 'onboarding.done' : 'onboarding.next')}
          </Button>
        </>
      }
    >
      <h2 className="mb-2 text-sm font-semibold">
        {t((['onboarding.what', 'onboarding.privacy', 'onboarding.try'] as const)[step]!)}
      </h2>
      <p className="text-sm text-fg-muted">
        {t(
          (['onboarding.what.body', 'onboarding.privacy.body', 'onboarding.try.body'] as const)[
            step
          ]!,
        )}
      </p>
      {step === 0 && (
        <div className="mt-3 flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-fg-muted">{t('onboarding.role')}</h3>
          <WorkspaceRolePicker />
        </div>
      )}
      {step === 2 && (
        <p className="mt-3 text-xs">
          {t(context?.recordType ? 'onboarding.recordReady' : 'onboarding.openRecord')}
        </p>
      )}
      {failed && <SectionMessage appearance="error">{t('onboarding.failed')}</SectionMessage>}
    </Dialog>
  );
}
