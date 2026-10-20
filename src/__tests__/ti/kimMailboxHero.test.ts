import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildKIMMailboxListKpis } from '@/lib/ti/kimMailboxStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('KIM Mailbox List Hero (Sprint 97)', () => {
  it('KIMMailboxListHero nutzt PremiumListHeroFrame mit isTILiveReady', () => {
    const hero = readSrc('src/components/ti/KIMMailboxListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isTILiveReady');
    expect(readSrc('src/screens/ti/KIMMailboxScreen.tsx')).toContain('KIMMailboxListHero');
  });

  it('buildKIMMailboxListKpis zählt ungelesene Nachrichten', () => {
    const kpis = buildKIMMailboxListKpis(
      [
        { id: '1', status: 'unread' } as never,
        { id: '2', status: 'read' } as never,
      ],
      5,
    );
    expect(kpis[0]?.value).toBe('5');
    expect(kpis[1]?.value).toBe('1');
  });
});
