import type { PageContext } from '../../netsuite/types';
import { t } from '../../shared/i18n';
import type { PanelTab } from '../../shared/store';
import { Button } from '../../shared/ui/Button';
import { ChevronRightIcon, SparkleIcon } from '../../shared/ui/icons';
import type { TabGroup, WorkspaceTab } from '../../shared/workspace';
import { QuickGoto } from '../quick-goto/QuickGoto';

export type HomeGroup = { id: TabGroup; tabs: { id: WorkspaceTab; label: string }[] };

/**
 * Home (ADR 0052): shown on first run and on pages without a record. Explains each group and
 * tab in one line, offers Go to record, and links to the tour. Order follows the workspace role.
 */
export function Home({
  context,
  groups,
  hasRecord,
  aiEnabled,
  gotoEnabled,
  onOpen,
  onAi,
  onTour,
}: {
  context: PageContext | null;
  groups: HomeGroup[];
  hasRecord: boolean;
  aiEnabled: boolean;
  gotoEnabled: boolean;
  onOpen: (tab: PanelTab) => void;
  onAi: () => void;
  onTour: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-3">
      <div>
        <h2 className="text-sm font-semibold text-fg">{t('home.title')}</h2>
        <p className="text-xs text-fg-muted">{t('home.intro')}</p>
      </div>
      {groups.map((group) => (
        <section
          key={group.id}
          aria-label={t(group.id === 'record' ? 'home.record' : 'home.tools')}
        >
          <h3 className="mb-1 text-xs font-semibold text-fg-muted uppercase">
            {t(group.id === 'record' ? 'home.record' : 'home.tools')}
          </h3>
          {group.id === 'record' && !hasRecord && (
            <p className="mb-1 text-xs text-fg-subtlest">{t('home.record.none')}</p>
          )}
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {group.tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  aria-label={t('home.open', { tab: tab.label })}
                  onClick={() => onOpen(tab.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{tab.label}</span>
                    <span className="block text-xs text-fg-subtlest">
                      {t(`tabs.desc.${tab.id}`)}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-3.5 w-3.5 text-fg-subtlest" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {aiEnabled && (
        <section aria-label={t('home.ai')}>
          <button
            type="button"
            onClick={onAi}
            className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left hover:bg-muted"
          >
            <SparkleIcon className="h-4 w-4 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-fg">{t('home.ai')}</span>
              <span className="block text-xs text-fg-subtlest">{t('home.ai.desc')}</span>
            </span>
          </button>
        </section>
      )}
      {gotoEnabled && context && (
        <section aria-label={t('home.goto')}>
          <h3 className="mb-1 text-xs font-semibold text-fg-muted uppercase">{t('home.goto')}</h3>
          <div className="rounded-lg border border-line bg-surface">
            <QuickGoto accountId={context.accountId} defaultRecordType={context.recordType} />
          </div>
        </section>
      )}
      <Button variant="ghost" className="self-start" onClick={onTour}>
        {t('home.tour')}
      </Button>
    </div>
  );
}
