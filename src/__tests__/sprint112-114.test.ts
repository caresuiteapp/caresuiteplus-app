import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_ROUTES } from '@/lib/navigation/routes';
import { isWorkflowBuilderLiveReady } from '@/lib/workflow/workflowModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Workflow Builder + Employee First Login Heroes (Sprint 112)', () => {
  it('WorkflowBuilderScreen nutzt WorkflowBuilderHero mit preparedOnly', () => {
    const screen = readSrc('src/screens/catalog/WorkflowBuilderScreen.tsx');
    expect(screen).toContain('WorkflowBuilderHero');
    expect(screen).toContain('PreparedModeBanner');
    const hero = readSrc('src/components/catalog/WorkflowBuilderHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isWorkflowBuilderLiveReady');
  });

  it('Workflow-Builder Route existiert', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/office/catalogs/workflow-builder.tsx'))).toBe(true);
    expect(APP_ROUTES.some((r) => r.path === '/office/catalogs/workflow-builder')).toBe(true);
  });

  it('isWorkflowBuilderLiveReady bleibt ehrlich false', () => {
    expect(isWorkflowBuilderLiveReady()).toBe(false);
  });

  it('EmployeeFirstLoginPasswordScreen nutzt EmployeeFirstLoginHero', () => {
    const screen = readSrc('src/screens/auth/EmployeeFirstLoginPasswordScreen.tsx');
    expect(screen).toContain('EmployeeFirstLoginHero');
    expect(screen).not.toContain('PremiumCard accentColor={colors.cyan}');
    const hero = readSrc('src/components/auth/EmployeeFirstLoginHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('preparedOnly Auth');
  });
});

describe('Create/Edit Form Headers (Sprint 113)', () => {
  it('FormScreenHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/forms/FormScreenHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('preparedOnly');
  });

  it('Client/Employee/Catalog Create-Edit Screens nutzen FormScreenHero', () => {
    expect(readSrc('src/screens/office/ClientCreateScreen.tsx')).toContain('FormScreenHero');
    expect(readSrc('src/screens/office/EmployeeCreateScreen.tsx')).toContain('FormScreenHero');
    expect(readSrc('src/screens/office/EmployeeEditScreen.tsx')).toContain('FormScreenHero');
    expect(readSrc('src/screens/catalog/CatalogEditScreen.tsx')).toContain('FormScreenHero');
  });

  it('DomainCreateScreen nutzt FormScreenHero', () => {
    expect(readSrc('src/screens/shared/DomainCreateScreen.tsx')).toContain('FormScreenHero');
  });

  it('APP_ROUTES listet Office Create-Routen', () => {
    expect(APP_ROUTES.some((r) => r.path === '/office/clients/create')).toBe(true);
    expect(APP_ROUTES.some((r) => r.path === '/business/office/clients/new')).toBe(true);
    expect(APP_ROUTES.some((r) => r.path === '/business/office/clients/[id]')).toBe(true);
    expect(APP_ROUTES.some((r) => r.path === '/office/employees/create')).toBe(true);
    expect(APP_ROUTES.some((r) => r.path === '/office/catalogs')).toBe(true);
    expect(APP_ROUTES.some((r) => r.path === '/office/catalogs/create')).toBe(true);
  });
});

describe('Pflege CarePlan Create Form Hero (Sprint 114)', () => {
  it('CarePlanCreateScreen nutzt formHero via DomainCreateScreen', () => {
    const screen = readSrc('src/screens/pflege/CarePlanCreateScreen.tsx');
    expect(screen).toContain('formHero');
    expect(screen).toContain('PFLEGE · PFLEGEPLAN');
    expect(screen).toContain('successRoute');
  });

  it('CatalogDetailScreen verlinkt Workflow-Builder', () => {
    const screen = readSrc('src/screens/catalog/CatalogDetailScreen.tsx');
    expect(screen).toContain('/office/catalogs/workflow-builder');
  });
});
