import type { MessageKey } from './i18n';

/**
 * Feature flags. Every feature can be switched off in Settings (US-1.8).
 * Safety features (Environment Guard) are never gated behind a paid tier (PRD-00 §7).
 */
export const FEATURE_IDS = [
  'fieldExplorer',
  'automationMap',
  'environmentGuard',
  'fieldIdsOverlay',
  'quickGoto',
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
];

export const DEFAULT_FEATURES: Record<FeatureId, boolean> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f.defaultEnabled]),
) as Record<FeatureId, boolean>;
