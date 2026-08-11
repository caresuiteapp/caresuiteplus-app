import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');

describe('ORBIT internal animated background', () => {
  it('mounts the shared animated background on every internal route but never in a portal', () => {
    const layout = read('app/_layout.tsx');

    expect(layout).toContain('const hostsGlobalBackground = !isPortalRoutePath(pathname);');
    expect(layout).toContain('<GlobalAnimatedBackground mode={mode} animated={backgroundAnimated} />');
    expect(layout).not.toContain('!isLiquidCommandRoute && !isPortalRoutePath(pathname)');
  });

  it('keeps the ORBIT Liquid backdrop transparent so the motion remains visible', () => {
    const primitives = read('src/liquid-command/components/LiquidPrimitives.tsx');

    expect(primitives).toContain('{!orbit ? (');
    expect(primitives).toContain("orbitBackdrop: {\n    backgroundColor: 'transparent'");
    expect(primitives).not.toContain("colors={orbit ? ['#F8FBFF', '#EFF6FF', '#FFFFFF']");
  });

  it('uses slow motion and respects the reduced-motion accessibility setting', () => {
    const background = read('src/components/ui/effects/globalanimatedbackground.tsx');

    expect(background).toContain('usePrefersReducedMotion()');
    expect(background).toContain('if (!animated || reduceMotion)');
    expect(background).toContain('duration: 18000');
    expect(background).toContain('styles.orbitLineLarge');
    expect(background).toContain('styles.orbitLineSmall');
  });
});
