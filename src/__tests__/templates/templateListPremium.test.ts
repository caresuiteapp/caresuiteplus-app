import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Vorlagen-Listen Premium (Sprint 55)', () => {
  it('TemplateListHero nutzt PremiumListHeroFrame für System- und Mandantenvorlagen', () => {
    const hero = readSrc('src/components/templates/TemplateListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain("title: 'Systemvorlagen'");
    expect(hero).toContain("title: 'Mandantenvorlagen'");
    expect(hero).toContain('VORLAGENZENTRUM · PAKET F');
  });

  it('TemplateListHero zeigt Status-KPIs aus Listendaten', () => {
    const hero = readSrc('src/components/templates/TemplateListHero.tsx');
    expect(hero).toContain('PremiumKpiCard');
    expect(hero).toContain("'Aktiv'");
    expect(hero).toContain("'Entwurf'");
    expect(hero).toContain("'Archiviert'");
  });

  it('TemplateListScreenBase bindet Hero für system/tenant scope oder listHeroModule', () => {
    const base = readSrc('src/screens/templates/TemplateListScreenBase.tsx');
    expect(base).toContain('TemplateListHero');
    expect(base).toContain("baseFilters.scope === 'system'");
    expect(base).toContain("baseFilters.scope === 'tenant'");
    expect(base).toContain('listHeroModule');
    expect(base).toContain('hasActiveSearch');
  });

  it('TemplateListScreenBase behält Suche bei System- und Mandantenvorlagen', () => {
    const base = readSrc('src/screens/templates/TemplateListScreenBase.tsx');
    expect(base).toContain('PremiumInput');
    expect(base).toContain('label="Suche"');
    expect(base).toContain('Titel, Inhalt, Tags');
  });

  it('System- und Tenant-Routen nutzen TemplateListScreenBase', () => {
    expect(readSrc('app/business/templates/system.tsx')).toContain('SystemTemplatesScreen');
    expect(readSrc('app/business/templates/tenant.tsx')).toContain('TenantTemplatesScreen');
    const modules = readSrc('src/screens/templates/TemplateModuleScreens.tsx');
    expect(modules).toContain("scope: 'system'");
    expect(modules).toContain("scope: 'tenant'");
  });
});

describe('Vorlagen-Modul-Listen Premium (Sprint 57)', () => {
  it('TemplateListHero unterstützt Textbausteine und Pflege-Modulvarianten', () => {
    const hero = readSrc('src/components/templates/TemplateListHero.tsx');
    expect(hero).toContain("'text-blocks'");
    expect(hero).toContain("'care-templates'");
    expect(hero).toContain("title: 'Textbausteine'");
    expect(hero).toContain("title: 'Pflege-Vorlagen'");
  });

  it('Textbausteine- und Pflege-Routen nutzen listHeroModule', () => {
    const modules = readSrc('src/screens/templates/TemplateModuleScreens.tsx');
    expect(modules).toContain('listHeroModule="text-blocks"');
    expect(modules).toContain('listHeroModule="care-templates"');
    expect(readSrc('app/business/templates/text-blocks.tsx')).toContain('TextBlocksScreen');
    expect(readSrc('app/business/templates/care-templates.tsx')).toContain('CareTemplatesScreen');
  });

  it('Alle Modul-Vorlagenlisten haben listHeroModule', () => {
    const modules = readSrc('src/screens/templates/TemplateModuleScreens.tsx');
    const moduleHeroKeys = [
      'text-blocks',
      'document-templates',
      'message-templates',
      'billing-templates',
      'care-templates',
      'counseling-templates',
      'academy-templates',
      'consent-templates',
    ];
    for (const key of moduleHeroKeys) {
      expect(modules).toContain(`listHeroModule="${key}"`);
    }
  });
});
