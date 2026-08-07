import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('R17 deferred signature administrative approval gate', () => {
  const migration = read('supabase/migrations/20260807160000_deferred_signature_admin_approval.sql');

  it('requires an employee reason and stores a tenant-scoped pending request', () => {
    expect(migration).toContain('employee_request_deferred_signature_admin_approval');
    expect(migration).toContain("length(trim(coalesce(p_reason, ''))) < 10");
    expect(migration).toContain("'pending_admin_approval'");
    expect(migration).toContain('p_tenant_id IS DISTINCT FROM public.current_tenant_id()');
    expect(migration).toContain('request_reason');
  });

  it('revokes every direct employee portal publication path', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS client_documents_portal_employee_deferred_signature_insert');
    expect(migration).toContain('DROP POLICY IF EXISTS client_documents_portal_employee_deferred_signature_update');
    expect(migration).toContain('DROP POLICY IF EXISTS assist_visit_proofs_portal_employee_update');
    expect(migration).toMatch(/REVOKE EXECUTE ON FUNCTION public\.employee_portal_upsert_deferred_signature_client_document[\s\S]*authenticated/);
  });

  it('allows only administration to approve or reject and audits both decisions', () => {
    expect(migration).toContain('admin_decide_deferred_signature_approval');
    expect(migration).toContain("public.has_permission('assist.execution.manage')");
    expect(migration).toContain('deferred_signature_approval_approved');
    expect(migration).toContain('deferred_signature_approval_rejected');
    expect(migration).toContain('Portal-Veröffentlichung wurde noch nicht bestätigt');
  });

  it('mounts the automatic popup and changes the employee copy to an approval request', () => {
    const shell = read('src/liquid-command/shell/LiquidModuleRouteLayout.tsx');
    const popup = read('src/components/assist/DeferredSignatureApprovalPopup.tsx');
    const panel = read('src/components/portal/EmployeePortalVisitCompletionPanel.tsx');
    expect(shell).toContain('<DeferredSignatureApprovalPopup />');
    expect(popup).toContain('Genehmigen & ans Portal senden');
    expect(popup).toContain('Begründung der mitarbeitenden Person');
    expect(panel).toContain('Freigabe durch Verwaltung anfragen');
    expect(panel).toContain('mindestens 10 Zeichen');
  });
});
