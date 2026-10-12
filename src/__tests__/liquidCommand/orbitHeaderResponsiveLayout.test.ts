import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const shell = readFileSync(
  join(process.cwd(), 'src/liquid-command/shell/LiquidCommandShell.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');

describe('ORBIT responsive header layout', () => {
  it('keeps the brand and active module context together in the first row', () => {
    const commandBar = shell.slice(
      shell.indexOf('function CommandBar('),
      shell.indexOf('function BottomNavigation('),
    );

    expect(commandBar).toContain('styles.orbitBrand');
    expect(commandBar).toContain('styles.commandIdentity');
    expect(commandBar).toContain('styles.commandContext');
    expect(commandBar).toContain('{module.label.toUpperCase()}');
    expect(commandBar).toContain('{module.description}');
  });

  it('keeps workflow navigation while the retired module row is absent', () => {
    expect(shell).not.toContain('function OrbitModuleNavigation(');
    expect(shell).not.toContain('<OrbitModuleNavigation');
    expect(shell).not.toContain('function ModuleDock(');
    const areaNavigation = shell.slice(shell.indexOf('function WorkAreaNavigation('), shell.indexOf('function CommandPalette('));
    expect(areaNavigation).toContain('liquidWorkAreas[moduleKey]');
    expect(areaNavigation).toContain('router.push(area.route');
    expect(shell).toContain('<CommandBar');
    expect(shell).toContain('<WorkAreaNavigation');
  });

  it('renders Live at the same 44 pixel control height as the command buttons', () => {
    expect(shell).toContain('style={styles.commandLive}');
    expect(shell).toMatch(/commandLive:\s*\{[\s\S]*?height: 44,/);
    expect(shell).toContain("layout.width < 1320");
  });
});
