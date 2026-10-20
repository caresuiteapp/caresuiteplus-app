import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('office company workspace integrity', () => {
  const workspace = source('src/liquid-command/screens/ModuleWorkspaceScreen.tsx');
  const company = source('src/liquid-command/screens/CompanyWorkspace.tsx');

  it('never maps the company area to client records', () => {
    expect(workspace).toContain("if (areaId === 'company') return [];");
    expect(workspace).toContain("activeArea.id === 'company'");
    expect(workspace).toContain('<CompanyWorkspace');
  });

  it('loads the real tenant center instead of a generic work list', () => {
    expect(company).toContain('fetchTenantCenter(tenantId, roleKey)');
    expect(company).toContain('Unternehmensdaten werden geladen');
    expect(company).toContain('Stammdaten bearbeiten');
    expect(company).not.toContain('data.clients');
    expect(company).not.toContain('Datensatz anlegen');
    expect(company).not.toContain('Arbeitsliste durchsuchen');
  });

  it('shows the actual company name and keeps representation in a separate line', () => {
    expect(company).toContain('const configuredCompanyName = snapshot.company.name.trim();');
    expect(company).toContain('isRepresentativeText(configuredLegalName)');
    expect(company).toContain('configuredCompanyName ||');
    expect(company).toContain('Vertreten durch ${primaryRepresentativeName}');
    expect(company).toContain('{representativeLabel ? <LiquidText variant="meta">{representativeLabel}</LiquidText> : null}');
    expect(company).not.toContain('snapshot.company.legalName || snapshot.company.name');
  });

  it('covers identity, compliance, finance and organisation', () => {
    expect(company).toContain('Identität & Erreichbarkeit');
    expect(company).toContain('Recht, Steuer & Zulassung');
    expect(company).toContain('Finanzen & Abrechnung');
    expect(company).toContain('Organisation & System');
    expect(company).toContain('TenantCenterSectionModals');
  });
});
