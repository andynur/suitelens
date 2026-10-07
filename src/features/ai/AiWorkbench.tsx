import { useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import type { PageContext } from '../../netsuite/types';
import { t } from '../../shared/i18n';
import { useAppStore, useFeatures } from '../../shared/store';
import { ChevronDownIcon } from '../../shared/ui/icons';
import { AI_PROVIDER_CATALOG } from './catalog';
import { useAiAvailability, type AiAvailability } from './explain/AiKeyGate';
import { ExplainScript } from './explain/ExplainScript';
import { AiSettings } from './settings/AiSettings';
import { AskSuiteQL } from './suiteql/AskSuiteQL';

/**
 * AI Assistant drawer (BYOK, PRD-05; ADR 0053). Setup (provider, key, limits) is a collapsible
 * section at the top: open while no key is ready, closed with a one-line status once it is.
 * The features below stay visible in a disabled state. Context Export lives in Docs.
 */
export function AiWorkbench({
  adapter,
  context,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
}) {
  const features = useFeatures();
  const availability = useAiAvailability(adapter);
  if (!features.aiAssist) return null;
  return (
    <div className="flex flex-col">
      {availability !== 'loading' && <AiSetup availability={availability} />}
      <div className="divide-y divide-line">
        <AskSuiteQL adapter={adapter} context={context} setupShown />
        <ExplainScript adapter={adapter} context={context} setupShown />
      </div>
    </div>
  );
}

function AiSetup({ availability }: { availability: Exclude<AiAvailability, 'loading'> }) {
  const ai = useAppStore((s) => s.settings.ai);
  // Open when a key is missing or locked, or when another view asked for setup (one-shot).
  const [open, setOpen] = useState(() => {
    const requested = useAppStore.getState().aiSetupRequested === true;
    if (requested) useAppStore.setState({ aiSetupRequested: false });
    return requested || availability !== 'ready';
  });
  const status =
    availability === 'ready'
      ? t('ai.setup.status.ready', {
          provider: AI_PROVIDER_CATALOG[ai.provider].label,
          model: ai.model,
        })
      : t(availability === 'locked' ? 'ai.setup.status.locked' : 'ai.setup.status.none');
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group border-b border-line"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-muted [&::-webkit-details-marker]:hidden">
        <h2 className="text-sm font-semibold text-fg">{t('ai.setup.title')}</h2>
        <span
          className={
            availability === 'ready'
              ? 'min-w-0 flex-1 truncate text-xs text-fg-subtlest'
              : 'min-w-0 flex-1 truncate text-xs font-semibold text-warning'
          }
        >
          {status}
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3">{open && <AiSettings />}</div>
    </details>
  );
}
