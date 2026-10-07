import { buildRecordUrl, scriptRecordUrl } from '../../netsuite/urls';
import type { Settings } from '../../shared/storage/settings';
import type { PanelTab } from '../../shared/store';
import type { MessageKey } from '../../shared/i18n';

export const FEATURE_COMMANDS: readonly {
  tab: PanelTab;
  feature?: keyof Settings['features'];
  label: MessageKey;
}[] = [
  { tab: 'home', label: 'palette.home' },
  { tab: 'record', feature: 'fieldExplorer', label: 'palette.fieldExplorer' },
  { tab: 'automation', feature: 'automationMap', label: 'palette.automation' },
  { tab: 'inspector', feature: 'recordInspector', label: 'palette.inspector' },
  { tab: 'related', feature: 'recordInspector', label: 'palette.related' },
  { tab: 'console', feature: 'suiteqlConsole', label: 'palette.console' },
  { tab: 'logs', feature: 'logViewer', label: 'palette.logs' },
  { tab: 'impact', feature: 'impactAnalysis', label: 'palette.impact' },
  { tab: 'restlets', feature: 'restletTester', label: 'palette.restlets' },
  { tab: 'docs', feature: 'aiContextExport', label: 'palette.docs' },
  { tab: 'settings', label: 'palette.settings' },
];
export function parseNavigationCommand(
  accountId: string,
  input: string,
): { kind: 'record' | 'script'; url: string } | undefined {
  const tokens = input.trim().toLowerCase().split(/\s+/);
  if (tokens[0] === 'script' && tokens.length === 2) {
    const url = scriptRecordUrl(accountId, tokens[1]);
    return url ? { kind: 'script', url } : undefined;
  }
  if (tokens[0] !== 'record') return;
  if (tokens[1] === 'customrecord' && tokens.length === 4) {
    const url = buildRecordUrl(accountId, {
      kind: 'customrecord',
      customRecordTypeId: tokens[2]!,
      id: tokens[3]!,
    });
    return url ? { kind: 'record', url } : undefined;
  }
  if (tokens.length !== 3) return;
  const url = buildRecordUrl(
    accountId,
    tokens[1] === 'transaction'
      ? { kind: 'transaction', id: tokens[2]! }
      : { kind: 'mapped', recordType: tokens[1]!, id: tokens[2]! },
  );
  return url ? { kind: 'record', url } : undefined;
}
