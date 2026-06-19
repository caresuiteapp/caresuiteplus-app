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

  it('MobilePlatformContextPanel places nav groups below Schnellaktionen without Zentrale block', () => {
    const mobile = readSrc('src/components/layout/platform/mobileplatformcontextpanel.tsx');
    expect(mobile).toContain('SCHNELLAKTIONEN');
    expect(mobile).toContain('quickActions');
    expect(mobile).toContain('navSection');
    expect(mobile).toContain('navActiveBar');
    expect(mobile).toContain('resolveContextPanelNavConfig');
    expect(mobile).toContain('group.title');
    expect(mobile).not.toContain('schnellRow');
    expect(mobile).not.toContain('schnellRight');
    expect(mobile).not.toContain('Zentrale');
    expect(mobile).not.toContain('Navigation');
  });

  it('RightContextPanel places nav groups below Schnellaktionen without Zentrale block', () => {
    const desktop = readSrc('src/components/layout/platform/rightcontextpanel.tsx');
    expect(desktop).toContain('Schnellaktionen');
    expect(desktop).toContain('quickActions');
    expect(desktop).toContain('navSection');
    expect(desktop).toContain('navActiveBar');
    expect(desktop).toContain('resolveContextPanelNavConfig');
    expect(desktop).toContain('group.title');
    expect(desktop).not.toContain('schnellRow');
    expect(desktop).not.toContain('schnellRight');
    expect(desktop).not.toContain('Zentrale');
    expect(desktop).not.toMatch(/config\.label/);
    expect(desktop).not.toContain('Navigation');
  });

  it('context panel nav uses business hub links for Office module', () => {
    const data = readSrc('src/components/layout/platform/platformContextData.ts');
    const zentrale = readSrc('src/lib/navigation/modulenav/zentralenav.ts');
    expect(data).toContain('zentraleNav');
    expect(data).toContain("mainModule === 'office'");
    expect(zentrale).toContain('/business/modules');
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
