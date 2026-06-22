import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Module nav modal routing', () => {
  it('adminNav markiert Settings- und Zugänge-Routen für Modal', () => {
    const adminNav = readSrc('src/lib/navigation/moduleNav/adminNav.ts');
    expect(adminNav).toContain("modalKey: 'settings.tenant'");
    expect(adminNav).toContain("modalKey: 'settings.profile'");
    expect(adminNav).toContain("modalKey: 'office.access'");
    expect(adminNav).toContain("modalKey: 'settings.data-request'");
    expect(adminNav).toContain('openInModal: true');
  });

  it('modalScreens registriert alle admin modalKeys', () => {
    const modalScreens = readSrc('src/lib/navigation/moduleNav/modalScreens.ts');
    expect(modalScreens).toContain("'settings.profile'");
    expect(modalScreens).toContain("'settings.tenant'");
    expect(modalScreens).toContain("'settings.data-request'");
    expect(modalScreens).toContain("'office.access'");
    expect(modalScreens).toContain('embeddedInModal');
  });

  it('ModuleNavSidebar öffnet PlatformModal auf Desktop/Tablet', () => {
    const sidebar = readSrc('src/components/layout/platform/modulenavsidebar.tsx');
    expect(sidebar).toContain('navigateModuleNavItem');
    const nav = readSrc('src/lib/navigation/modulenav/navigateModuleNavItem.ts');
    expect(nav).toContain('openInModal');
    expect(nav).toContain("adaptiveShell === 'desktop'");
    expect(readSrc('src/lib/navigation/moduleNav/modalscreens.ts')).toContain('embeddedInModal');
  });

  it('Settings-Screens nutzen SettingsScreenFrame für PlatformShell', () => {
    expect(readSrc('src/screens/settings/UserProfileScreen.tsx')).toContain('SettingsScreenFrame');
    expect(readSrc('src/screens/settings/TenantSettingsScreen.tsx')).toContain('SettingsScreenFrame');
    expect(readSrc('src/screens/settings/DataRequestScreen.tsx')).toContain('SettingsScreenFrame');
    expect(readSrc('src/components/settings/SettingsScreenFrame.tsx')).toContain('showSideNavigation');
  });

  it('business/office Layout nutzt ShellLayout', () => {
    const layout = readSrc('app/business/office/_layout.tsx');
    expect(layout).toContain('ShellLayout');
    expect(layout).toContain('area="office"');
  });

  it('officeNav markiert Zugänge für Modal', () => {
    const officeNav = readSrc('src/lib/navigation/moduleNav/officeNav.ts');
    expect(officeNav).toContain("modalKey: 'office.access'");
    expect(officeNav).toContain('openInModal: true');
  });
});
