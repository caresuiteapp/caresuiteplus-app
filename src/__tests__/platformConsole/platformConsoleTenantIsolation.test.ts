import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liquidModules } from '@/liquid-command/navigation/moduleCatalog';

const platformIndex = readFileSync(resolve(process.cwd(), 'app/platform/index.tsx'), 'utf8');

describe('Platform Console Mandantentrennung', () => {
  it('zeigt die Platform Console in keiner Mandantennavigation oder Mandantensuche', () => {
    expect(liquidModules.some((module) => module.key === 'platform')).toBe(false);
    expect(liquidModules.some((module) => module.route.startsWith('/platform'))).toBe(false);
  });

  it('schützt auch die Stammroute durch den eigenständigen Plattform-Guard', () => {
    expect(platformIndex).toContain('PlatformAuthGate');
    expect(platformIndex).toContain('<Redirect href="/platform/dashboard" />');
    expect(platformIndex).not.toContain('ModuleWorkspaceScreen');
  });
});
