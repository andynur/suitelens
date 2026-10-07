import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t, type MessageKey } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';

/** Coach-mark steps; each points at an element marked `data-tour="<target>"`. */
export const TOUR_STEPS: readonly { target: string; title: MessageKey; body: MessageKey }[] = [
  { target: 'groups', title: 'tour.groups.title', body: 'tour.groups.body' },
  { target: 'tabs', title: 'tour.tabs.title', body: 'tour.tabs.body' },
  { target: 'summary', title: 'tour.summary.title', body: 'tour.summary.body' },
  { target: 'commands', title: 'tour.commands.title', body: 'tour.commands.body' },
];

/**
 * One-time tour (Phase 3): 3–4 dismissible coach marks under the element they explain. Steps
 * whose target is not on screen are skipped. Escape or "Skip tour" ends it.
 */
export function Tour({ onDone }: { onDone: () => void }) {
  const steps = TOUR_STEPS.filter((step) => document.querySelector(`[data-tour="${step.target}"]`));
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const step = steps[index];

  useLayoutEffect(() => {
    if (!step) return;
    const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    const rect = target?.getBoundingClientRect();
    if (dialog.current) dialog.current.style.top = `${rect ? rect.bottom + 6 : 48}px`;
    target?.classList.add('tour-highlight');
    return () => target?.classList.remove('tour-highlight');
  }, [step]);

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('button[data-primary]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onDone]);

  useEffect(() => {
    if (!step) onDone();
  }, [step, onDone]);
  if (!step) return null;
  const last = index === steps.length - 1;
  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="false"
      aria-label={t('tour.label')}
      className="fixed right-3 left-3 z-40 rounded-lg bg-surface-overlay p-3 text-xs shadow-overlay"
    >
      <p className="text-fg-subtlest">{t('tour.step', { step: index + 1, total: steps.length })}</p>
      <p className="mt-0.5 text-sm font-semibold text-fg">{t(step.title)}</p>
      <p className="mt-1 text-fg-muted">{t(step.body)}</p>
      <div className="mt-2 flex justify-end gap-1">
        <Button variant="ghost" spacing="compact" onClick={onDone}>
          {t('tour.skip')}
        </Button>
        <Button
          variant="primary"
          spacing="compact"
          data-primary
          onClick={() => (last ? onDone() : setIndex(index + 1))}
        >
          {t(last ? 'tour.done' : 'tour.next')}
        </Button>
      </div>
    </div>
  );
}
