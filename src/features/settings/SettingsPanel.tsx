import { McpSettings } from '../mcp/McpSettings';
import { WorkspaceRolePicker } from './WorkspaceRolePicker';
import { Onboarding } from '../onboarding/Onboarding';
import { clearTelemetry, exportTelemetry } from '../telemetry/local';
import { getConsoleLibraryStorage } from '../../shared/storage/consoleLibrary';
import { useEffect, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import type { Environment, PageContext } from '../../netsuite/types';
import { EnvironmentSchema } from '../../netsuite/types';
import { effectiveAdapterMode, FIXTURES_AVAILABLE } from '../../shared/adapter';
import { FEATURES } from '../../shared/features';
import { t } from '../../shared/i18n';
import { clearAccountData } from '../../shared/storage/accountData';
import { getQueryWorkspaceStorage } from '../../shared/storage/queryWorkspace';
import { getMetadataCache } from '../../shared/storage/cache';
import {
  clearAllStorage,
  DEFAULT_ENV_COLORS,
  getAccountSettings,
  updateAccountSettings,
  type AccountSettings,
  type Theme,
} from '../../shared/storage/settings';
import { useAppStore, useFeatures } from '../../shared/store';
import { Button } from '../../shared/ui/Button';
import { fieldClass, fieldClassCompact } from '../../shared/ui/field';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { Switch } from '../../shared/ui/Switch';
import { ChevronDownIcon } from '../../shared/ui/icons';
import { About } from './About';

/** IANA zones the browser knows, with this browser's zone first. */
const TIME_ZONES = (() => {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const all = Intl.supportedValuesOf('timeZone');
  return [local, ...all.filter((zone) => zone !== local)];
})();

const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
const ENVIRONMENTS = EnvironmentSchema.options;

// Revoke independently of storage: a failed preference write must never leave a
// hidden native connection approved after the user disables it or enters Safe mode.
function revokeMcp() {
  void Promise.resolve()
    .then(() => browser.runtime.sendMessage({ type: 'suitelens:mcp', action: 'disconnect' }))
    .catch(() => {});
}

const OPEN_KEY = 'suitelens:settings:open';

/** Open/closed state per section, remembered in this browser only (a viewer convenience). */
function readOpenSections(): Record<string, boolean> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}');
    return value && typeof value === 'object' ? (value as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeOpenSection(id: string, open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify({ ...readOpenSections(), [id]: open }));
  } catch {
    // Storage blocked (private window): the section simply opens with its default next time.
  }
}

/**
 * A collapsible settings section (native details/summary, keyboard and screen-reader ready).
 * Everyday sections open by default; long or rarely used ones start closed with a summary.
 */
function Section({
  id,
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  /** Short status shown next to the title, also while closed (for example "14 of 15 on"). */
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpenSections()[id] ?? defaultOpen);
  return (
    <details
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (next === open) return;
        setOpen(next);
        writeOpenSection(id, next);
      }}
      className="group border-b border-line"
      aria-label={title}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 hover:bg-muted [&::-webkit-details-marker]:hidden">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <span className="min-w-0 flex-1 truncate text-xs text-fg-subtlest">{meta}</span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

