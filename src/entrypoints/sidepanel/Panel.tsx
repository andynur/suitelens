import { DocumentationGenerator } from '../../features/documentation-generator/DocumentationGenerator';
import { Onboarding } from '../../features/onboarding/Onboarding';
import { recordFeatureEvent } from '../../features/telemetry/local';
import { AiWorkbench } from '../../features/ai/AiWorkbench';
import { ImpactAnalysis } from '../../features/impact-analysis/ImpactAnalysis';
import { LogViewer } from '../../features/log-viewer/LogViewer';
import * as Tabs from '@radix-ui/react-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, type HomeGroup } from '../../features/home/Home';
import { RelatedRecords } from '../../features/record-inspector/RelatedRecords';
import { Tour } from '../../features/tour/Tour';
import { loadAutomationsCached } from '../../features/automation-map/load';
import { getMetadataCache } from '../../shared/storage/cache';
import { getLastRecordTab, setLastRecordTab } from '../../shared/storage/lastTabs';
import { recordTypeLabel } from '../../shared/recordTypes';
import { Menu } from '../../shared/ui/Menu';
import { GroupNav } from './GroupNav';
import { CommandPalette } from '../../features/command-palette/CommandPalette';
import { RestletTester } from '../../features/restlet-tester/RestletTester';
import { RecordInspector } from '../../features/record-inspector/RecordInspector';
import { AutomationMap } from '../../features/automation-map/AutomationMap';
import { FieldExplorer } from '../../features/field-explorer/FieldExplorer';
import { SuiteQLConsole } from '../../features/suiteql-console/SuiteQLConsole';
import { QuickGoto } from '../../features/quick-goto/QuickGoto';
import { SettingsPanel } from '../../features/settings/SettingsPanel';
import { isRecordPage } from '../../netsuite/context/detect';
import type { PageContext } from '../../netsuite/types';
import { useAccountSettings } from '../../shared/hooks/useAccountSettings';
import { t } from '../../shared/i18n';
import { resolveEnvironment } from '../../shared/storage/settings';
import { useAppStore, useFeatures, type PanelTab } from '../../shared/store';
import { Badge, LOZENGE_CLASS } from '../../shared/ui/Badge';
import { IconButton } from '../../shared/ui/Button';
import { cn } from '../../shared/ui/cn';
import { readableTextOn } from '../../shared/ui/color';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import {
  CloseIcon,
  CommandIcon,
  CopyIcon,
  ExpandIcon,
  HashIcon,
  HelpIcon,
  LogoMark,
  SparkleIcon,
} from '../../shared/ui/icons';
import { copyWithToast } from '../../shared/ui/clipboard';
import { getTargetTab } from '../../shared/messaging';
import { browser } from 'wxt/browser';
import { Spinner } from '../../shared/ui/Spinner';
import { Toaster } from '../../shared/ui/Toaster';
import { isRecordTab, TAB_ORDER, tabGroup, type TabGroup } from '../../shared/workspace';
import { TabBar, type TabItem } from './TabBar';

const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);
const SHORTCUT_LABEL = IS_MAC ? '⌘K' : 'Ctrl+K';
const SHORTCUT_ARIA = IS_MAC ? 'Meta+K' : 'Control+K';
/** The panel page opened as a browser tab (Open in full tab) is pinned with `?targetTab=`. */
const IS_FULL_TAB =
  typeof location !== 'undefined' && new URL(location.href).searchParams.has('targetTab');

