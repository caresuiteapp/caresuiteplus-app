import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Einsatz-Löschschutz', () => {
  it('zeigt endgültiges Löschen für noch nicht begonnene Einsätze', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/assist/AssignmentDetailTabsPanel.tsx'),
      'utf8',
    );
    expect(source).toContain("visit.executionStatus === 'pending'");
    expect(source).toContain('Einsatz löschen');
  });

  it('schützt begonnene, nachgewiesene und abgerechnete Einsätze im Repository', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );
    expect(source).toContain("['pending', 'cancelled'].includes(deletionRow.execution_status)");
    expect(source).toContain('hasExecutionEvidence');
    expect(source).toContain("deletionRow.billing_status === 'invoiced'");
    expect(source).toContain('Begonnene, nachgewiesene oder abgerechnete Einsätze');
  });

  it('schützt auch alte Assignment-Datensätze vor dem Löschen nach Ausführungsbeginn', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/assignmentRepository.supabase.ts'),
      'utf8',
    );
    expect(source).toContain("['geplant', 'bestaetigt', 'storniert'].includes");
    expect(source).toContain('existing.data.actualStartAt');
    expect(source).toContain('Begonnene oder abgeschlossene Einsätze');
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

    expect(visitRepository).toContain(".delete()\n      .eq('tenant_id', tenantId)");
    expect(visitRepository).toContain(".select('id')\n      .maybeSingle()");
    expect(visitRepository).toContain('deletedVisitIds.has(id)');
    expect(visitRepository).toContain('if (!updatedParent)');
    expect(visitRepository).toContain('if (!updatedMaster)');
    expect(assignmentRepository).toContain('if (!deletedAssignment)');
  });

  it('löscht identische ungestartete physische Dubletten gemeinsam', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );

    expect(source).toContain('deletableDuplicateRows');
    expect(source).toContain(".eq('planned_start_at', deletionRow.planned_start_at)");
    expect(source).toContain(".in('id', visitIdsToDelete)");
    expect(source).toContain("['pending', 'cancelled'].includes(candidate.execution_status)");
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