export function SettingsPanel({ context }: { context: PageContext | null }) {
  const settings = useAppStore((s) => s.settings);
  const bootReady = useAppStore(
    (s) => s.settingsLoaded && (s.contextStatus === 'ready' || s.contextStatus === 'error'),
  );
  const features = useFeatures();
  const saveSettings = useAppStore((s) => s.saveSettings);
  const toast = useAppStore((s) => s.toast);
  const [replayTour, setReplayTour] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const colorsChanged = ENVIRONMENTS.some(
    (env) => settings.envColors[env].toLowerCase() !== DEFAULT_ENV_COLORS[env].toLowerCase(),
  );

  return (
    <div>
      <Section id="appearance" title={t('settings.appearance')} defaultOpen>
        <fieldset className="flex items-center gap-4 text-sm text-fg">
          <legend className="sr-only">{t('settings.theme')}</legend>
          {THEMES.map((theme) => (
            <label key={theme} className="flex cursor-pointer items-center gap-1.5">
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

      <Section
        id="workspace"
        title={t('workspace.title')}
        meta={t(`workspace.${settings.workspaceRole}`)}
        defaultOpen
      >
        <p className="mb-2 text-xs text-fg-muted">{t('workspace.desc')}</p>
        <WorkspaceRolePicker />
      </Section>

      <Section
        id="features"
        title={t('settings.features')}
        meta={
          settings.safeMode
            ? t('settings.safeMode')
            : t('settings.features.count', {
                on: FEATURES.filter((feature) => settings.features[feature.id]).length,
                total: FEATURES.length,
              })
        }
        defaultOpen={settings.safeMode}
      >
        <Switch
          label={t('settings.safeMode')}
          description={t('settings.safeMode.desc')}
          checked={settings.safeMode}
          onCheckedChange={(safeMode) => {
            if (safeMode) revokeMcp();
            void saveSettings({ safeMode });
          }}
        />
        {settings.safeMode && (
          <SectionMessage appearance="warning" className="my-2">
            <p>{t('settings.safeMode.on')}</p>
          </SectionMessage>
        )}
        {FEATURES.map((feature) => (
          <Switch
            key={feature.id}
            label={t(feature.labelKey)}
            description={t(feature.descriptionKey)}
            checked={settings.features[feature.id]}
            disabled={settings.safeMode}
            onCheckedChange={(checked) => {
              if (feature.id === 'mcpBridge' && !checked) revokeMcp();
              void saveSettings({ features: { ...settings.features, [feature.id]: checked } });
            }}
          />
        ))}
      </Section>

      {features.mcpBridge && (
        <Section id="mcp" title={t('mcp.title')}>
          <McpSettings />
        </Section>
      )}

      {features.aiAssist && (
        <Section id="ai" title={t('ai.settings.title')} defaultOpen>
          <p className="mb-2 text-xs text-fg-muted">{t('ai.setup.inAssistant')}</p>
          <Button disabled={!context} onClick={() => useAppStore.getState().openAiSetup()}>
            {t('ai.openSettings')}
          </Button>
        </Section>
      )}

      <Section id="envColors" title={t('settings.envColors')}>
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
                className="h-6 w-8 cursor-pointer rounded-sm border border-line-input bg-surface"
              />
              {t(`env.${env}`)}
            </label>
          ))}
        </div>
        {colorsChanged && (
          <div className="mt-2">
            <Button
              variant="ghost"
              onClick={() => void saveSettings({ envColors: DEFAULT_ENV_COLORS })}
            >
              {t('settings.envColors.reset')}
            </Button>
          </div>
        )}
      </Section>

      <Section
        id="thisAccount"
        title={t('settings.thisAccount')}
        meta={context?.accountId}
        defaultOpen
      >
        {context ? (
          <AccountSettingsForm key={context.accountId} context={context} />
        ) : (
          <p className="text-xs text-fg-muted">{t('settings.noAccount')}</p>
        )}
      </Section>

      <Section id="data" title={t('settings.data')}>
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
            // Danger styling is kept for the confirm step (ADS: destructive actions confirm).
            <Button onClick={() => setConfirmDelete(true)}>{t('settings.deleteAll')}</Button>
          ) : (
            <SectionMessage
              appearance="warning"
              role="alertdialog"
              title={t('settings.deleteAll')}
              className="w-full"
              actions={
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      void (async () => {
                        // Revoke in-flight MCP reads before clearing session UI/log storage.
                        await browser.runtime
                          .sendMessage({ type: 'suitelens:mcp', action: 'disconnect' })
                          .catch(() => {});
                        await browser.runtime
                          .sendMessage({ type: 'suitelens:mcp', action: 'clearLog' })
                          .catch(() => {});
                        return Promise.all([
                          clearAllStorage(),
                          getMetadataCache().clearAll(),
                          getQueryWorkspaceStorage().clearAll(),
                          getConsoleLibraryStorage().clearAll(),
                          browser.storage.session.clear(),
                        ]);
                      })().then(() => {
                        setConfirmDelete(false);
                        toast(t('settings.deleteAll.done'));
                      });
                    }}
                  >
                    {t('app.confirm')}
                  </Button>
                  <Button onClick={() => setConfirmDelete(false)}>{t('app.cancel')}</Button>
                </>
              }
            >
              <p>{t('settings.deleteAll.confirm')}</p>
            </SectionMessage>
          )}
        </div>
      </Section>

      {FIXTURES_AVAILABLE && (
        <Section id="developer" title={t('settings.developer')}>
          <label className="flex items-center gap-2 text-xs text-fg">
            {t('settings.adapterMode')}
            <select
              value={effectiveAdapterMode(settings)}
              onChange={(e) =>
                void saveSettings({ adapterMode: e.target.value as 'live' | 'fixture' })
              }
              className={fieldClassCompact}
            >
              <option value="live">{t('settings.adapterMode.live')}</option>
              <option value="fixture">{t('settings.adapterMode.fixture')}</option>
            </select>
          </label>
        </Section>
      )}

      <Section
        id="telemetry"
        title={t('telemetry.title')}
        meta={settings.telemetryEnabled ? t('telemetry.on') : t('telemetry.off')}
      >
        <Switch
          label={t('telemetry.enable')}
          description={t('telemetry.description')}
          checked={settings.telemetryEnabled}
          onCheckedChange={(telemetryEnabled) => {
            void saveSettings({ telemetryEnabled }).then(() => {
              if (!telemetryEnabled) return clearTelemetry();
            });
          }}
        />
        <div className="flex gap-2">
          <Button
            onClick={() =>
              void exportTelemetry()
                .then((data) => navigator.clipboard.writeText(data))
                .then(() => toast(t('telemetry.copied')))
            }
          >
            {t('telemetry.copy')}
          </Button>
          <Button onClick={() => void clearTelemetry().then(() => toast(t('telemetry.deleted')))}>
            {t('telemetry.delete')}
          </Button>
        </div>
      </Section>
      <Section id="onboarding" title={t('onboarding.title')}>
        <Button disabled={!bootReady} onClick={() => setReplayTour(true)}>
          {t('onboarding.replay')}
        </Button>
      </Section>
      {replayTour && <Onboarding replay onClose={() => setReplayTour(false)} />}
      <About />
    </div>
  );
}

