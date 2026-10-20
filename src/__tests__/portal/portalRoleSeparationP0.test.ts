import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  isRoleAllowedForPortalAudience,
  portalAudienceForRole,
  portalScopeForAudience,
} from '@/lib/portal/portalAudience';

const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

describe('P0 portal role separation', () => {
  it('maps client and employee roles without an unsafe default', () => {
    expect(portalAudienceForRole('client_portal')).toBe('client');
    expect(portalAudienceForRole('family_portal')).toBe('client');
    expect(portalAudienceForRole('employee_portal')).toBe('employee');
    expect(portalAudienceForRole('business_admin')).toBeNull();
    expect(isRoleAllowedForPortalAudience('client_portal', 'employee')).toBe(false);
    expect(isRoleAllowedForPortalAudience('employee_portal', 'client')).toBe(false);
    expect(portalScopeForAudience('client')).toBe('portal_client');
    expect(portalScopeForAudience('employee')).toBe('portal_employee');
  });

  it('binds appointment rendering to the route instead of a stale profile', () => {
    const clientRoute = read('app/portal/client/(tabs)/appointments.tsx');
    const employeeRoute = read('app/portal/employee/(tabs)/assignments.tsx');
    const tab = read('src/components/portal/PortalAppointmentsTab.tsx');

    expect(clientRoute).toContain('audience="client"');
    expect(employeeRoute).toContain('audience="employee"');
    expect(tab).toContain('audience: OperationalPortalAudience');
    expect(tab).toContain("const isEmployeePortal = audience === 'employee'");
    expect(tab).toContain("if (audience !== 'employee') return");
    expect(tab).not.toContain('resolvePortalScope(profile');
    expect(tab).not.toContain('const { profile } = useAuth()');
  });

  it('scopes appointment data, cache and live channels to the route audience', () => {
    const hook = read('src/hooks/usePortalAppointments.ts');
    const service = read('src/lib/portal/appointmentService.ts');

    expect(hook).toContain("audience === 'client' && roleMatchesAudience ? clientId : null");
    expect(hook).toContain("audience === 'employee' && roleMatchesAudience ? employeeId : null");
    expect(hook).toContain('scopedEmployeeId,');
    expect(hook).toContain('scopedClientId,');
    expect(hook).toContain('portalRoleMismatch');
    expect(service).toContain("portalAudienceForRole(roleKey) !== 'employee'");
    expect(service).toContain("portalAudienceForRole(roleKey) !== 'client'");
  });

  it('keeps documents and messages explicitly separated on shared pages', () => {
    const clientDocuments = read('app/portal/client/(tabs)/documents.tsx');
    const employeeDocuments = read('app/portal/employee/(tabs)/documents.tsx');
    const documentHook = read('src/hooks/usePortalDocumentDetail.ts');
    const messages = read('src/screens/communication/PortalMessagesScreens.tsx');

    expect(clientDocuments).toContain('audience="client"');
    expect(employeeDocuments).toContain('audience="employee"');
    expect(documentHook).toContain('roleMatchesAudience');
    expect(documentHook).toContain('scopedClientId');
    expect(messages).toContain('audience="client_portal"');
    expect(messages).toContain('audience="employee_portal"');
  });

  it('prioritizes the active portal account over stale profile state', () => {
    const actor = read('src/hooks/usePortalActor.ts');
    const inbox = read('src/hooks/useportalofficemessages.ts');
    const thread = read('src/hooks/useportalofficethreaddetail.ts');

    expect(actor).toContain('portalSession?.accountId ?? profile?.id');
    expect(inbox).toContain('resolvePortalActor(\n        roleKey,');
    expect(thread).toContain('const actorRoleKey = roleKey');
    expect(thread).toContain('const actorProfileId = actorId');
  });

  it('keeps global loading and error overlays readable in premium portals', () => {
    const theme = read('src/design/tokens/portalPremium.tsx');
    const overlay = read('src/components/ui/WorkflowFeedbackOverlay.tsx');

    expect(theme).toContain('usePortalPremiumRuntimeTheme');
    expect(theme).toContain("attributeFilter: ['data-cs-portal-premium']");
    expect(overlay).toContain('usePortalPremiumRuntimeTheme()');
    expect(overlay).toContain('portal.active && styles.portalTitle');
    expect(overlay).toContain('portal.active && styles.portalMessage');
  });
});
