import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Einsatz-Löschung', () => {
  it('zeigt endgültiges Löschen unabhängig vom Einsatzstatus', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/assist/AssignmentDetailTabsPanel.tsx'),
      'utf8',
    );
    expect(source).toContain('const canDeleteVisit = true');
    expect(source).toContain('Einsatz löschen');
  });

  it('blockiert begonnene, nachgewiesene und abgerechnete Einsätze nicht mehr', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );
    expect(source).not.toContain("['pending', 'cancelled'].includes(candidate.execution_status)");
    expect(source).not.toContain('hasExecutionEvidence');
    expect(source).not.toContain('Begonnene, nachgewiesene oder abgerechnete Einsätze');
  });

  it('blockiert auch alte Assignment-Datensätze nicht anhand des Ausführungsstatus', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/assignmentRepository.supabase.ts'),
      'utf8',
    );
    expect(source).not.toContain("['geplant', 'bestaetigt', 'storniert'].includes");
    expect(source).not.toContain('Begonnene oder abgeschlossene Einsätze');
  });

  it('bestätigt Datenbanklöschungen anhand des tatsächlich entfernten Datensatzes', () => {
    const visitRepository = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );
    const assignmentRepository = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/assignmentRepository.supabase.ts'),
      'utf8',
    );

    expect(visitRepository).toContain("'delete_assist_visit'");
    expect(visitRepository).toContain('payload?.deleted');
    expect(visitRepository).toMatch(/\.select\('id'\)\s*\.maybeSingle\(\)/);
    expect(visitRepository).toContain('if (!updatedParent)');
    expect(visitRepository).toContain('if (!updatedMaster)');
    expect(assignmentRepository).toContain('if (!deletedAssignment)');
  });

  it('löscht getrennt geplante Einsätze niemals über unscharfe Zeitgleichheit gemeinsam', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );

    expect(source).toContain('const rowsToDelete = [deletionRow]');
    expect(source).toContain('never a fuzzy client/employee/time/title tuple');
    expect(source).not.toContain('const protectedDuplicate = identicalRows.find');
  });

  it('lädt Live-Zeitereignisse bereits für die Einsatzliste', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/resolveAssignmentExecutionSnapshot.ts'),
      'utf8',
    );

    expect(source).toContain("fromUnknownTable(supabase, 'assist_time_events')");
    expect(source).toContain(".select('visit_id, event_type, occurred_at')");
    expect(source).toContain('calculateVisitTimes(persistedTimeEvents, assignmentStatus)');
  });
});
