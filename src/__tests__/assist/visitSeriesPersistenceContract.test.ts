import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Serieneinsätze werden als Einzeleinsätze persistiert', () => {
  it('materialisiert beim Anlegen jeden Folgetermin', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/visitService.ts'),
      'utf8',
    );

    expect(source).toContain('occurrenceDates.slice(1)');
    expect(source).toContain('visitSupabaseRepository.materializeOccurrence');
    expect(source).toContain('Bitte für die Serie ein Enddatum oder eine Anzahl Termine angeben.');
  });

  it('zieht ältere virtuelle Termine beim Öffnen im Mitarbeitendenportal nach', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/portal/employeePortalExecutionLiveService.ts'),
      'utf8',
    );

    expect(source).toContain("assignmentId.includes('::')");
    expect(source).toContain('resolveExecutableVisitId(tenantId, assignmentId, roleKey)');
    expect(source).toContain('executableAssignmentId = executable.data.visitId');
  });

  it('löscht einen einzelnen Serientermin ohne ihn virtuell wieder einzublenden', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );

    expect(source).toContain('async deleteOccurrence(');
    expect(source).toContain('detachedOccurrenceDates');
    expect(source).toContain('delete materializedOccurrences[occurrenceDate]');
    expect(source).toContain('async deleteSeriesMasterOccurrenceOnly(');
    expect(source).toContain('parentSeriesId: nextMaster.id');
  });

  it('bietet Einzel- und Folgeterminbereich für Bearbeiten und Löschen an', () => {
    const form = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/assist/AssignmentEditForm.tsx'),
      'utf8',
    );
    const detail = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/assist/AssignmentDetailTabsPanel.tsx'),
      'utf8',
    );
    const service = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/visitService.ts'),
      'utf8',
    );

    expect(form).toContain('Nur dieser Termin');
    expect(form).toContain('Dieser und folgende');
    expect(detail).toContain('Löschbereich');
    expect(detail).toContain('unabhängig von ihrem Bearbeitungsstatus gelöscht');
    expect(service).toContain("scope === 'this_and_following'");
    expect(service).toContain('isProtectedSeriesHistory');
    expect(service).not.toContain('.filter((candidate) => !isProtectedSeriesHistory(candidate))');
  });

  it('behält absichtlich getrennte zeitgleiche Einsätze beim Einzellöschen', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );

    expect(source).toContain('const rowsToDelete = [deletionRow]');
    expect(source).not.toContain('const protectedDuplicate = identicalRows.find');
    expect(source).toContain('const legacyAssignmentIds = Array.from(legacyCandidates.keys())');
    expect(source).toContain("'delete_assist_visit'");
  });
});
