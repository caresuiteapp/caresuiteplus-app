import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('CareSuite robot logo branding', () => {
  it('brandassets points to the landing-page robot PNG', () => {
    const source = readSrc('src/components/brand/brandassets.ts');
    expect(source).toContain('caresuite-robot-logo.png');
    expect(source).not.toContain('assets/icon.png');
  });

  it('CareSuiteLogoMark loads robot logo with transparent background', () => {
    const source = readSrc('src/components/brand/CareSuiteLogoMark.tsx');
    expect(source).toContain('CARESUITE_ROBOT_LOGO');
    expect(source).toContain("backgroundColor: 'transparent'");
  });

  it('desktop shells use logo instead of text-only brand', () => {
    expect(readSrc('src/components/layout/DesktopShell.tsx')).toContain('CareSuiteLogoMark');
    expect(readSrc('src/components/layout/CareLightDesktopShell.tsx')).toContain('CareSuiteWordmark');
  });
});
