import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

describe('assist visit legacy assignment sync', () => {
  it('visit repository mirrors new visits into assignments on create', () => {
    const repo = readFileSync(
      path.join(root, 'src/lib/assist/repositories/visitRepository.supabase.ts'),
      'utf8',
    );
    expect(repo).toContain('upsertLegacyAssignmentFromVisit');
    expect(repo).toContain('syncLegacyAssignmentTasksFromVisit');
    expect(repo).toContain('syncLegacyAssignmentStatusFromVisit');
  });

  it('sync helper uses shared visit id for assignments bridge', () => {
    const sync = readFileSync(
      path.join(root, 'src/lib/assist/assistVisitLegacyAssignmentSync.ts'),
      'utf8',
    );
    expect(sync).toContain('id: input.visitId');
    expect(sync).toContain("legacy_assignment_id: input.visitId");
    expect(sync).toContain("product_key: 'assist'");
  });

  it('client portal dashboard filters use remote assignment statuses', () => {
    const dashboard = readFileSync(
      path.join(root, 'src/lib/portal/clientPortalDashboardLive.ts'),
      'utf8',
    );
    expect(dashboard).toContain('PORTAL_UPCOMING_ASSIGNMENT_STATUSES');
    expect(dashboard).not.toContain("'geplant'");
  });

  it('portal assignment status filters export English enum values', () => {
    const filters = readFileSync(
      path.join(root, 'src/lib/portal/portalAssignmentStatusFilters.ts'),
      'utf8',
    );
    expect(filters).toContain("'planned'");
    expect(filters).toContain("'confirmed'");
    expect(filters).not.toContain("'geplant'");
  });

  it('backfill migration mirrors assist_visits into assignments', () => {
    const migration = readFileSync(
      path.join(root, 'supabase/migrations/0197_assist_visit_portal_assignment_sync.sql'),
      'utf8',
    );
    expect(migration).toContain('assignments_portal_client_select');
    expect(migration).toContain('INSERT INTO public.assignments');
    expect(migration).toContain('legacy_assignment_id = v.id');
  });
});
