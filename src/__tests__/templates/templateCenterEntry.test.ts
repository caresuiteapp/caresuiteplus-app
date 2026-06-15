import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Vorlagenzentrum Premium Entry (Sprint 54)', () => {
  it('TemplateCenterHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/templates/TemplateCenterHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Vorlagenzentrum');
    expect(hero).toContain('Paket F');
  });

  it('TemplateCenterHero zeigt KPI-Karten für System- und Mandantenvorlagen', () => {
    const hero = readSrc('src/components/templates/TemplateCenterHero.tsx');
    expect(hero).toContain('PremiumKpiCard');
    expect(hero).toContain('Systemvorlagen');
    expect(hero).toContain('Mandantenvorlagen');
    expect(hero).toContain('stats.systemCount');
    expect(hero).toContain('stats.tenantCount');
  });

  it('TemplateCenterScreen ersetzt flaches KPI-Grid durch TemplateCenterHero', () => {
    const screen = readSrc('src/screens/templates/TemplateCenterScreen.tsx');
    expect(screen).toContain('TemplateCenterHero');
    expect(screen).not.toContain('kpiGrid');
  });
});
