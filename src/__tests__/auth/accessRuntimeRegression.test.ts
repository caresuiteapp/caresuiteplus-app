import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('production access runtime regressions', () => {
  it('marks hydration completion as a transition', () => {
    const hydratedHook = source('src/hooks/useHydrated.ts');

    expect(hydratedHook).toContain('startTransition');
    expect(hydratedHook).toContain('setHydrated(true)');
  });

  it('uses hydration-safe dimensions for the liquid access layouts', () => {
    const layoutHook = source('src/liquid-command/foundation/useLiquidLayout.ts');

    expect(layoutHook).toContain('useHydrationSafeWindowDimensions');
    expect(layoutHook).not.toContain('useWindowDimensions');
  });

  it('does not request the unavailable native animation driver on web', () => {
    const accessHub = source('src/liquid-command/screens/AccessHubScreen.tsx');

    expect(accessHub).toContain(
      "const ACCESS_ANIMATION_USES_NATIVE_DRIVER = Platform.OS !== 'web'",
    );
    expect(accessHub).not.toContain('useNativeDriver: true');
  });

  it('keeps the former administration login URL compatible', () => {
    const redirect = source('app/auth/login.tsx');

    expect(redirect).toContain('<Redirect href="/auth/business-login" />');
  });
});
