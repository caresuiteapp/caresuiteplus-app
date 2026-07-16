import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('global desktop workspace shell', () => {
  it('persists both sides independently with versioned, SSR-safe keys', () => {
    const source = read('src/hooks/useDesktopWorkspacePreferences.ts');
    expect(source).toContain('desktop-workspace.left-collapsed.v1');
    expect(source).toContain('desktop-workspace.right-collapsed.v1');
    expect(source).toContain("typeof window === 'undefined'");
    expect(source).toContain("Platform.OS !== 'web'");
    expect(source).toContain("writePreference('left', next)");
    expect(source).toContain("writePreference('right', next)");
  });

  it('exposes keyboard-accessible independent edge toggles', () => {
    const toggle = read('src/components/layout/DesktopSidebarToggle.tsx');
    expect(toggle).toContain('accessibilityState={{ expanded: !collapsed }}');
    expect(toggle).toContain("'aria-controls': controls");
    expect(toggle).toContain('accessibilityLabel={label}');
    expect(toggle).toContain('title={label}');
  });

  it.each([
    ['PlatformShell', 'src/components/layout/platform/platformshell.tsx'],
    ['PortalShell', 'src/components/layout/portal/PortalShellLayout.tsx'],
  ])('%s releases both sidebar widths completely', (_name, file) => {
    const source = read(file);
    expect(source).toContain('!leftCollapsed ?');
    expect(source).toContain('!rightCollapsed ?');
    expect(source).toContain('side="left"');
    expect(source).toContain('side="right"');
    expect(source).toContain('minWidth: 0');
  });

  it('adapts the isolated platform console shell without affecting its compact navigation', () => {
    const source = read('src/components/platformConsole/PlatformShellLayout.tsx');
    expect(source).toContain('!isWide || !leftCollapsed');
    expect(source).toContain('{isWide ? (');
    expect(source).toContain('side="left"');
  });

  it('removes only the shared desktop page description and retains mobile/tablet header UI', () => {
    const source = read('src/components/layout/ScreenHeader.tsx');
    expect(source).toContain('hideDesktopPageDescription = isDesktopOrWide');
    expect(source).toContain('accessibilityRole="header"');
    expect(source).toContain('visuallyHidden');
    expect(source).toContain('!hideDesktopPageDescription ? <>');
    expect(source).not.toContain("h1");
  });

  it('covers the adopted Assist/Office HealthOS shell variant centrally', () => {
    const source = read('src/components/healthos/shell/HealthOSAppShell.tsx');
    expect(source).toContain("showPageDescription = breakpoint !== 'desktop'");
    expect(source).toContain('showPageDescription ? topBar : null');
    expect(source).toContain('showPageDescription && breadcrumbs');
    expect(read('src/screens/assist/AssistIndexScreen.tsx')).toContain('HealthOSModuleShell');
    expect(read('src/screens/office/OfficeIndexScreen.tsx')).toContain('HealthOSModuleShell');
  });
});
