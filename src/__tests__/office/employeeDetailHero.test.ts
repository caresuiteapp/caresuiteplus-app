import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDemoEmployeeDetail } from '@/data/demo/employeeDetails';
import { buildEmployeeDetailKpis } from '@/lib/office/employeeDetailStats';
import { isEmployeeDetailLiveReady } from '@/lib/office/employeeModuleConfig';
import { fetchEmployeeDetail } from '@/lib/office/employeeDetailService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Office Employee Detail Hero (Sprint 69)', () => {
  it('EmployeeDetailHero nutzt PremiumListHeroFrame mit buildEmployeeDetailKpis', () => {
    const hero = readSrc('src/components/office/EmployeeDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('buildEmployeeDetailKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('EmployeeDetailHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/office/EmployeeDetailHero.tsx');
    const config = readSrc('src/lib/office/employeeModuleConfig.ts');
    expect(config).toContain('isEmployeeDetailLiveReady');
    expect(hero).toContain('isEmployeeDetailLiveReady');
    expect(hero).toContain('Teilweise live');
    expect(isEmployeeDetailLiveReady()).toBe(false);
  });

  it('EmployeeDetailScreen ersetzt flache PremiumCard-Header durch Hero', () => {
    const screen = readSrc('src/screens/office/EmployeeDetailScreen.tsx');
    expect(screen).toContain('EmployeeDetailHero');
    expect(screen).not.toContain('PremiumCard accentColor');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('EMPLOYEE_DETAIL_PREPARED_MESSAGE');
  });

  it('buildEmployeeDetailKpis berechnet Betriebszugehörigkeit, Abteilung und Kontakt', async () => {
    const detail = getDemoEmployeeDetail('employee-001');
    expect(detail).toBeTruthy();
    if (!detail) return;

    const kpis = buildEmployeeDetailKpis(detail);
    expect(kpis.some((k) => k.id === 'tenure')).toBe(true);
    expect(kpis.some((k) => k.id === 'department')).toBe(true);
    expect(kpis.some((k) => k.id === 'contact')).toBe(true);
    expect(kpis.some((k) => k.id === 'updated')).toBe(true);
  });

  it('employeeDetailService nutzt guardServiceTenant ohne service_role', () => {
    const service = readSrc('src/lib/office/employeeDetailService.ts');
    expect(service).toContain('guardServiceTenant');
    expect(service).toContain('getDetailMapped');
    expect(service).not.toContain('service_role');
  });

  it('fetchEmployeeDetail liefert Demo-Vollprofil', async () => {
    const result = await fetchEmployeeDetail('employee-001', DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.department).toBeTruthy();
  });
});
