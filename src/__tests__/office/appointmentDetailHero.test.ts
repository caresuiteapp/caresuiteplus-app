import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildAppointmentDetailKpis } from '@/lib/office/appointmentDetailStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Office Appointment Detail Hero (Sprint 82)', () => {
  it('AppointmentDetailHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/office/AppointmentDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('OFFICE · TERMIN');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('buildAppointmentDetailKpis mappt Termin ehrlich', () => {
    const kpis = buildAppointmentDetailKpis({
      id: 'a1',
      tenantId: 't1',
      clientId: 'c1',
      employeeId: 'e1',
      title: 'Hausbesuch',
      startsAt: '2026-06-14T10:00:00.000Z',
      endsAt: '2026-06-14T11:30:00.000Z',
      status: 'aktiv',
      location: 'Berlin',
      updatedAt: '2026-06-01T00:00:00.000Z',
      clientName: 'Maria Schmidt',
      employeeName: 'Anna Pflege',
      createdAt: '2026-06-01T00:00:00.000Z',
      notes: null,
    });
    expect(kpis).toHaveLength(4);
    expect(kpis[2]?.value).toBe('Maria Schmidt');
    expect(kpis[3]?.value).toBe('Anna Pflege');
  });

  it('AppointmentDetailScreen ersetzt flache PremiumCard', () => {
    const screen = readSrc('src/screens/office/AppointmentDetailScreen.tsx');
    expect(screen).toContain('AppointmentDetailHero');
    expect(screen).not.toContain('PremiumCard accentColor');
  });
});
