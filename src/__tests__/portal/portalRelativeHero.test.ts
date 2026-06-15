import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Portal Angehörigenportal Polish (Sprint 94)', () => {
  it('PortalTabHero unterstützt portal_family Scope', () => {
    const hero = readSrc('src/components/portal/PortalTabHero.tsx');
    expect(hero).toContain('portal_family');
    expect(hero).toContain('ANGEHÖRIGENPORTAL');
    expect(hero).toContain('Geteilte Sicht');
  });

  it('resolvePortalScope liefert portal_family für family_portal', () => {
    const visibility = readSrc('src/lib/portal/portalVisibility.ts');
    expect(visibility).toContain("return 'portal_family'");
  });
});
