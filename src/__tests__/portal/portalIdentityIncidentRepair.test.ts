import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('P0 portal identity and tenant repair', () => {
  it('refreshes metadata even for already linked auth users', () => {
    const source = read('supabase/functions/_shared/portalAuth.ts');
    expect(source).toContain('refreshPortalAuthMetadata');
    expect(source).toContain('portal_account_id: input.accountId');
    expect(source).toContain('tenant_id: input.tenantId');
    expect(source).toContain('role_key: input.roleKey');
  });

  it('restores both legacy client and employee portal session links', () => {
    const actor = read('src/hooks/usePortalActor.ts');
    expect(actor).toContain('fetchPortalClientIdByAccessAccount');
    expect(actor).toContain('fetchPortalEmployeeIdByAccessAccount');
    expect(actor).toContain('updatePortalSession({ employeeId: linkedEmployeeId })');
  });

  it('ships non-circular portal RLS plus internal client write recovery', () => {
    const sql = read(
      'supabase/migrations/20260730103000_portal_identity_rls_incident_repair.sql',
    );
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.current_tenant_id()');
    expect(sql).toContain('cpa.auth_user_id = auth.uid()');
    expect(sql).toContain('epa.auth_user_id = auth.uid()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.can_manage_clients_for_current_tenant()');
    expect(sql).toContain('CREATE POLICY "clients_update_tenant"');
    expect(sql).not.toContain('UPDATE public.clients');
    expect(sql).not.toContain('UPDATE public.assignments');
    expect(sql).not.toContain('UPDATE public.client_documents');
  });

  it('keeps native tablet rotation enabled in both Expo configs', () => {
    const appConfig = read('app.config.ts');
    const appJson = read('app.json');
    expect(appConfig).toContain("orientation: 'default'");
    expect(appConfig).toContain("'UIInterfaceOrientationLandscapeLeft'");
    expect(appConfig).toContain("'UIInterfaceOrientationLandscapeRight'");
    expect(appJson).toContain('"orientation": "default"');
    expect(appJson).toContain('"supportsTablet": true');
  });

  it('locks the portal page to the viewport while retaining its inner content pane', () => {
    const shell = read('src/components/layout/portal/PortalShellLayout.tsx');
    expect(shell).toContain('webShellViewportLockStyle(),');
    expect(shell).toContain("overflow: 'hidden'");
    expect(shell).toContain('<AutoScrollView');
  });
});
