import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/liquid-command/screens/CommandCenterScreen.tsx'),
  'utf8',
);

describe('HealthOS background ping-pong motion', () => {
  it('uses independent horizontal and vertical edge loops', () => {
    expect(source).toContain('const horizontalLoop = Animated.loop');
    expect(source).toContain('const verticalLoop = Animated.loop');
    expect(source).toContain('toValue: auroraMaxX');
    expect(source).toContain('toValue: auroraMaxY');
    expect(source.match(/easing: Easing\.linear/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('calculates movement limits from the current viewport and orb size', () => {
    expect(source).toContain('width - auroraWidth');
    expect(source).toContain('height - auroraHeight');
    expect(source).toContain('testID="healthos-ping-pong-aurora"');
    expect(source).toContain("top: 0, left: 0");
  });

  it('respects the operating-system reduced-motion setting', () => {
    expect(source).toContain('if (reducedMotion)');
    expect(source).toContain('auroraX.setValue(auroraMaxX * 0.5)');
    expect(source).toContain('auroraY.setValue(auroraMaxY * 0.42)');
  });
});
