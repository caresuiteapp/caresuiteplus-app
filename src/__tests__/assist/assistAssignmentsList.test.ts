import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAssignmentListKpis } from '@/data/demo/assignmentListStats';
import { getDemoAssignmentListItems } from '@/data/demo/assistAssignments';
import { fetchAssignmentList, fetchAssignmentDetail } from '@/lib/assist';
import { getAssignmentListEmptyState, ASSIGNMENT_CREATE_ROUTE } from '@/lib/assist/assignmentListUi';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { ASSIGNMENT_STATUS_FILTERS, ASSIGNMENT_SORT_OPTIONS } from '@/hooks/useAssignmentList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist Einsatzplanung list', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
    expect(source).toContain('getAssignmentListEmptyState');
    expect(source).not.toContain('Demo-Mandanten hinterlegt');
    expect(source).not.toContain('Coming Soon');
  });

  it('Live-Leerzustand zeigt Planungs-CTA ohne Demo-Text', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    const empty = getAssignmentListEmptyState(true);
    expect(empty.title).toBe('Noch keine Einsätze geplant');
    expect(empty.message).not.toContain('Demo-Mandanten');
    expect(empty.actionLabel).toBe('Einsatz planen');
  });

  it('Demo-Leerzustand behält Demo-Hinweis', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const empty = getAssignmentListEmptyState(false);
    expect(empty.message).toContain('Demo-Mandanten');
  });

  it('Einsatzplanung-Screens verlinken Create-Route', () => {
    const einsaetze = readSrc('src/screens/assist/EinsaetzeListScreen.tsx');
    const assignments = readSrc('src/screens/assist/AssignmentsListScreen.tsx');
    const create = readSrc('src/screens/assist/AssignmentCreateScreen.tsx');
    expect(einsaetze).toContain('ASSIGNMENT_CREATE_ROUTE');
    expect(einsaetze).toContain('Einsatz planen');
    expect(assignments).toContain('ASSIGNMENT_CREATE_ROUTE');
    expect(create).toContain('createAssignment');
    expect(ASSIGNMENT_CREATE_ROUTE).toBe('/assist/einsaetze/new');
  });

  it('AssignmentsAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/assist/AssignmentsAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('AssignmentDetailSummaryPanel');
  });

  it('AssignmentListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/assist/AssignmentListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('assignmentListService nutzt guardServiceTenant und Supabase-Pfad', () => {
    const source = readSrc('src/lib/assist/assignmentListService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('assignmentSupabaseRepository');
  });
});
