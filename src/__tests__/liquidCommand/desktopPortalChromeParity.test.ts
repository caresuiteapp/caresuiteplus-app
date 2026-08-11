import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liquidModules } from '@/liquid-command/navigation/moduleCatalog';

const root = process.cwd();
const shell = readFileSync(
  join(root, 'src/liquid-command/shell/LiquidCommandShell.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');
const routeLayout = readFileSync(
  join(root, 'src/liquid-command/shell/LiquidModuleRouteLayout.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');
const premiumTheme = readFileSync(
  join(root, 'src/design/tokens/portalPremium.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');

describe('desktop and portal chrome parity', () => {
  it('uses one labelled desktop rail for every productive module', () => {
    expect(liquidModules.map((module) => module.key)).toEqual([
      'home',
      'office',
      'assist',
      'pflege',
      'stationaer',
      'beratung',
      'akademie',
      'robotics',
      'settings',
    ]);
    expect(shell).toContain('<LiquidLogo compact />');
    expect(shell).toContain('HEALTHOS DESKTOP');
    expect(shell).toContain('styles.dockItemActive');
    expect(shell).toContain('{module.label}');
    expect(shell).toContain('Sicher abmelden');
  });

  it('carries the portal top bar identity into the desktop workspace', () => {
    expect(shell).toContain('{module.label.toUpperCase()}');
    expect(shell).toContain('{module.description}');
    expect(shell).toContain('styles.profileCopy');
    expect(shell).toContain('{displayName}');
    expect(shell).toContain('{role}');
    expect(shell).toContain('<PortalTextSizeControls />');
    expect(shell).toContain('label="Suchen"');
    expect(shell).not.toContain('styles.commandShortcutBar');
  });

  it('keeps desktop content open and avoids a second nested glass frame', () => {
    expect(shell).toContain('layout.isDesktop ? (');
    expect(shell).toContain('style={styles.workspaceFrame}');
    expect(shell).not.toContain('contentStyle={styles.workspaceFrameContent}');
    expect(shell).not.toContain('style={styles.areaRail}');
    expect(shell).toContain('const showAreaNavigation =');
    expect(shell).toContain('<WorkAreaNavigation');
  });

  it('activates the complete portal surface system for every internal workspace route', () => {
    expect(routeLayout).toContain('PortalPremiumProvider');
    expect(routeLayout).toContain('<PortalPremiumProvider kind="workspace">');
    expect(routeLayout).toContain('<LiquidModuleContent />');
    expect(premiumTheme).toContain("'client' | 'employee' | 'workspace'");
    expect(premiumTheme).toContain("value === 'workspace'");
  });

  it('keeps compact navigation separate from desktop chrome', () => {
    expect(shell).toContain('!layout.isDesktop ? (');
    expect(shell).toContain('<BottomNavigation');
    expect(shell).toContain('layout.showDock ? (');
    expect(shell).toContain('<ModuleDock');
  });
});
