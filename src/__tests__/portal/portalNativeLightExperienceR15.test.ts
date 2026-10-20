import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('R15 portal-only native light experience', () => {
  it('builds the portal edition as a light native application', () => {
    const config = read('app.config.ts');
    const rootLayout = read('app-portal/_layout.tsx');
    expect(config).toContain("userInterfaceStyle: isPortalOnlyEdition ? 'light' : 'dark'");
    expect(rootLayout).toContain('<StatusBar style="dark" />');
  });

  it('uses the light ORBIT portal shell instead of the legacy classic shell', () => {
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    expect(shell).toContain('LiquidVisualModeProvider mode="orbit"');
    expect(shell).not.toContain('LiquidVisualModeProvider mode="classic"');
    expect(shell).toContain("backgroundColor: 'rgba(255,255,255,0.98)'");
    expect(shell).toContain("backgroundColor: '#FFFFFF'");
  });

  it('renders portal authentication on the dedicated light app surface', () => {
    const appScreen = read('src/design/components/AppScreen.tsx');
    const authShell = read('src/design/components/AuthPageShell.tsx');
    expect(appScreen).toContain("appearance?: 'default' | 'light'");
    expect(authShell).toContain('appearance="light"');
    expect(authShell).toContain('<PortalPremiumProvider kind="workspace">');
  });

  it('keeps the employee home actions bright and touch-oriented', () => {
    const home = read('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx');
    expect(home).toContain("colors={['#FFFFFF', '#F1F7FF', '#E2EFFF']}");
    expect(home).toContain('minHeight: 48');
    expect(home).not.toContain("colors={['#0B5CC9', '#073E8D', '#052B68']}");
  });
});
