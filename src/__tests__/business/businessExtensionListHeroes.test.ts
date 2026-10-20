import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Business Extension List Heroes (Sprint 94)', () => {
  it('SecurityListHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/security/SecurityListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isSecurityLiveReady');
    expect(readSrc('src/screens/security/SecurityListScreen.tsx')).toContain('SecurityListHero');
  });

  it('QaListHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/qa/QaListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isQaLiveReady');
    expect(readSrc('src/screens/qa/QaListScreen.tsx')).toContain('QaListHero');
  });
});
