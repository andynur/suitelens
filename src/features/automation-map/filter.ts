import type { AutomationItem, AutomationKind } from '../../netsuite/types';

export type AutomationFilters = {
  query: string;
  deployedOnly: boolean;
  /** One group (script type) only; null shows all. */
  kind: AutomationKind | null;
};

export const EMPTY_AUTOMATION_FILTERS: AutomationFilters = {
  query: '',
  deployedOnly: false,
  kind: null,
};

/** True when the item can run: deployed and not inactive. */
export function isRunning(item: AutomationItem): boolean {
  return item.isDeployed !== false && !item.isInactive;
}

/**
 * Status lozenges are shown only for exceptions. "Released" is the normal state, so
 * repeating it on every card hides the statuses that need attention.
 */
export function isExceptionalStatus(status: string | undefined): boolean {
  return !!status && status.trim().toUpperCase() !== 'RELEASED';
}

/** Matches name, script ID, deployment ID or file name (case-insensitive). */
export function filterAutomations(
  items: readonly AutomationItem[],
  filters: AutomationFilters,
): AutomationItem[] {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.kind && item.kind !== filters.kind) return false;
    if (filters.deployedOnly && !isRunning(item)) return false;
    if (!query) return true;
    return [item.name, item.scriptId, item.deploymentId, item.scriptFileName].some((value) =>
      value?.toLowerCase().includes(query),
    );
  });
}

/** Running items first; the original (approximate execution) order is kept otherwise. */
export function runningFirst(items: readonly AutomationItem[]): AutomationItem[] {
  return [...items.filter(isRunning), ...items.filter((i) => !isRunning(i))];
}
