import { useEffect, useId, useState, type FormEvent } from 'react';
import { browser } from 'wxt/browser';
import { t } from '../../../shared/i18n';
import {
  deleteAiKey,
  getAiKeyInfo,
  lockAiKey,
  MIN_PASSPHRASE_LENGTH,
  saveAiKey,
  unlockAiKey,
  type AiKeyInfo,
  type AiKeyMode,
} from '../../../shared/storage/aiSecret';
import {
  AiSettingsSchema,
  type AiSettings as AiSettingsValue,
} from '../../../shared/storage/settings';
import { useAppStore } from '../../../shared/store';
import { Button } from '../../../shared/ui/Button';
import { fieldClass } from '../../../shared/ui/field';
import { SectionMessage } from '../../../shared/ui/SectionMessage';
import { Switch } from '../../../shared/ui/Switch';
import { AI_PROVIDER_CATALOG, AI_PROVIDERS, providerHost, type AiProviderId } from '../catalog';
import { AI_MODEL_ID_PATTERN } from '../types';
import { ProviderNotice } from '../ProviderNotice';
import { getAiUsageToday } from '../usage';
import { useAiKeyStatus } from '../useAiKeyStatus';

/** AI provider, model, key and limits (F-5.1–F-5.4, F-5.11). */
export function AiSettings() {
  const ai = useAppStore((s) => s.settings.ai);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const save = (patch: Partial<AiSettingsValue>) =>
    void saveSettings({ ai: AiSettingsSchema.parse({ ...ai, ...patch }) });
  const info = AI_PROVIDER_CATALOG[ai.provider];
  const providerId = useId();

  return (
    <div className="flex flex-col gap-3 text-xs text-fg">
      <p className="text-fg-muted">{t('ai.settings.intro')}</p>
      <div className="flex flex-col gap-1">
        <label htmlFor={providerId} className="font-semibold">
          {t('ai.settings.provider')}
        </label>
        <select
          id={providerId}
          value={ai.provider}
          onChange={(e) => {
            const provider = e.target.value as AiProviderId;
            // Model IDs differ per provider: start from the new provider's default.
            save({ provider, model: AI_PROVIDER_CATALOG[provider].defaultModel });
          }}
          aria-describedby={`${providerId}-host`}
          className={fieldClass}
        >
          {AI_PROVIDERS.map((id) => (
            <option key={id} value={id}>
              {AI_PROVIDER_CATALOG[id].label}
            </option>
          ))}
        </select>
        <span id={`${providerId}-host`} className="text-fg-subtlest">
          {t('ai.settings.provider.destination', { host: providerHost(ai.provider) })}
        </span>
      </div>
      <ProviderNotice provider={ai.provider} />
      <ModelField
        value={ai.model}
        suggestions={info.suggestedModels}
        example={info.defaultModel}
        onSave={(model) => save({ model })}
      />
      <NumberField
        label={t('ai.settings.maxPerRequest')}
        value={ai.maxTokensPerRequest}
        min={256}
        max={128_000}
        onSave={(maxTokensPerRequest) => save({ maxTokensPerRequest })}
      />
      <NumberField
        label={t('ai.settings.maxPerDay')}
        value={ai.maxTokensPerDay}
        min={0}
        max={100_000_000}
        onSave={(maxTokensPerDay) => save({ maxTokensPerDay })}
      />
      <UsageToday />
      <Switch
        label={t('ai.settings.redact')}
        description={t('ai.settings.redact.desc')}
        checked={ai.redact}
        onCheckedChange={(redact) => save({ redact })}
      />
      <KeyManager key={ai.provider} provider={ai.provider} />
    </div>
  );
}

