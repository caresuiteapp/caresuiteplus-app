import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());

describe('design-audit script', () => {
  it('design-audit.mjs existiert und prüft careSuiteColors', () => {
    const scriptPath = join(root, 'scripts/design-audit.mjs');
    expect(existsSync(scriptPath)).toBe(true);
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toContain('careSuiteColors');
    expect(content).toContain('CareSuiteWordmark');
    expect(content).toContain('WP ');
  });

  it('responsive-audit.mjs prüft CareAdaptiveShell', () => {
    const scriptPath = join(root, 'scripts/responsive-audit.mjs');
    expect(existsSync(scriptPath)).toBe(true);
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toContain('CareAdaptiveShell');
    expect(content).toContain('AdaptiveKpiGrid');
    expect(content).toContain('useResponsiveValue');
  });
});
