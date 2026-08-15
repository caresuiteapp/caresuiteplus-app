import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('CareSuite HealthOS loading indicator', () => {
  const indicator = readFileSync('src/components/brand/CareSuiteLoadingIndicator.tsx', 'utf8');
  const styles = readFileSync('src/components/brand/careSuiteLoaderStyles.ts', 'utf8');

  it('verwendet systemweit das originale HealthOS-Logo genau einmal', () => {
    expect(indicator).toContain("require('../../../assets/brand/caresuite-healthos-logo.png')");
    expect(indicator).toContain('CareSuite HealthOS wird geladen');
    expect(indicator).not.toContain("const LABEL = 'CareSuite+'");
  });

  it('ersetzt die Punktanimation durch einen fließenden Orbit', () => {
    expect(indicator).toContain('styles.webOrbitGlow');
    expect(indicator).toContain('styles.nativeOrbit');
    expect(indicator).toContain('styles.particle');
    expect(styles).toContain('@keyframes caresuite-healthos-orbit');
    expect(styles).not.toContain('caresuite-loader-dot');
  });

  it('respektiert reduzierte Bewegung auf Web und Native', () => {
    expect(indicator).toContain('usePrefersReducedMotion');
    expect(indicator).toContain('if (reducedMotion)');
    expect(indicator).toMatch(/const orbitAnimation = reducedMotion\s*\? null/);
  });
});
