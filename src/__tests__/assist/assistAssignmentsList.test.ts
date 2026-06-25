import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAssignmentListKpis } from '@/lib/assist/assignmentListStats';
import { getDemoAssignmentListItems } from '@/data/demo/assistAssignments';
import { fetchAssignmentList, fetchAssignmentDetail, fetchClientAssignments } from '@/lib/assist';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
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

  it('fetchClientAssignments filtert Demo-Einsätze nach Klient:in', async () => {
    const result = await fetchClientAssignments(DEMO_TENANT_ID, 'client-001', 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((item) => item.id.startsWith('assign-'))).toBe(true);
    }

    const empty = await fetchClientAssignments(DEMO_TENANT_ID, 'client-nonexistent', 'business_admin');
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.data).toHaveLength(0);
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
    expect(source).toContain('actionLabel={canManage ?');
    expect(source).not.toContain('Coming Soon');
  });

  it('AssignmentsListScreen rendert ListView auch bei leerer Liste mit Create-CTA', () => {
    const source = readSrc('src/screens/assist/AssignmentsListScreen.tsx');
    expect(source).toContain('AssignmentsListView');
    expect(source).not.toContain('title="Keine Einsätze"');
    expect(source).toContain('Neuer Einsatz');
    expect(source).toContain('createOpen');
    expect(source).toContain("params.create === '1'");
  });

  it('Schnellaktion Einsatz planen öffnet Create-Formular auf Assignments', () => {
    const workspace = readSrc('src/lib/assist/assistDashboardWorkspace.ts');
    expect(workspace).toContain('/assist/assignments?create=1');
    const redirect = readSrc('app/assist/einsaetze/new.tsx');
    expect(redirect).toContain('/assist/assignments?create=1');
  });

  it('business_admin hat assist.assignments.manage in Static-RBAC', () => {
    const source = readSrc('src/lib/permissions/staticRolePermissions.ts');
    expect(source).toContain('business_admin:');
    expect(source).toContain("'assist.assignments.manage'");
    expect(source).toContain('ASSIST_MANAGE');
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
    expect(source).toContain('fetchClientAssignments');
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
