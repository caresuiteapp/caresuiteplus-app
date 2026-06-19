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
    expect(shell).toContain("mainModule !== 'zentrale'");
    expect(shell).toMatch(/showModuleNav\s*=\s*width\s*>=\s*960\s*&&\s*!isPhoneLayout\s*&&\s*mainModule\s*!==\s*'zentrale'/);
    expect(shell).not.toMatch(/showModuleNav\s*=\s*width\s*>=\s*960;/);
  });

  it('PlatformShell hides ModuleNavSidebar for Zentrale module', () => {
    const shell = readSrc('src/components/layout/platform/platformshell.tsx');
    expect(shell).toContain("mainModule !== 'zentrale'");
    expect(shell).toContain('RightContextPanel');
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
    expect(data).toContain('officeContextPanelNav');
    expect(data).toContain("mainModule === 'office'");
    expect(data).toContain('/business/modules');
    expect(data).toContain('/business/office/audit-log');
  });

  it('context panel sections have at least 5 items and collapse to 2 initially', () => {
    const data = readSrc('src/components/layout/platform/platformContextData.ts');
    const desktop = readSrc('src/components/layout/platform/rightcontextpanel.tsx');
    const mobile = readSrc('src/components/layout/platform/mobileplatformcontextpanel.tsx');

    expect(desktop).toContain('CollapsibleSidebarSection');
    expect(mobile).toContain('CollapsibleSidebarSection');

    const collapsible = readSrc('src/components/layout/platform/collapsiblesidebarsection.tsx');
    expect(collapsible).toContain('initialVisibleCount = 2');
    expect(collapsible).toContain("moreLabel = 'Mehr'");
    expect(collapsible).toContain('<Modal visible={open}');
    expect(collapsible).not.toContain('(mehr...)');
    expect(collapsible).not.toContain('(weniger...)');
    expect(desktop).toContain('closeMenu');
    expect(mobile).toContain('closeMenu');

    const quickActionLabels = [
      'Klient:in anlegen',
      'Rechnung erstellen',
      'Termin planen',
      'Dokument hochladen',
      'Mitarbeitende anlegen',
    ];
    for (const label of quickActionLabels) {
      expect(data).toContain(label);
    }

    const navGroups = ['Übersicht', 'Organisation', 'Insight & QM'] as const;
    for (const group of navGroups) {
      expect(data).toContain(`title: '${group}'`);
    }

    expect(data).toContain("href: '/office/appointments'");
    expect(data).toContain("href: '/business/office/access/tasks'");
    expect(data).toContain("href: '/business/office/settings'");
    expect(data).toContain("href: '/business/office/access/roles'");
    expect(data).toContain("href: '/business/office/admin/operations-monitoring'");
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
