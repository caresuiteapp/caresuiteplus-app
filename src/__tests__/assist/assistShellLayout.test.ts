import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Assist module shell layout', () => {
  it('root assist layout wraps Stack in ShellLayout', () => {
    const layout = readSrc('app/assist/_layout.tsx');
    expect(layout).toContain('ShellLayout');
    expect(layout).toContain('area="assist"');
    expect(layout).toMatch(/<Stack[\s\S]*\/>/);
  });

  it('assist tabs layout does not nest a second ShellLayout', () => {
    const layout = readSrc('app/assist/(tabs)/_layout.tsx');
    expect(layout).not.toContain('ShellLayout');
    expect(layout).toContain('Shell lives in app/assist/_layout.tsx');
  });

  it('German kalender alias redirects to canonical calendar route', () => {
    const route = readSrc('app/assist/kalender.tsx');
    expect(route).toContain('Redirect');
    expect(route).toContain('/assist/calendar');
  });
});
