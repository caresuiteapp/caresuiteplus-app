import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('modal stack navigation', () => {
  it('registers ModalStackProvider at app root', () => {
    const layout = readSrc('app/_layout.tsx');
    expect(layout).toContain('ModalStackProvider');
  });

  it('ModalStackProvider exposes stack renderer', () => {
    const provider = readSrc('src/components/navigation/ModalStackProvider.tsx');
    expect(provider).toContain('ModalStackRenderer');
  });

  it('useModalStack defines open, push, close and back', () => {
    const hook = readSrc('src/hooks/useModalStack.ts');
    expect(hook).toContain('openModal');
    expect(hook).toContain('pushModal');
    expect(hook).toContain('closeTopModal');
    expect(hook).toContain('goBackModal');
    expect(hook).toContain('modalStack');
  });

  it('module nav sidebar uses modal navigation on web/desktop', () => {
    const sidebar = readSrc('src/components/layout/platform/modulenavsidebar.tsx');
    expect(sidebar).toContain('navigateModuleNavItem');
    expect(sidebar).toContain('openModal');
  });

  it('modal screens registry includes assist settings and record prep', () => {
    const screens = readSrc('src/lib/navigation/modulenav/modalscreens.ts');
    expect(screens).toContain("'assist.settings'");
    expect(screens).toContain("'prep.client.record'");
    expect(screens).toContain("'prep.employee.record'");
  });
});
