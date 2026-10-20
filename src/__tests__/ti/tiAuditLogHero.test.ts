import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildTIAuditLogListKpis } from '@/lib/ti/tiAuditLogStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('TI Audit Log List Hero (Sprint 99)', () => {
  it('TIAuditLogListHero nutzt PremiumListHeroFrame mit isTILiveReady', () => {
    const hero = readSrc('src/components/ti/TIAuditLogListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isTILiveReady');
    expect(readSrc('src/screens/ti/TIAuditLogScreen.tsx')).toContain('TIAuditLogListHero');
  });

  it('buildTIAuditLogListKpis zählt Consent-Ereignisse', () => {
    const kpis = buildTIAuditLogListKpis(
      [
        { action: 'consent_granted', actorName: 'A' } as never,
        { action: 'message_opened', actorName: 'B' } as never,
      ],
      5,
    );
    expect(kpis[0]?.value).toBe('5');
    expect(kpis[1]?.value).toBe('1');
  });
});
