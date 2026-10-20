import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office Restbereiche V32.8', () => {
  it('lädt das Audit-Log im Live-Modus aus Supabase', () => {
    const source = readSrc('src/lib/officeCore/auditLogService.ts');
    expect(source).toContain('officeAuditLogSupabaseRepository.list(tenantId)');
    expect(source).not.toContain('guardLiveDemoFeature');
  });

  it('aktualisiert Mitarbeitenden-Arbeitszeiten und zeigt Servicefehler', () => {
    const source = readSrc('src/screens/office/EmployeeWorkTimesScreen.tsx');
    expect(source).toContain('setRevision((current) => current + 1)');
    expect(source).toContain('entriesResult && !entriesResult.ok');
    expect(source).toContain('PremiumButton title="Aktualisieren"');
  });

  it('lässt Klient:innen- und Mitarbeitenden-Details nie leer rendern', () => {
    for (const file of [
      'src/components/office/ClientDetailSummaryPanel.tsx',
      'src/components/office/EmployeeDetailSummaryPanel.tsx',
    ]) {
      const source = readSrc(file);
      expect(source).not.toMatch(/if\s*\(!(?:client|employee)\)\s*return null/);
      expect(source).toContain('Datensatz nicht verfügbar');
    }
  });

  it('verarbeitet den Modulfilter typensicher', () => {
    const source = readSrc('src/screens/business/office/OfficeModuleAssignmentListScreen.tsx');
    expect(source).toContain('Array.isArray(key)');
    expect(source).not.toContain("roleLabel ?? 'Demo'");
  });

  it('zeigt keine internen preparedOnly-Bezeichnungen in Office-Kernansichten', () => {
    for (const file of [
      'src/components/access/AccessManagementDashboardHero.tsx',
      'src/components/access/AccessListHero.tsx',
      'src/components/office/OfficeDashboardHero.tsx',
      'src/components/office/RecruitingDashboardHero.tsx',
      'src/components/office/PersonalComplianceCockpitHero.tsx',
      'src/components/office/BudgetsListHero.tsx',
      'src/components/office/InvoiceDetailHero.tsx',
      'src/components/office/accounting/InvoiceAccountingPanel.tsx',
    ]) {
      expect(readSrc(file)).not.toMatch(/label=[{"'][^\n]*preparedOnly/);
    }
  });
});