function AccountSettingsForm({ context }: { context: PageContext }) {
  const settings = useAppStore((s) => s.settings);
  const [account, setAccount] = useState<AccountSettings>({});
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [label, setLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getAccountSettings(context.accountId).then((a) => {
      if (cancelled) return;
      setAccount(a);
      setAccountLoaded(true);
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
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={account.allowProductionWrites === true}
          disabled={!accountLoaded}
          onChange={(event) => {
            const allowProductionWrites = event.target.checked;
            setAccount((previous) => ({ ...previous, allowProductionWrites }));
            save({ allowProductionWrites });
          }}
        />
        {t('settings.allowProductionWrites')}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={account.allowProductionMcp === true}
          disabled={!accountLoaded}
          onChange={(event) => {
            const allowProductionMcp = event.target.checked;
            if (!allowProductionMcp) revokeMcp();
            setAccount((previous) => ({ ...previous, allowProductionMcp }));
            save({ allowProductionMcp });
          }}
        />
        {t('mcp.production')}
      </label>
      <p className="text-fg-muted">{t('mcp.productionWarning')}</p>
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
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-0.5">
        {t('settings.envOverride')}
        <select
          value={account.environmentOverride ?? ''}
          onChange={(e) =>
            save({ environmentOverride: (e.target.value || undefined) as Environment | undefined })
          }
          className={fieldClass}
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
      <label className="flex flex-col gap-0.5">
        {t('settings.logTimeZone')}
        <select
          value={account.logTimeZone ?? ''}
          disabled={!accountLoaded}
          onChange={(e) => save({ logTimeZone: e.target.value || undefined })}
          className={fieldClass}
        >
          <option value="">{t('settings.logTimeZone.unset')}</option>
          {TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <span className="text-fg-muted">{t('settings.logTimeZone.hint')}</span>
      </label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => save({ color: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded-sm border border-line-input bg-surface"
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
