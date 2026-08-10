import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('ORBIT button single-surface contract', () => {
  it('renders internal actions without a nested glass or gradient surface', () => {
    const source = read('src/components/ui/PremiumButton.tsx');
    const orbitStart = source.indexOf('function OrbitPremiumButton(');
    const portalStart = source.indexOf('/** Existing portal presentation');
    const orbit = source.slice(orbitStart, portalStart);

    expect(orbitStart).toBeGreaterThan(-1);
    expect(portalStart).toBeGreaterThan(orbitStart);
    expect(orbit).not.toContain('LlganGlassShell');
    expect(orbit).not.toContain('LinearGradient');
    expect(orbit.match(/<Pressable/g)).toHaveLength(1);
    expect(orbit).toContain("csOrbitButton: 'root'");
  });

  it('keeps global ORBIT CSS free from button geometry', () => {
    const source = read('src/design/web/orbitInternalContractCss.ts');
    const bridgeStart = source.indexOf('Text-only bridge for the canonical ORBIT button component');
    const bridgeEnd = source.indexOf('[aria-selected="true"]', bridgeStart);
    const bridge = source.slice(bridgeStart, bridgeEnd);

    expect(source).not.toContain('ORBIT action controls');
    expect(source).not.toContain('[data-cs-llgan-glass="button"]');
    expect(bridge).not.toMatch(/background:|border:|box-shadow:|padding:|height:/);
  });

  it('keeps the existing portal renderer isolated', () => {
    const source = read('src/components/ui/PremiumButton.tsx');
    const portalStart = source.indexOf('/** Existing portal presentation');
    const portal = source.slice(portalStart);

    expect(portal).toContain('LlganGlassShell');
    expect(portal).toContain('portalPremium');
  });
});

