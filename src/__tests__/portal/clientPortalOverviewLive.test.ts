import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('ClientPortalOverviewScreen adaptive engine wiring', () => {
  it('renders AdaptivePortalOverview via portal engine', () => {
    const source = readSrc('src/screens/portal/ClientPortalOverviewScreen.tsx');
    expect(source).toContain('AdaptivePortalOverview');
    expect(source).toContain('usePortalActor');
    expect(source).not.toContain('PortalOverviewTab');
    expect(source).not.toContain('Kein Portalinhalt');
  });

  it('loads portal context from module assignments', () => {
    const hook = readSrc('src/hooks/usePortalContext.ts');
    expect(hook).toContain('resolvePortalContext');
    const service = readSrc('src/lib/portal/clientModuleAssignmentService.ts');
    expect(service).toContain('client_module_assignments');
  });

  it('uses adaptive migration tables', () => {
    const sql = readSrc('supabase/migrations/0099_adaptive_portal_engine.sql');
    expect(sql).toContain('portal_feature_matrix');
    expect(sql).toContain('portal_widget_registry');
    expect(sql).toContain('client_module_assignments_portal_select');
  });
});
