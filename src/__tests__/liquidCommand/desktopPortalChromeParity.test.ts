import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liquidModules } from '@/liquid-command/navigation/moduleCatalog';

const root = process.cwd();
const shell = readFileSync(
  join(root, 'src/liquid-command/shell/LiquidCommandShell.tsx'),
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
      'platform',
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
  });

  it('places desktop content inside the same framed liquid surface model', () => {
    expect(shell).toContain('layout.isDesktop ? (');
    expect(shell).toContain('style={styles.workspaceFrame}');
    expect(shell).toContain('contentStyle={styles.workspaceFrameContent}');
    expect(shell).toContain("backgroundColor: 'rgba(7,27,53,0.78)'");
  });

  it('keeps compact navigation separate from desktop chrome', () => {
    expect(shell).toContain('!layout.isDesktop ? (');
    expect(shell).toContain('<BottomNavigation');
    expect(shell).toContain('layout.showDock ? <ModuleDock');
  });
});
