import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office mobile platform layout', () => {
  it('PlatformShell hides ModuleNavSidebar below 768px', () => {
    const shell = readSrc('src/components/layout/platform/platformshell.tsx');
    expect(shell).toContain('breakpoints.tablet');
    expect(shell).toContain('isPhoneLayout');
    expect(shell).toContain('showModuleNav = width >= 960 && !isPhoneLayout');
    expect(shell).not.toMatch(/showModuleNav\s*=\s*width\s*>=\s*960;/);
  });

  it('MobilePlatformContextPanel integrates nav under Schnellaktionen without Zentrale block', () => {
    const mobile = readSrc('src/components/layout/platform/mobileplatformcontextpanel.tsx');
    expect(mobile).toContain('SCHNELLAKTIONEN');
    expect(mobile).toContain('schnellRow');
    expect(mobile).toContain('schnellLeft');
    expect(mobile).toContain('schnellRight');
    expect(mobile).toContain('getModuleNavConfig');
    expect(mobile).not.toContain('Zentrale');
    expect(mobile).not.toContain('Navigation');
  });

  it('MobilePlatformContextPanel uses aurora glass surfaces', () => {
    const mobile = readSrc('src/components/layout/platform/mobileplatformcontextpanel.tsx');
    expect(mobile).toContain('GlassCard');
    expect(mobile).toContain('auroraGlass');
    expect(mobile).not.toContain('#FFFFFF');
  });

  it('MobilePlatformContextPanel keeps office quick actions with real routes', () => {
    const mobile = readSrc('src/components/layout/platform/mobileplatformcontextpanel.tsx');
    const data = readSrc('src/components/layout/platform/platformContextData.ts');
    expect(mobile).toContain('OFFICE_QUICK_ACTIONS');
    expect(mobile).toContain('router.push');
    expect(data).toContain('Klient:in anlegen');
    expect(data).toContain('Rechnung erstellen');
  });
});
