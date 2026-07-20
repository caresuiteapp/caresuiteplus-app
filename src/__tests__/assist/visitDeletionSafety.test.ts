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
});
