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

  it('uses the second row exclusively for evenly distributed module navigation', () => {
    const moduleNavigation = shell.slice(
      shell.indexOf('function OrbitModuleNavigation('),
      shell.indexOf('function CommandPalette('),
    );

    expect(moduleNavigation).not.toContain('styles.orbitBrand');
    expect(moduleNavigation).toContain('styles.orbitModuleItems');
    expect(shell).toContain("minWidth: '100%'");
    expect(shell).toContain('flexGrow: 1');
    expect(shell).toContain('flexBasis: 0');
    expect(shell).toContain('size={24}');
  });

  it('renders Live at the same 44 pixel control height as the command buttons', () => {
    expect(shell).toContain('style={styles.commandLive}');
    expect(shell).toMatch(/commandLive:\s*\{[\s\S]*?height: 44,/);
    expect(shell).toContain("layout.width < 1320");
  });
});
