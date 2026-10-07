import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../../shared/i18n';
import type { PanelTab } from '../../shared/store';
import { cn } from '../../shared/ui/cn';
import { ChevronDownIcon, SettingsIcon } from '../../shared/ui/icons';

export type TabItem = { id: PanelTab; label: string; description: string; badge?: string };

const TAB =
  'shrink-0 whitespace-nowrap border-b-2 border-transparent px-2 py-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg';
const TRIGGER = `${TAB} data-[state=active]:border-accent data-[state=active]:text-accent`;

type Layout = { available: number; widths: number[]; more: number };

/**
 * Which tabs fit in the row (priority+ pattern). Tabs keep their order; the selected tab is
 * always shown, the rest that do not fit go to the More menu. Without layout (unit tests) all fit.
 */
export function fitTabs(items: TabItem[], current: PanelTab, layout: Layout | null) {
  if (!layout || !layout.available) return { shown: items, overflow: [] as TabItem[] };
  const total = layout.widths.reduce((sum, width) => sum + width, 0);
  if (total <= layout.available) return { shown: items, overflow: [] as TabItem[] };
  const activeIndex = items.findIndex((item) => item.id === current);
  let budget =
    layout.available - layout.more - (activeIndex >= 0 ? layout.widths[activeIndex]! : 0);
  const keep = new Set<number>(activeIndex >= 0 ? [activeIndex] : []);
  for (const [index, width] of layout.widths.entries()) {
    if (index === activeIndex) continue;
    if (width > budget) break;
    budget -= width;
    keep.add(index);
  }
  return {
    shown: items.filter((_, index) => keep.has(index)),
    overflow: items.filter((_, index) => !keep.has(index)),
  };
}

/** Panel navigation: feature tabs that fit, a More menu for the rest, and a pinned Settings tab. */
export function TabBar({
  items,
  current,
  onSelect,
}: {
  items: TabItem[];
  current: PanelTab;
  onSelect: (tab: PanelTab) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const signature = items.map((item) => item.label).join('|');

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const update = () => {
      const widths = Array.from(measure.children, (el) => (el as HTMLElement).offsetWidth);
      const more = widths.pop() ?? 0;
      setLayout({ available: row.clientWidth, widths, more });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(row);
    return () => observer?.disconnect();
  }, [signature]);

  const { shown, overflow } = fitTabs(items, current, layout);

  return (
    <div className="relative shrink-0 border-b border-line bg-surface">
      <Tabs.List className="flex items-stretch px-2" aria-label={t('app.name')}>
        <div ref={rowRef} className="flex min-w-0 flex-1 overflow-hidden">
          {shown.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              title={tab.description}
              aria-label={tab.label}
              className={cn(TRIGGER, 'inline-flex items-center gap-1')}
            >
              {tab.label}
              {tab.badge && <TabBadge value={tab.badge} />}
            </Tabs.Trigger>
          ))}
          {overflow.length > 0 && <MoreMenu items={overflow} onSelect={onSelect} />}
        </div>
        <Tabs.Trigger
          value="settings"
          aria-label={t('tabs.settings')}
          title={t('tabs.settings')}
          className={cn(TRIGGER, 'inline-flex items-center')}
        >
          <SettingsIcon />
        </Tabs.Trigger>
      </Tabs.List>
      {/* Off-screen copies measure each label at the real font size. */}
      <div ref={measureRef} aria-hidden className="invisible absolute flex h-0 w-0 overflow-hidden">
        {items.map((tab) => (
          <span key={tab.id} className={cn(TAB, 'inline-flex items-center gap-1')}>
            {tab.label}
            {tab.badge && <TabBadge value={tab.badge} />}
          </span>
        ))}
        <span className={cn(TAB, 'inline-flex items-center gap-0.5')}>
          {t('tabs.more.short')}
          <ChevronDownIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

function MoreMenu({ items, onSelect }: { items: TabItem[]; onSelect: (tab: PanelTab) => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => entries[(next + entries.length) % entries.length]?.focus();
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(entries.length - 1);
    else if (event.key === 'Escape') close();
    else if (event.key === 'Tab') setOpen(false);
    else return;
    if (event.key !== 'Tab') event.preventDefault();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('tabs.more')}
        onClick={() => setOpen(!open)}
        className={cn(TAB, 'inline-flex items-center gap-0.5', open && 'text-fg')}
      >
        {t('tabs.more.short')}
        <ChevronDownIcon
          className={cn(
            'h-3.5 w-3.5 transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('tabs.more')}
          onKeyDown={onKeyDown}
          className="absolute left-2 right-2 top-full z-30 mt-1 ml-auto max-w-72 rounded-lg bg-surface-overlay py-1 shadow-overlay"
        >
          {items.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(tab.id);
              }}
              className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-muted focus-visible:bg-muted"
            >
              <span className="text-sm text-fg">
                {tab.label}
                {tab.badge && <TabBadge value={tab.badge} />}
              </span>
              <span className="text-xs text-fg-subtlest">{tab.description}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Small count on a tab (for example automations on this record type); decorative. */
function TabBadge({ value }: { value: string }) {
  return (
    <span
      aria-hidden
      className="ml-1 rounded-full bg-muted px-1.5 text-[11px] leading-4 text-fg-muted"
    >
      {value}
    </span>
  );
}
