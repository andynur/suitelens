import { useEffect, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import type { Environment, PageContext } from '../../netsuite/types';
import { EnvironmentSchema } from '../../netsuite/types';
import { effectiveAdapterMode, FIXTURES_AVAILABLE } from '../../shared/adapter';
import { FEATURES } from '../../shared/features';
import { t } from '../../shared/i18n';
import { clearAccountData } from '../../shared/storage/accountData';
import { getMetadataCache } from '../../shared/storage/cache';
import {
  clearAllStorage,
  getAccountSettings,
  updateAccountSettings,
  type AccountSettings,
  type Theme,
} from '../../shared/storage/settings';
import { useAppStore } from '../../shared/store';
import { Button } from '../../shared/ui/Button';
import { Switch } from '../../shared/ui/Switch';
import { About } from './About';

const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
const ENVIRONMENTS = EnvironmentSchema.options;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-3 py-3" aria-label={title}>
      <h2 className="mb-2 text-xs font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsPanel({ context }: { context: PageContext | null }) {
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const toast = useAppStore((s) => s.toast);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div>
      <Section title={t('settings.appearance')}>
        <fieldset className="flex items-center gap-3 text-xs text-fg">
          <legend className="sr-only">{t('settings.theme')}</legend>
          {THEMES.map((theme) => (
            <label key={theme} className="flex items-center gap-1">
              <input
                type="radio"
                name="theme"
                value={theme}
                checked={settings.theme === theme}
                onChange={() => void saveSettings({ theme })}
              />
              {t(`settings.theme.${theme}`)}
            </label>
          ))}
        </fieldset>
      </Section>

      <Section title={t('settings.features')}>
        {FEATURES.map((feature) => (
          <Switch
            key={feature.id}
            label={t(feature.labelKey)}
            description={t(feature.descriptionKey)}
            checked={settings.features[feature.id]}
            onCheckedChange={(checked) =>
              void saveSettings({ features: { ...settings.features, [feature.id]: checked } })
            }
          />
        ))}
      </Section>

      <Section title={t('settings.envColors')}>
        <div className="grid grid-cols-2 gap-2">
          {ENVIRONMENTS.map((env) => (
            <label key={env} className="flex items-center gap-2 text-xs text-fg">
              <input
                type="color"
                value={settings.envColors[env]}
                onChange={(e) =>
                  void saveSettings({
                    envColors: { ...settings.envColors, [env]: e.target.value },
                  })
                }
                className="h-6 w-8 cursor-pointer rounded border border-line bg-surface"
              />
              {t(`env.${env}`)}
            </label>
          ))}
        </div>
      </Section>

      <Section title={t('settings.thisAccount')}>
        {context ? (
          <AccountSettingsForm key={context.accountId} context={context} />
        ) : (
          <p className="text-xs text-fg-muted">{t('settings.noAccount')}</p>
        )}
      </Section>

      <Section title={t('settings.data')}>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!context}
            onClick={() => {
              if (!context) return;
              void clearAccountData(context.accountId).then(() =>
                toast(t('settings.clearAccountCache.done', { accountId: context.accountId })),
              );
            }}
          >
            {t('settings.clearAccountCache')}
          </Button>
          {!confirmDelete ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              {t('settings.deleteAll')}
            </Button>
          ) : (
            <div
              role="alertdialog"
              aria-label={t('settings.deleteAll')}
              className="w-full rounded-md border border-danger/40 p-2 text-xs"
            >
              <p className="mb-2 text-fg">{t('settings.deleteAll.confirm')}</p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    void Promise.all([
                      clearAllStorage(),
                      getMetadataCache().clearAll(),
                      browser.storage.session.clear(),
                    ]).then(() => {
                      setConfirmDelete(false);
                      toast(t('settings.deleteAll.done'));
                    });
                  }}
                >
                  {t('app.confirm')}
                </Button>
                <Button onClick={() => setConfirmDelete(false)}>{t('app.cancel')}</Button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {FIXTURES_AVAILABLE && (
        <Section title={t('settings.developer')}>
          <label className="flex items-center gap-2 text-xs text-fg">
            {t('settings.adapterMode')}
            <select
              value={effectiveAdapterMode(settings)}
              onChange={(e) =>
                void saveSettings({ adapterMode: e.target.value as 'live' | 'fixture' })
              }
              className="rounded border border-line bg-surface px-1 py-0.5 text-xs"
            >
              <option value="live">{t('settings.adapterMode.live')}</option>
              <option value="fixture">{t('settings.adapterMode.fixture')}</option>
            </select>
          </label>
        </Section>
      )}

      <About />
    </div>
  );
}

function AccountSettingsForm({ context }: { context: PageContext }) {
  const settings = useAppStore((s) => s.settings);
  const [account, setAccount] = useState<AccountSettings>({});
  const [label, setLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getAccountSettings(context.accountId).then((a) => {
      if (cancelled) return;
      setAccount(a);
      setLabel(a.label ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [context.accountId]);

  const save = (patch: Partial<AccountSettings>) =>
    void updateAccountSettings(context.accountId, patch).then(setAccount);

  const environment = account.environmentOverride ?? context.environment;
  const color = account.color ?? settings.envColors[environment];

  return (
    <div className="flex flex-col gap-2 text-xs text-fg">
      <p className="font-mono text-fg-muted">{context.accountId}</p>
      <label className="flex flex-col gap-0.5">
        {t('settings.accountLabel')}
        <input
          value={label}
          maxLength={60}
          placeholder={t('settings.accountLabel.placeholder')}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => save({ label: label.trim() || undefined })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save({ label: label.trim() || undefined });
          }}
          className="rounded-md border border-line bg-surface px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-0.5">
        {t('settings.envOverride')}
        <select
          value={account.environmentOverride ?? ''}
          onChange={(e) =>
            save({ environmentOverride: (e.target.value || undefined) as Environment | undefined })
          }
          className="rounded-md border border-line bg-surface px-2 py-1"
        >
          <option value="">
            {t('settings.envOverride.auto', { environment: t(`env.${context.environment}`) })}
          </option>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>
              {t(`env.${env}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => save({ color: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border border-line bg-surface"
          />
          {t('settings.colorOverride')}
        </label>
        {account.color && (
          <Button variant="ghost" onClick={() => save({ color: undefined })}>
            {t('settings.colorOverride.reset')}
          </Button>
        )}
      </div>
    </div>
  );
}
