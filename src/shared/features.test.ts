import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATURES, effectiveFeatures, FEATURE_IDS } from './features';

describe('effectiveFeatures', () => {
  it('returns the stored toggles when Safe mode is off', () => {
    const features = { ...DEFAULT_FEATURES, logViewer: false };
    expect(effectiveFeatures({ features, safeMode: false })).toBe(features);
  });

  it('turns every feature off in Safe mode with a stable reference', () => {
    const off = effectiveFeatures({ features: DEFAULT_FEATURES, safeMode: true });
    expect(FEATURE_IDS.every((id) => off[id] === false)).toBe(true);
    expect(effectiveFeatures({ features: { ...DEFAULT_FEATURES }, safeMode: true })).toBe(off);
    expect(Object.isFrozen(off)).toBe(true);
  });
});
