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
  });

  it('entfernt identische ungestartete Datenbankkopien gemeinsam', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );

    expect(source).toContain(".eq('planned_start_at', deletionRow.planned_start_at)");
    expect(source).toContain(".eq('planned_end_at', deletionRow.planned_end_at)");
    expect(source).toContain('const protectedDuplicate = identicalRows.find');
    expect(source).toContain('const safelyDeletableLegacyIds =');
    expect(source).toContain(".in('id', visitIds)");
  });
});
