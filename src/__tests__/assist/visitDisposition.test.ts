import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  dedupeStatusTransitionButtons,
  getVisitAllowedTransitions,
  validateVisitStatusTransition,
} from '@/lib/assist/visitWorkflow';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('visitWorkflow transitions', () => {
  it('erlaubt gültige Übergänge von geplant', () => {
    const result = validateVisitStatusTransition('geplant', 'bestaetigt');
    expect(result.valid).toBe(true);
  });

  it('blockiert ungültige Übergänge', () => {
    const result = validateVisitStatusTransition('geplant', 'abgeschlossen');
    expect(result.valid).toBe(false);
  });

  it('dedupliziert identische Status-Labels', () => {
    const deduped = dedupeStatusTransitionButtons(['bestaetigt', 'bestaetigt', 'storniert']);
    expect(deduped).toEqual(['bestaetigt', 'storniert']);
  });

  it('behält unterschiedliche AssignmentStatus-Labels (kein Aktiv/Aktiv)', () => {
    const deduped = dedupeStatusTransitionButtons(['bestaetigt', 'unterwegs']);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((s) => ASSIGNMENT_STATUS_LABELS[s])).toEqual(['Bestätigt', 'Unterwegs']);
  });

  it('liefert keine doppelten Workflow-Labels bei bestaetigt', () => {
    const allowed = getVisitAllowedTransitions('geplant');
    const deduped = dedupeStatusTransitionButtons(allowed);
    const labels = deduped.map((s) => ASSIGNMENT_STATUS_LABELS[s]);
    expect(labels.filter((l) => l === 'Bestätigt').length).toBeLessThanOrEqual(1);
    expect(labels.filter((l) => l === 'Storniert').length).toBeLessThanOrEqual(1);
  });
});

describe('Assist disposition list UI contracts', () => {
  it('AssignmentsListView rendert ohne Crash-relevante Imports', () => {
    const source = readSrc('src/components/assist/AssignmentsListView.tsx');
    expect(source).toContain('AssignmentCreateForm');
    expect(source).toContain('buildVisitDispositionKpis');
    expect(source).toContain('auroraGlass');
    expect(source).not.toContain('backgroundColor: \'#fff\'');
  });

  it('AssignmentDetailTabsPanel ist null-safe', () => {
    const source = readSrc('src/components/assist/AssignmentDetailTabsPanel.tsx');
    expect(source).toContain('if (!visit) return null');
    expect(source).toContain('allowedStatusTransitions');
    expect(source).toContain('ASSIGNMENT_STATUS_LABELS');
    expect(source).toContain('OfficeRecordDeleteButton');
    expect(source).toContain('viewContext: \'form\'');
    expect(source).not.toContain('WORKFLOW_STATUS_LABELS[status]');
  });

  it('AssignmentDetailGlassModal nutzt tabbed disposition panel', () => {
    const source = readSrc('src/components/assist/AssignmentDetailGlassModal.tsx');
    expect(source).toContain('AssignmentDetailTabsPanel');
    expect(source).toContain('useAuroraGlassModalStyle');
  });

  it('Status-Buttons nutzen AssignmentStatus Labels (kein Aktiv/Aktiv)', () => {
    const repo = readSrc('src/lib/assist/repositories/assignmentRepository.supabase.ts');
    expect(repo).toContain('dedupeStatusTransitionButtons');
    expect(repo).toContain('allowedStatusTransitions');
    const panel = readSrc('src/components/assist/AssignmentDetailTabsPanel.tsx');
    expect(panel).toContain('visit.allowedStatusTransitions.map');
    expect(panel).toContain('ASSIGNMENT_STATUS_LABELS[status]');
  });
});

describe('visit disposition migration', () => {
  it('0116 definiert assist_visits mit RLS is_tenant_member', () => {
    const sql = readFileSync(
      path.join(root, 'supabase/migrations/0116_assist_visits_disposition.sql'),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.assist_visits');
    expect(sql).toContain('assist_visit_tasks');
    expect(sql).toContain('assist_visit_status_history');
    expect(sql).toContain('is_tenant_member(tenant_id)');
    expect(sql).toContain('legacy_assignment_id');
  });
});