/** Side panel layout: header (account · environment · record), tabs, toasts. */
export function Panel() {
  const {
    adapter,
    context,
    contextStatus,
    contextError,
    activeTab,
    gotoOpen,
    aiOpen,
    settings,
    settingsLoaded,
  } = useAppStore();
  const { setActiveTab, setGotoOpen, setAiOpen, refreshContext } = useAppStore.getState();
  const [tourOpen, setTourOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const features = useFeatures();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [impactTarget, setImpactTarget] = useState<{
    adapter: typeof adapter;
    scope: string;
    target: string;
    files: string[];
  }>();
  const impactScope = JSON.stringify([adapter?.kind, context?.accountId, context?.url]);
  // Reset the handoff before rendering a different view or context.
  if (
    impactTarget &&
    (activeTab !== 'impact' ||
      !features.impactAnalysis ||
      impactTarget.scope !== impactScope ||
      impactTarget.adapter !== adapter)
  ) {
    setImpactTarget(undefined);
  }
  const impactHandoff =
    impactTarget?.scope === impactScope && impactTarget.adapter === adapter
      ? impactTarget
      : undefined;
  const initialImpactTarget = impactHandoff?.target;
  const initialImpactFiles = impactHandoff?.files;
  const openImpact = features.impactAnalysis
    ? (target: string, files: string[] = []) => {
        setImpactTarget({ adapter, scope: impactScope, target, files });
        setActiveTab('impact');
      }
    : undefined;

  // Cmd/Ctrl+K opens the palette; Quick Go-to remains the fallback when disabled.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        if (features.commandPalette) {
          event.preventDefault();
          setGotoOpen(false);
          setPaletteOpen((open) => !open);
        } else if (features.quickGoto) {
          event.preventDefault();
          setGotoOpen(!useAppStore.getState().gotoOpen);
        }
      } else if (event.key === 'Escape') {
        setPaletteOpen(false);
        setGotoOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [features.commandPalette, features.quickGoto, setGotoOpen]);

  const recordContext =
    context && isRecordPage(context) && context.recordType
      ? (context as PageContext & { recordType: string })
      : null;

  const tabs: { id: PanelTab; label: string; enabled: boolean }[] = [
    { id: 'home', label: t('tabs.home'), enabled: !settings.safeMode },
    { id: 'record', label: t('tabs.record'), enabled: features.fieldExplorer },
    { id: 'automation', label: t('tabs.automation'), enabled: features.automationMap },
    { id: 'inspector', label: t('tabs.inspector'), enabled: features.recordInspector },
    { id: 'related', label: t('tabs.related'), enabled: features.recordInspector },
    { id: 'console', label: t('tabs.console'), enabled: features.suiteqlConsole },
    { id: 'logs', label: t('tabs.logs'), enabled: features.logViewer },
    { id: 'impact', label: t('tabs.impact'), enabled: features.impactAnalysis },
    { id: 'restlets', label: t('tabs.restlets'), enabled: features.restletTester },
    {
      id: 'docs',
      label: t('tabs.docs'),
      enabled: features.documentationGenerator || features.aiContextExport,
    },
    { id: 'settings', label: t('tabs.settings'), enabled: true },
  ];
  const visible = tabs.filter((tab) => tab.enabled);
  const current = visible.some((tab) => tab.id === activeTab) ? activeTab : 'settings';
  const order = TAB_ORDER[settings.workspaceRole];
  const groupTabs = (group: TabGroup) =>
    (order[group] as readonly PanelTab[]).flatMap((id) => {
      const tab = visible.find((item) => item.id === id);
      return tab ? [tab] : [];
    });
  const groups = (['record', 'tools'] as const).filter((group) => groupTabs(group).length > 0);
  // Group shown in the tab row: the current tab's group, else the last one chosen.
  const [lastGroup, setLastGroup] = useState<TabGroup>();
  // Remember the group of every tab shown (also after shortcuts that switch tabs directly).
  const currentGroup = tabGroup(current);
  if (currentGroup && currentGroup !== lastGroup) setLastGroup(currentGroup);
  const group: TabGroup =
    tabGroup(current) ??
    lastGroup ??
    (recordContext || !groups.includes('tools') ? 'record' : 'tools');

  // Counts for the summary strip and tab badges, from data the panel already reads.
  const automationCounts = useAutomationCounts(features.automationMap ? recordContext : null);
  const recordSummary = useAppStore((s) =>
    s.recordSummary?.accountId === context?.accountId && s.recordSummary?.url === context?.url
      ? s.recordSummary
      : undefined,
  );
  const logErrors = useAppStore((s) =>
    s.logErrors && s.logErrors.accountId === context?.accountId ? s.logErrors.count : 0,
  );
  const badgeFor = (id: PanelTab) =>
    id === 'automation' && automationCounts
      ? String(automationCounts.scripts + automationCounts.workflows)
      : id === 'logs' && logErrors
        ? String(logErrors)
        : undefined;
  const navItems: TabItem[] = groupTabs(group).map((tab) => ({
    id: tab.id,
    label: tab.label,
    description: t(`tabs.desc.${tab.id as Exclude<PanelTab, 'settings'>}`),
    badge: badgeFor(tab.id),
  }));

  const selectTab = (tab: PanelTab) => {
    setActiveTab(tab);
    const nextGroup = tabGroup(tab);
    if (nextGroup) setLastGroup(nextGroup);
    if (tab === 'home') homeChosen.current = true;
    if (recordContext && isRecordTab(tab))
      void setLastRecordTab(recordContext.accountId, recordContext.recordType, tab).catch(() => {});
    // Capture consent at the user action, so a queued pre-opt-in tab open cannot
    // become a counter merely because storage finishes after a later opt-in.
    const consent = useAppStore.getState().settings;
    if (consent.telemetryEnabled && !consent.safeMode) void recordFeatureEvent(tab).catch(() => {});
  };
  const selectGroup = (next: TabGroup) => {
    setLastGroup(next);
    const first = groupTabs(next)[0];
    if (first && tabGroup(current) !== next) selectTab(first.id);
  };
  // The AI drawer opens below the group row, so its toggle stays visible (ADR 0053).
  const aiEntry = features.aiAssist && Boolean(adapter && context);
  const openAi = () => {
    setAiOpen(true);
    const consent = useAppStore.getState().settings;
    if (consent.telemetryEnabled && !consent.safeMode)
      void recordFeatureEvent('ai').catch(() => {});
  };

  // Context-aware landing (ADR 0052): pages without a record open Home; a record page opens
  // the last Record tab used for that record type (per account, local only).
  const homeChosen = useRef(false);
  const landingKey = JSON.stringify([context?.accountId, context?.url]);
  const homeEnabled = visible.some((tab) => tab.id === 'home');
  useEffect(() => {
    if (
      !context ||
      location.pathname.endsWith('/logs.html') ||
      location.pathname.endsWith('/console.html')
    )
      return;
    const state = useAppStore.getState();
    const tab = state.activeTab;
    if (!recordContext) {
      if (isRecordTab(tab) && homeEnabled) state.setActiveTab('home');
      homeChosen.current = false;
      return;
    }
    const followRecord = isRecordTab(tab) || (tab === 'home' && !homeChosen.current);
    homeChosen.current = false;
    if (!followRecord) return;
    let live = true;
    void getLastRecordTab(recordContext.accountId, recordContext.recordType)
      .catch(() => undefined)
      .then((last) => {
        if (!live) return;
        // The user may have moved to a tool meanwhile; only Record tabs and Home follow.
        const now = useAppStore.getState().activeTab;
        if (!isRecordTab(now) && now !== 'home') return;
        const next =
          last && visible.some((item) => item.id === last) ? last : groupTabs('record')[0]?.id;
        if (next) setActiveTab(next);
      });
    return () => {
      live = false;
    };
    // Only on a new page or account; tab choices in between belong to the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landingKey, recordContext?.recordType]);

  // The one-time tour starts after the welcome dialog was completed.
  const showTour =
    tourOpen ||
    (settingsLoaded && settings.onboardingComplete && !settings.tourComplete && !!context);
  const finishTour = useCallback(() => {
    setTourOpen(false);
    if (!useAppStore.getState().settings.tourComplete)
      void useAppStore.getState().saveSettings({ tourComplete: true });
  }, []);

  const body = (tab: PanelTab) => {
    if (tab === 'settings') return <SettingsPanel context={context} />;
    if (tab === 'home')
      return (
        <Home
          context={context}
          hasRecord={!!recordContext}
          groups={groups.map((id): HomeGroup => ({
            id,
            tabs: groupTabs(id).map((item) => ({
              id: item.id as HomeGroup['tabs'][number]['id'],
              label: item.label,
            })),
          }))}
          aiEnabled={features.aiAssist}
          gotoEnabled={features.quickGoto}
          onOpen={selectTab}
          onAi={openAi}
          onTour={() => setTourOpen(true)}
        />
      );
    if (!adapter || contextStatus === 'loading' || contextStatus === 'idle') {
      return <Spinner label={t('app.loading')} />;
    }
    if (contextStatus === 'error' && contextError) {
      return <ErrorPanel error={contextError} onRetry={() => void refreshContext()} />;
    }
    if (!context) {
      return <EmptyState title={t('state.notNetSuite.title')} body={t('state.notNetSuite.body')} />;
    }
    if (tab === 'impact')
      return (
        <ImpactAnalysis
          key={JSON.stringify([
            adapter.kind,
            context.accountId,
            context.url,
            initialImpactTarget,
            initialImpactFiles,
          ])}
          adapter={adapter}
          context={context}
          initialTarget={initialImpactTarget}
          initialFiles={initialImpactFiles}
        />
      );
    if (tab === 'docs')
      return (
        <DocumentationGenerator
          key={JSON.stringify([
            adapter.kind,
            context.accountId,
            context.url,
            context.recordType,
            context.recordId,
          ])}
          adapter={adapter}
          context={context}
        />
      );
    if (tab === 'console')
      return (
        <SuiteQLConsole
          key={`${adapter.kind}:${context.accountId}`}
          accountId={context.accountId}
          adapter={adapter}
        />
      );
    if (tab === 'logs')
      return (
        <LogViewer
          key={JSON.stringify([adapter.kind, context.accountId, context.url])}
          adapter={adapter}
          context={context}
        />
      );
    if (tab === 'restlets')
      return (
        <RestletTester
          key={JSON.stringify([adapter.kind, context.accountId, context.url])}
          adapter={adapter}
          context={context}
        />
      );
    // Empty states say what the tab shows and why it is empty here.
    const purpose = t(`tabs.desc.${tab as Exclude<PanelTab, 'settings'>}`);
    if (!isRecordPage(context)) {
      return (
        <EmptyState
          title={t('state.notRecord.title')}
          body={`${purpose}. ${t('empty.why', { reason: t('state.notRecord.body') })}`}
        />
      );
    }
    if (!recordContext) {
      return (
        <EmptyState
          title={t('state.notRecord.title')}
          body={`${purpose}. ${t('empty.why', { reason: t('state.unknownRecordType') })}`}
        />
      );
    }
    if (tab === 'related') return <RelatedRecords adapter={adapter} context={recordContext} />;
    if (tab === 'inspector')
      return (
        <RecordInspector
          key={JSON.stringify([
            adapter.kind,
            recordContext.accountId,
            recordContext.recordType,
            recordContext.recordId,
            recordContext.url,
          ])}
          adapter={adapter}
          context={recordContext}
        />
      );
    return tab === 'record' ? (
      <FieldExplorer
        onWhereUsed={openImpact}
        key={JSON.stringify([
          adapter.kind,
          recordContext.accountId,
          recordContext.recordType,
          recordContext.recordId,
          recordContext.pageKind,
          recordContext.url,
        ])}
        adapter={adapter}
        context={recordContext}
      />
    ) : (
      <AutomationMap adapter={adapter} context={recordContext} onWhereUsed={openImpact} />
    );
  };

  return (
    <div className="relative flex h-screen flex-col bg-canvas text-fg">
      <Header
        context={context}
        recordTitle={recordSummary?.title}
        onGoto={() => {
          setPaletteOpen(false);
          setGotoOpen(!gotoOpen);
        }}
        gotoOpen={gotoOpen}
        onPalette={() => {
          setGotoOpen(false);
          setPaletteOpen((open) => !open);
        }}
        paletteOpen={paletteOpen}
        onHome={homeEnabled ? () => selectTab('home') : undefined}
        onTour={() => setTourOpen(true)}
        onGuide={() => setGuideOpen(true)}
      />
      {paletteOpen && features.commandPalette && (
        <CommandPalette
          key={JSON.stringify([context?.accountId, context?.url])}
          context={context}
          onClose={() => setPaletteOpen(false)}
        />
      )}
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
        onValueChange={(v) => selectTab(v as PanelTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        {(groups.length > 0 || homeEnabled || aiEntry) && (
          <div data-tour="groups" className="shrink-0 bg-surface">
            <GroupNav
              group={group}
              home={current === 'home'}
              homeEnabled={homeEnabled}
              groups={groups}
              badges={logErrors && group !== 'tools' ? { tools: String(logErrors) } : {}}
              onHome={() => {
                setAiOpen(false);
                selectTab('home');
              }}
              onGroup={(next) => {
                setAiOpen(false);
                selectGroup(next);
              }}
              ai={
                aiEntry
                  ? { open: aiOpen, onToggle: () => (aiOpen ? setAiOpen(false) : openAi()) }
                  : undefined
              }
            />
          </div>
        )}
        {/* Everything below the group row; the AI drawer covers only this area. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div data-tour="tabs" className="shrink-0">
            <TabBar items={navItems} current={current} onSelect={selectTab} />
          </div>
          {recordContext && current !== 'settings' && current !== 'home' && (
            <RecordSummaryStrip
              fields={features.fieldExplorer ? recordSummary?.fieldCount : undefined}
              automation={automationCounts}
              errors={features.logViewer ? logErrors : 0}
              onOpen={selectTab}
            />
          )}
          {visible.map((tab) => (
            // The tab body is the only scroll container, so header, tabs and toolbars stay put.
            <Tabs.Content
              key={tab.id}
              value={tab.id}
              // Retain the current record snapshot and filters in panel memory across tab switches.
              // A new page/account remounts FieldExplorer; Refresh explicitly reloads its data.
              forceMount={tab.id === 'record' ? true : undefined}
              hidden={current !== tab.id}
              className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-none"
            >
              {(tab.id === 'record' || current === tab.id) && (
                // A new page/account remounts the boundary, so a crash never sticks across contexts.
                <ErrorBoundary
                  key={JSON.stringify([adapter?.kind, context?.accountId, context?.url])}
                  scope={tab.id}
                  onOpenSettings={
                    tab.id === 'settings' ? undefined : () => setActiveTab('settings')
                  }
                >
                  {body(tab.id)}
                </ErrorBoundary>
              )}
            </Tabs.Content>
          ))}
          {aiOpen && features.aiAssist && adapter && context && (
            <AiDrawer onClose={() => setAiOpen(false)}>
              <AiWorkbench
                key={JSON.stringify([adapter.kind, context.accountId, context.url])}
                adapter={adapter}
                context={context}
              />
            </AiDrawer>
          )}
        </div>
      </Tabs.Root>
      <Toaster />
      <Onboarding />
      {guideOpen && <Onboarding replay onClose={() => setGuideOpen(false)} />}
      {showTour && !paletteOpen && !guideOpen && <Tour onDone={finishTour} />}
    </div>
  );
}

function Header({
  context,
  recordTitle,
  onGoto,
  gotoOpen,
  onPalette,
  paletteOpen,
  onHome,
  onTour,
  onGuide,
}: {
  context: PageContext | null;
  recordTitle?: string;
  onGoto: () => void;
  gotoOpen: boolean;
  onPalette: () => void;
  paletteOpen: boolean;
  onHome?: () => void;
  onTour: () => void;
  onGuide: () => void;
}) {
  const settings = useAppStore((s) => s.settings);
  const features = useFeatures();
  const adapter = useAppStore((s) => s.adapter);
  const account = useAccountSettings(context?.accountId);
  const env = context ? resolveEnvironment(context.environment, settings, account) : undefined;

  // Human identity: "Invoice · INV-00123" with the internal ID as a copyable chip.
  const typeLabel = context?.recordType ? recordTypeLabel(context.recordType) : undefined;
  const recordLabel = typeLabel && recordTitle ? `${typeLabel} · ${recordTitle}` : typeLabel;

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-2">
      {/* Chrome's side panel title already shows the product; a full tab needs its own mark. */}
      {IS_FULL_TAB && <LogoMark />}
      {/* Environment and account, then the record: fixed lines that truncate, never re-wrap. */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1 text-xs text-fg-muted">
          {context ? (
            <>
              <span
                data-testid="env-pill"
                className={cn(LOZENGE_CLASS, 'shrink-0')}
                style={{ background: env?.color, color: env && readableTextOn(env.color) }}
              >
                {t(`env.${env?.environment ?? context.environment}`)}
              </span>
              <span className="min-w-0 truncate font-mono" title={context.accountId}>
                {account.label || context.accountId}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-fg">{t('app.name')}</span>
          )}
          {adapter?.kind === 'fixture' && <Badge tone="warning">{t('app.fixtureMode')}</Badge>}
        </div>
        {context &&
          (recordLabel && context.recordId ? (
            <div className="flex min-w-0 items-center gap-1">
              <span
                className="min-w-0 truncate text-sm font-medium text-fg"
                title={context.recordType}
              >
                {recordLabel}
              </span>
              <button
                type="button"
                title={t('header.copyId', { id: context.recordId })}
                aria-label={t('header.copyId', { id: context.recordId })}
                onClick={() => void copyWithToast(context.recordId!)}
                className="group inline-flex shrink-0 items-center gap-0.5 rounded-xs bg-muted px-1 font-mono text-xs text-fg-muted hover:bg-muted-hovered"
              >
                #{context.recordId}
                <CopyIcon className="h-3 w-3 text-fg-subtlest" />
              </button>
            </div>
          ) : (
            <span className="min-w-0 truncate text-sm text-fg-muted">
              {recordLabel ?? t('header.noRecord')}
            </span>
          ))}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {features.commandPalette && (
          <span data-tour="commands" className="inline-flex">
            <IconButton
              label={t('palette.title')}
              icon={<CommandIcon />}
              isSelected={paletteOpen}
              onClick={onPalette}
              aria-expanded={paletteOpen}
              aria-keyshortcuts={SHORTCUT_ARIA}
              title={t('palette.shortcut', { shortcut: SHORTCUT_LABEL })}
            />
          </span>
        )}
        {/* The command bar includes Go to record; the # button is the fallback without it. */}
        {features.quickGoto && !features.commandPalette && (
          <IconButton
            label={t('header.goto')}
            icon={<HashIcon />}
            isSelected={gotoOpen}
            onClick={onGoto}
            aria-expanded={gotoOpen}
            aria-keyshortcuts={features.commandPalette ? undefined : SHORTCUT_ARIA}
            title={
              features.commandPalette
                ? t('header.goto.title.plain')
                : t('header.goto.title', { shortcut: SHORTCUT_LABEL })
            }
          />
        )}
        <Menu
          label={t('header.help')}
          icon={<HelpIcon />}
          items={[
            ...(onHome ? [{ label: t('header.help.home'), onSelect: onHome }] : []),
            { label: t('header.help.tour'), onSelect: onTour },
            { label: t('header.help.guide'), onSelect: onGuide },
          ]}
        />
        {!IS_FULL_TAB && (
          <IconButton
            label={t('header.fullTab')}
            icon={<ExpandIcon />}
            onClick={() => void openFullTab()}
          />
        )}
      </div>
    </header>
  );
}

/** Opens this panel in a browser tab pinned to the current NetSuite tab (more room for tables). */
async function openFullTab() {
  const target = await getTargetTab().catch(() => undefined);
  await browser.tabs.create({
    url: browser.runtime.getURL('/sidepanel.html') + (target ? `?targetTab=${target.id}` : ''),
  });
}

/** Script and workflow counts for the record type, from the Automation Map cache (24 h). */
function useAutomationCounts(
  context: (PageContext & { recordType: string }) | null,
): { scripts: number; workflows: number } | undefined {
  const adapter = useAppStore((s) => s.adapter);
  const [counts, setCounts] = useState<{
    key: string;
    scripts: number;
    workflows: number;
  }>();
  const key = JSON.stringify([adapter?.kind, context?.accountId, context?.recordType]);
  useEffect(() => {
    if (!adapter || !context) return;
    let live = true;
    loadAutomationsCached(adapter, getMetadataCache(), context.accountId, context.recordType, false)
      .then((load) => {
        if (!live) return;
        const items = load.result.items;
        const scripts = new Set(
          items.filter((item) => item.kind !== 'workflow').map((item) => item.internalId),
        ).size;
        const workflows = items.filter((item) => item.kind === 'workflow').length;
        setCounts({ key, scripts, workflows });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return counts?.key === key ? counts : undefined;
}

/** "159 fields · 1 script · 1 workflow · 3 errors"; each count opens the matching tab. */
function RecordSummaryStrip({
  fields,
  automation,
  errors,
  onOpen,
}: {
  fields?: number;
  automation?: { scripts: number; workflows: number };
  errors: number;
  onOpen: (tab: PanelTab) => void;
}) {
  const items: { label: string; tab: PanelTab; tone?: 'danger' }[] = [
    ...(fields !== undefined
      ? [{ label: t('summary.fields', { count: fields }), tab: 'record' as const }]
      : []),
    ...(automation
      ? [
          {
            label: t('summary.scripts', { count: automation.scripts }),
            tab: 'automation' as const,
          },
          {
            label: t('summary.workflows', { count: automation.workflows }),
            tab: 'automation' as const,
          },
        ]
      : []),
    ...(errors
      ? [
          {
            label: t('summary.errors', { count: errors }),
            tab: 'logs' as const,
            tone: 'danger' as const,
          },
        ]
      : []),
  ];
  if (!items.length) return null;
  return (
    <nav
      aria-label={t('summary.label')}
      data-tour="summary"
      className="flex shrink-0 flex-wrap items-center gap-x-1 border-b border-line bg-surface px-3 py-1 text-xs"
    >
      {items.map((item, index) => (
        <span key={item.label} className="inline-flex items-center gap-1">
          {index > 0 && (
            <span aria-hidden className="text-fg-subtlest">
              ·
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpen(item.tab)}
            className={cn(
              'rounded-xs hover:underline',
              item.tone === 'danger' ? 'text-danger' : 'text-fg-muted hover:text-fg',
            )}
          >
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

/** AI Assist over the current tab (ADR 0052): the tab underneath keeps its state. */
function AiDrawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]'))
        onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      role="complementary"
      aria-label={t('header.ai')}
      className="absolute inset-0 z-20 flex flex-col border-t border-line bg-canvas shadow-overlay focus-visible:outline-none"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-1.5">
        <SparkleIcon className="h-4 w-4 text-discovery" />
        <h2 className="flex-1 text-sm font-semibold">{t('header.ai')}</h2>
        <IconButton label={t('ai.drawer.close')} icon={<CloseIcon />} onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
