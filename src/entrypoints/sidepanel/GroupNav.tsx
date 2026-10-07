import { t } from '../../shared/i18n';
import { cn } from '../../shared/ui/cn';
import { HomeIcon, SparkleIcon } from '../../shared/ui/icons';
import type { TabGroup } from '../../shared/workspace';

/**
 * First navigation level (ADR 0052): Home, then "Record" (about the record on the page) and
 * "Tools" (account-wide). The second level is the tab row below, which shows the chosen group.
 * AI Assistant sits at the end of the row (ADR 0053): it opens a drawer over the current tab,
 * so it is a toggle button, not a third group.
 */
export function GroupNav({
  group,
  home,
  homeEnabled,
  groups,
  badges,
  onHome,
  onGroup,
  ai,
}: {
  group: TabGroup;
  home: boolean;
  homeEnabled: boolean;
  groups: TabGroup[];
  /** Small counts or dots per group (for example errors in Logs); empty = none. */
  badges: Partial<Record<TabGroup, string>>;
  onHome: () => void;
  onGroup: (group: TabGroup) => void;
  /** AI Assistant toggle; undefined when the feature is off. */
  ai?: { open: boolean; onToggle: () => void };
}) {
  return (
    <nav aria-label={t('nav.sections')} className="flex items-center gap-1 px-2 pt-1.5">
      {homeEnabled && (
        <button
          type="button"
          aria-label={t('tabs.home')}
          title={t('tabs.home')}
          aria-current={home ? 'page' : undefined}
          onClick={onHome}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-sm text-fg-muted hover:bg-muted',
            home && 'bg-selected text-accent',
          )}
        >
          <HomeIcon className="h-3.5 w-3.5" />
        </button>
      )}
      {groups.length > 0 && (
        <div
          className="inline-flex rounded-sm bg-muted p-0.5"
          role="group"
          aria-label={t('nav.groups')}
        >
          {groups.map((id) => {
            const selected = !home && group === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                title={t(`nav.group.${id}.desc`)}
                onClick={() => onGroup(id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-xs px-2.5 py-0.5 text-xs font-semibold transition-colors',
                  selected ? 'bg-surface text-fg shadow-raised' : 'text-fg-muted hover:text-fg',
                )}
              >
                {t(`nav.group.${id}`)}
                {badges[id] && (
                  <span className="rounded-full bg-danger-bold px-1 text-[10px] leading-4 text-fg-inverse">
                    {badges[id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {ai && (
        <button
          type="button"
          aria-expanded={ai.open}
          title={t('header.ai.title')}
          onClick={ai.onToggle}
          className={cn(
            'ml-auto inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-2 text-xs font-semibold text-discovery transition-colors',
            ai.open ? 'bg-discovery-bg-hovered' : 'bg-discovery-bg hover:bg-discovery-bg-hovered',
          )}
        >
          <SparkleIcon className="h-3.5 w-3.5" />
          {t('header.ai')}
        </button>
      )}
    </nav>
  );
}
