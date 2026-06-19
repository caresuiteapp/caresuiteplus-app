import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAssignmentListKpis } from '@/data/demo/assignmentListStats';
import { getDemoAssignmentListItems } from '@/data/demo/assistAssignments';
import { fetchAssignmentList, fetchAssignmentDetail } from '@/lib/assist';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { ASSIGNMENT_STATUS_FILTERS, ASSIGNMENT_SORT_OPTIONS } from '@/hooks/useAssignmentList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist Einsatzplanung list', () => {
  it('enforcePermission schützt Assignment-List-Service', () => {
    expect(enforcePermission(null, 'assist.assignments.view' as never)).not.toBeNull();
  });

  it('fetchAssignmentList liefert Demo-Einsätze', async () => {
    const result = await fetchAssignmentList(DEMO_TENANT_ID, 'dispatch');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.title).toBeTruthy();
    }
  });

  it('fetchAssignmentDetail liefert Demo-Detail', async () => {
    const result = await fetchAssignmentDetail('assign-001', DEMO_TENANT_ID, 'dispatch');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toContain('Alltagsbegleitung');
    }
  });

  it('buildAssignmentListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const items = getDemoAssignmentListItems();
    const kpis = buildAssignmentListKpis(items);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'assignments-kpi-today')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(ASSIGNMENT_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(ASSIGNMENT_SORT_OPTIONS.some((o) => o.key === 'time_asc')).toBe(true);
  });

  it('AssignmentsListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/assist/AssignmentsListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('AssignmentsAdaptiveScreen nutzt volle Breite mit AssignmentDetailGlassModal', () => {
    const source = readSrc('src/screens/assist/AssignmentsAdaptiveScreen.tsx');
    expect(source).toContain('AssignmentsListScreen');
    expect(source).toContain('AssignmentDetailGlassModal');
    expect(source).not.toContain('MasterDetailLayout');
  });

  it('AssignmentListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/assist/AssignmentListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('assignmentListService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/assist/assignmentListService.ts');
    expect(source).toContain('guardServiceTenant');
  });

  it('assignmentListService lädt Live-Daten aus Visit-Disposition-Service', () => {
    const source = readSrc('src/lib/assist/assignmentListService.ts');
    expect(source).toContain("getServiceMode() === 'supabase'");
    expect(source).toContain('fetchVisitDispositionList');
  });

  it('assignmentDetailService lehnt Demo-IDs im Supabase-Modus ab', () => {
    const source = readSrc('src/lib/assist/assignmentDetailService.ts');
    expect(source).toContain('isUuid(assignmentId)');
  });
});
