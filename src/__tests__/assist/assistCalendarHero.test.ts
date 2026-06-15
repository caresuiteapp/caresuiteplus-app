import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildAssistCalendarKpis } from '@/lib/assist/calendarStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Assist Calendar Hero (Sprint 90)', () => {
  it('AssistCalendarListHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/assist/AssistCalendarListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Wochenübersicht');
    expect(hero).toContain('isAssistExtensionLiveReady');
    expect(hero).toContain('Demo / preparedOnly');
  });

  it('AssistCalendarScreen nutzt AssistCalendarListHero', () => {
    const screen = readSrc('src/screens/assist/AssistCalendarScreen.tsx');
    expect(screen).toContain('AssistCalendarListHero');
    expect(screen).not.toContain('PreparedModeBanner');
  });

  it('buildAssistCalendarKpis zählt Einsätze', () => {
    const kpis = buildAssistCalendarKpis([
      {
        dateKey: '2026-06-14',
        label: 'Sa 14.06.',
        assignments: [
          {
            id: 'a1',
            tenantId: 't1',
            clientName: 'Müller',
            employeeName: 'Schmidt',
            title: 'Einsatz',
            location: 'Zuhause',
            scheduledStart: '2026-06-14T08:00:00Z',
            scheduledEnd: '2026-06-14T10:00:00Z',
            status: 'aktiv',
            updatedAt: '2026-06-14',
          },
        ],
      },
    ]);
    expect(kpis[0]?.value).toBe('1');
    expect(kpis[1]?.value).toBe('1');
  });
});