function ModelField({
  value,
  suggestions,
  example,
  onSave,
}: {
  value: string;
  suggestions: readonly string[];
  example: string;
  onSave(model: string): void;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const [synced, setSynced] = useState(value);
  const id = useId();
  const listId = useId();
  // Follow external changes (e.g. another settings view) without an effect.
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  const commit = () => {
    const next = draft.trim();
    const valid = AI_MODEL_ID_PATTERN.test(next);
    setInvalid(!valid);
    if (valid && next !== value) onSave(next);
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {t('ai.settings.model')}
      </label>
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        spellCheck={false}
        list={listId}
        aria-invalid={invalid}
        className={`${fieldClass} font-mono`}
      />
      <datalist id={listId}>
        {suggestions.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
      <span className={invalid ? 'text-danger' : 'text-fg-subtlest'}>
        {invalid ? t('ai.settings.model.invalid') : t('ai.settings.model.hint', { example })}
      </span>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onSave,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onSave(value: number): void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(String(value));
  }
  const commit = () => {
    const next = Number(draft);
    if (!Number.isInteger(next) || next < min || next > max) return setDraft(String(value));
    if (next !== value) onSave(next);
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className={`${fieldClass} w-40`}
      />
    </label>
  );
}

function UsageToday() {
  const [tokens, setTokens] = useState<number>();
  useEffect(() => {
    let active = true;
    void getAiUsageToday()
      .then((usage) => {
        if (active) setTokens(usage.tokens);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  if (tokens === undefined) return null;
  return (
    <p className="text-fg-subtlest">
      {t('ai.settings.usageToday', { tokens: tokens.toLocaleString() })}
    </p>
  );
}

function KeyManager({ provider }: { provider: AiProviderId }) {
  const status = useAiKeyStatus(provider);
  const info = AI_PROVIDER_CATALOG[provider];
  const toast = useAppStore((s) => s.toast);
  const [keyInfo, setKeyInfo] = useState<AiKeyInfo>();
  const [replacing, setReplacing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let active = true;
    void getAiKeyInfo(provider).then((next) => {
      if (active) setKeyInfo(next);
    });
    return () => {
      active = false;
    };
  }, [provider, status]);

  const run = async (action: () => Promise<void>, done?: string) => {
    setError(undefined);
    try {
      await action();
      if (done) toast(done);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  if (!keyInfo) return null;
  const showForm = keyInfo.stored === 'none' || replacing;
  const summary =
    keyInfo.stored === 'none'
      ? t('ai.settings.key.none')
      : keyInfo.stored === 'session'
        ? t('ai.settings.key.session')
        : keyInfo.unlocked
          ? t('ai.settings.key.encrypted')
          : t('ai.settings.key.encryptedLocked');

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="text-xs font-semibold">
        {t('ai.settings.key.for', { provider: info.label })}
      </h3>
      <p className="text-fg-muted" data-testid="ai-key-status">
        {summary}
      </p>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {permissionDenied && (
        <SectionMessage appearance="warning">
          <p>{t('ai.settings.permissionDenied')}</p>
        </SectionMessage>
      )}
      {keyInfo.stored === 'none' && (
        <p className="text-fg-subtlest">{t('ai.settings.key.where', { page: info.keyPage })}</p>
      )}
      {keyInfo.stored === 'encrypted' && !keyInfo.unlocked && !replacing && (
        <UnlockForm
          onUnlock={(pass) => run(() => unlockAiKey(provider, pass), t('ai.settings.unlocked'))}
        />
      )}
      {showForm ? (
        <KeyForm
          onCancel={keyInfo.stored === 'none' ? undefined : () => setReplacing(false)}
          onSave={async (key, mode, passphrase) => {
            // Ask for host access inside the click (user gesture); the key is saved either way.
            const granted = await browser.permissions
              .request({ origins: [info.origin] })
              .catch(() => false);
            setPermissionDenied(!granted);
            const ok = await run(
              () =>
                saveAiKey(
                  provider,
                  key,
                  mode === 'encrypted' ? { mode, passphrase } : { mode: 'session' },
                ),
              t('ai.settings.saved'),
            );
            if (ok) setReplacing(false);
            return ok;
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {keyInfo.stored === 'encrypted' && keyInfo.unlocked && (
            <Button onClick={() => void run(() => lockAiKey(provider))}>
              {t('ai.settings.lock')}
            </Button>
          )}
          <Button onClick={() => setReplacing(true)}>{t('ai.settings.replace')}</Button>
          {!confirmDelete && (
            <Button onClick={() => setConfirmDelete(true)}>{t('ai.settings.delete')}</Button>
          )}
        </div>
      )}
      {confirmDelete && (
        <SectionMessage
          appearance="warning"
          role="alertdialog"
          title={t('ai.settings.delete')}
          actions={
            <>
              <Button
                variant="danger"
                onClick={() =>
                  void run(() => deleteAiKey(provider), t('ai.settings.deleted')).then(() =>
                    setConfirmDelete(false),
                  )
                }
              >
                {t('app.confirm')}
              </Button>
              <Button onClick={() => setConfirmDelete(false)}>{t('app.cancel')}</Button>
            </>
          }
        >
          <p>{t('ai.settings.delete.confirm')}</p>
        </SectionMessage>
      )}
    </div>
  );
}

function UnlockForm({ onUnlock }: { onUnlock(passphrase: string): Promise<boolean> }) {
  const [passphrase, setPassphrase] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onUnlock(passphrase).then((ok) => {
      if (ok) setPassphrase('');
    });
  };
  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label className="flex flex-1 flex-col gap-1">
        <span className="font-semibold">{t('ai.settings.passphrase')}</span>
        <input
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className={fieldClass}
        />
      </label>
      <Button type="submit" variant="primary" disabled={!passphrase}>
        {t('ai.settings.unlock')}
      </Button>
    </form>
  );
}

function KeyForm({
  onSave,
  onCancel,
}: {
  onSave(key: string, mode: AiKeyMode, passphrase: string): Promise<boolean>;
  onCancel?: () => void;
}) {
  const [key, setKey] = useState('');
  const [mode, setMode] = useState<AiKeyMode>('encrypted');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = mode === 'encrypted' && confirm.length > 0 && passphrase !== confirm;
  const ready =
    key.trim().length > 0 &&
    (mode === 'session' || (passphrase.length >= MIN_PASSPHRASE_LENGTH && passphrase === confirm));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    void onSave(key, mode, passphrase).then((ok) => {
      if (!ok) return;
      setKey('');
      setPassphrase('');
      setConfirm('');
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t('ai.settings.key.input')}</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className={`${fieldClass} font-mono`}
        />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">{t('ai.settings.key.mode')}</legend>
        {(['encrypted', 'session'] as const).map((value) => (
          <label key={value} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="ai-key-mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {t(`ai.settings.key.mode.${value}`)}
          </label>
        ))}
      </fieldset>
      {mode === 'encrypted' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t('ai.settings.passphrase')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t('ai.settings.passphraseConfirm')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
              className={fieldClass}
            />
          </label>
          <span className={mismatch ? 'text-danger' : 'text-fg-subtlest'}>
            {mismatch
              ? t('ai.settings.passphrase.mismatch')
              : t('ai.settings.passphrase.hint', { min: MIN_PASSPHRASE_LENGTH })}
          </span>
        </>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!ready}>
          {t('ai.settings.save')}
        </Button>
        {onCancel && <Button onClick={onCancel}>{t('app.cancel')}</Button>}
      </div>
    </form>
  );
}
