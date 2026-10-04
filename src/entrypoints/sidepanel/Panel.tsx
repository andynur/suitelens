import * as Tabs from '@radix-ui/react-tabs';
import { AutomationMap } from '../../features/automation-map/AutomationMap';
import { FieldExplorer } from '../../features/field-explorer/FieldExplorer';
import { QuickGoto } from '../../features/quick-goto/QuickGoto';
import { SettingsPanel } from '../../features/settings/SettingsPanel';
import { isRecordPage } from '../../netsuite/context/detect';
import type { PageContext } from '../../netsuite/types';
import { useAccountSettings } from '../../shared/hooks/useAccountSettings';
import { t } from '../../shared/i18n';
import { resolveEnvironment } from '../../shared/storage/settings';
import { useAppStore, type PanelTab } from '../../shared/store';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { Toaster } from '../../shared/ui/Toaster';

/** Side panel layout: header (account · environment · record), tabs, toasts. */
export function Panel() {
  const { adapter, context, contextStatus, contextError, settings, activeTab, gotoOpen } =
    useAppStore();
  const { setActiveTab, setGotoOpen, refreshContext } = useAppStore.getState();
  const features = settings.features;

  const tabs: { id: PanelTab; label: string; enabled: boolean }[] = [
    { id: 'record', label: t('tabs.record'), enabled: features.fieldExplorer },
    { id: 'automation', label: t('tabs.automation'), enabled: features.automationMap },
    { id: 'settings', label: t('tabs.settings'), enabled: true },
  ];
  const visible = tabs.filter((tab) => tab.enabled);
  const current = visible.some((tab) => tab.id === activeTab) ? activeTab : 'settings';

  const recordContext =
    context && isRecordPage(context) && context.recordType
      ? (context as PageContext & { recordType: string })
      : null;

  const body = (tab: PanelTab) => {
    if (tab === 'settings') return <SettingsPanel context={context} />;
    if (!adapter || contextStatus === 'loading' || contextStatus === 'idle') {
      return <p className="py-6 text-center text-xs text-fg-muted">{t('app.loading')}</p>;
    }
    if (contextStatus === 'error' && contextError) {
      return <ErrorPanel error={contextError} onRetry={() => void refreshContext()} />;
    }
    if (!context) {
      return <EmptyState title={t('state.notNetSuite.title')} body={t('state.notNetSuite.body')} />;
    }
    if (!isRecordPage(context)) {
      return <EmptyState title={t('state.notRecord.title')} body={t('state.notRecord.body')} />;
    }
    if (!recordContext) {
      return <EmptyState title={t('state.notRecord.title')} body={t('state.unknownRecordType')} />;
    }
    return tab === 'record' ? (
      <FieldExplorer adapter={adapter} context={recordContext} />
    ) : (
      <AutomationMap adapter={adapter} context={recordContext} />
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg">
      <Header context={context} onGoto={() => setGotoOpen(!gotoOpen)} gotoOpen={gotoOpen} />
      {gotoOpen && features.quickGoto && (
        <div className="border-b border-line bg-surface">
          {context ? (
            <QuickGoto
              accountId={context.accountId}
              defaultRecordType={context.recordType}
              autoFocus
            />
          ) : (
            <p className="p-3 text-xs text-fg-muted">{t('goto.noAccount')}</p>
          )}
        </div>
      )}
      <Tabs.Root
        value={current}
        onValueChange={(v) => setActiveTab(v as PanelTab)}
        className="flex flex-1 flex-col"
      >
        <Tabs.List className="flex border-b border-line bg-surface px-2" aria-label={t('app.name')}>
          {visible.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className="border-b-2 border-transparent px-3 py-2 text-xs font-medium text-fg-muted data-[state=active]:border-accent data-[state=active]:text-fg"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {visible.map((tab) => (
          <Tabs.Content key={tab.id} value={tab.id} className="flex-1 focus-visible:outline-none">
            {current === tab.id && body(tab.id)}
          </Tabs.Content>
        ))}
      </Tabs.Root>
      <Toaster />
    </div>
  );
}

function Header({
  context,
  onGoto,
  gotoOpen,
}: {
  context: PageContext | null;
  onGoto: () => void;
  gotoOpen: boolean;
}) {
  const settings = useAppStore((s) => s.settings);
  const adapter = useAppStore((s) => s.adapter);
  const account = useAccountSettings(context?.accountId);
  const env = context ? resolveEnvironment(context.environment, settings, account) : undefined;

  return (
    <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold">{t('app.name')}</span>
          {adapter?.kind === 'fixture' && (
            <span className="rounded bg-warning/15 px-1 text-[10px] font-semibold text-warning">
              {t('app.fixtureMode')}
            </span>
          )}
        </div>
        {context ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-fg-muted">
            <span
              data-testid="env-pill"
              className="rounded px-1.5 py-px text-[10px] font-semibold uppercase text-white"
              style={{ background: env?.color }}
            >
              {t(`env.${env?.environment ?? context.environment}`)}
            </span>
            <span className="font-mono">{account.label || context.accountId}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">
              {context.recordType
                ? `${context.recordType}${context.recordId ? ` #${context.recordId}` : ''}`
                : t('header.noRecord')}
            </span>
          </div>
        ) : null}
      </div>
      {settings.features.quickGoto && (
        <Button
          variant={gotoOpen ? 'primary' : 'secondary'}
          onClick={onGoto}
          aria-expanded={gotoOpen}
          title={t('header.goto')}
        >
          {t('header.goto')}
        </Button>
      )}
    </header>
  );
}
