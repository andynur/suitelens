import type { MessageKey } from './i18n';

/**
 * Feature flags. Every feature can be switched off in Settings (US-1.8).
 * Safety features (Environment Guard) are never gated behind a paid tier (PRD-00 §7).
 */
export const FEATURE_IDS = [
  'documentationGenerator',
  'mcpBridge',
  'impactAnalysis',
  'fieldExplorer',
  'recordInspector',
  'restletTester',
  'logViewer',
  'automationMap',
  'suiteqlConsole',
  'environmentGuard',
  'fieldIdsOverlay',
  'quickGoto',
  'commandPalette',
  'aiAssist',
  'aiContextExport',
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export type FeatureDefinition = {
  id: FeatureId;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  defaultEnabled: boolean;
};

export const FEATURES: readonly FeatureDefinition[] = [
  {
    id: 'documentationGenerator',
    labelKey: 'feature.documentationGenerator',
    descriptionKey: 'feature.documentationGenerator.desc',
    defaultEnabled: false,
  },
  {
    id: 'mcpBridge',
    labelKey: 'feature.mcpBridge',
    descriptionKey: 'feature.mcpBridge.desc',
    defaultEnabled: false,
  },
  {
    id: 'impactAnalysis',
    labelKey: 'feature.impactAnalysis',
    descriptionKey: 'feature.impactAnalysis.desc',
    defaultEnabled: true,
  },
  {
    id: 'commandPalette',
    labelKey: 'feature.commandPalette',
    descriptionKey: 'feature.commandPalette.desc',
    defaultEnabled: true,
  },
  {
    id: 'logViewer',
    labelKey: 'feature.logViewer',
    descriptionKey: 'feature.logViewer.desc',
    defaultEnabled: true,
  },
  {
    id: 'restletTester',
    labelKey: 'feature.restletTester',
    descriptionKey: 'feature.restletTester.desc',
    defaultEnabled: true,
  },
  {
    id: 'recordInspector',
    labelKey: 'feature.recordInspector',
    descriptionKey: 'feature.recordInspector.desc',
    defaultEnabled: true,
  },
  {
    id: 'fieldExplorer',
    labelKey: 'feature.fieldExplorer',
    descriptionKey: 'feature.fieldExplorer.desc',
    defaultEnabled: true,
  },
  {
    id: 'automationMap',
    labelKey: 'feature.automationMap',
    descriptionKey: 'feature.automationMap.desc',
    defaultEnabled: true,
  },
  {
    id: 'suiteqlConsole',
    labelKey: 'feature.suiteqlConsole',
    descriptionKey: 'feature.suiteqlConsole.desc',
    defaultEnabled: true,
  },
  {
    id: 'environmentGuard',
    labelKey: 'feature.environmentGuard',
    descriptionKey: 'feature.environmentGuard.desc',
    defaultEnabled: true,
  },
  {
    id: 'fieldIdsOverlay',
    labelKey: 'feature.fieldIdsOverlay',
    descriptionKey: 'feature.fieldIdsOverlay.desc',
    defaultEnabled: true,
  },
  {
    id: 'quickGoto',
    labelKey: 'feature.quickGoto',
    descriptionKey: 'feature.quickGoto.desc',
    defaultEnabled: true,
  },
  {
    id: 'aiAssist',
    labelKey: 'feature.aiAssist',
    descriptionKey: 'feature.aiAssist.desc',
    defaultEnabled: true,
  },
  {
    id: 'aiContextExport',
    labelKey: 'feature.aiContextExport',
    descriptionKey: 'feature.aiContextExport.desc',
    defaultEnabled: true,
  },
];

export const DEFAULT_FEATURES: Record<FeatureId, boolean> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f.defaultEnabled]),
) as Record<FeatureId, boolean>;

const ALL_OFF: Readonly<Record<FeatureId, boolean>> = Object.freeze(
  Object.fromEntries(FEATURE_IDS.map((id) => [id, false])) as Record<FeatureId, boolean>,
);

/**
 * Features that are actually on. Safe mode (PRD-06 F-6.1) turns everything off without
 * touching the stored toggles. Returns stable references so store selectors don't re-render.
 */
export function effectiveFeatures(settings: {
  features: Record<FeatureId, boolean>;
  safeMode: boolean;
}): Readonly<Record<FeatureId, boolean>> {
  return settings.safeMode ? ALL_OFF : settings.features;
}
