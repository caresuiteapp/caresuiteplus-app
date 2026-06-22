import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  createAssignmentWorkflow,
  getAssignmentWorkflow,
  resetAssignmentWorkflowStore,
} from '@/lib/assist/assignmentWorkflowService';
import {
  createClientVisitRequest,
  resetClientVisitRequestStore,
} from '@/lib/assist/clientVisitRequestService';
import { checkRoleAccess } from '@/lib/navigation';
import {
  assertClientPortalProductionSafe,
  fetchClientCompletedAssignments,
  fetchClientDigitalFile,
  fetchClientPlannedAssignments,
  fetchClientPortalDashboard,
  getClientPortalAssignmentDetail,
  resolveClientPortalContext,
  stripInternalAssignmentFields,
} from '@/lib/portal/clientPortalDomainService';
import {
  getClientDocumentSignatureAuditTrail,
  isDocumentReleasedForPortal,
  resetClientDocumentSignatureStore,
  signClientDocument,
} from '@/lib/portal/clientDocumentSignatureService';
import {
  buildClientPortalContext,
  getClientPortalAuditTrail,
  resetClientMessagePortalStore,
  sendClientPortalMessage,
} from '@/lib/portal/clientMessagePortalService';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const CLIENT_ROLE = 'client_portal' as const;
const FAMILY_ROLE = 'family_portal' as const;
const ADMIN = 'business_admin' as const;

const BASE_INPUT = {
  tenantId: TENANT,
  clientId: 'client-001',
  employeeId: 'employee-001',
  serviceType: 'Alltagsbegleitung',
  plannedStartAt: '2026-07-01T09:00:00.000Z',
  plannedEndAt: '2026-07-01T11:00:00.000Z',
  locationAddress: 'Musterstraße 12, Berlin',
  title: 'Einsatz Portal-Test',
  clientVisibleNotes: 'Bitte klingeln.',
  internalNotes: 'Intern: Schlüssel beim Nachbarn.',
  tasks: [{ title: 'Begleitung' }],
};

function clientCtx(clientId = 'client-001', profileId = 'profile-client-001') {
  return buildClientPortalContext({
    tenantId: TENANT,
    profileId,
    roleKey: CLIENT_ROLE,
    clientId,
  })!;
}

function familyCtx(clientId = 'client-001') {
  return buildClientPortalContext({
    tenantId: TENANT,
    profileId: 'profile-family-001',
    roleKey: FAMILY_ROLE,
    clientId,
    sharedClientIds: [clientId],
    portalRole: 'family_contact',
  })!;
}

describe('Klient:innenportal Prompt 59', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetClientVisitRequestStore();
    resetClientMessagePortalStore();
    resetClientDocumentSignatureStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
    createAssignmentWorkflow(BASE_INPUT, ADMIN);
    createAssignmentWorkflow(
      {
        ...BASE_INPUT,
        clientId: 'client-002',
        title: 'Fremder Einsatz',
        plannedStartAt: '2026-07-02T09:00:00.000Z',
        plannedEndAt: '2026-07-02T11:00:00.000Z',
      },
      ADMIN,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetClientVisitRequestStore();
    resetClientMessagePortalStore();
    resetClientDocumentSignatureStore();
  });

  it('1. Klient:in sieht eigene geplante Einsätze', async () => {
    const result = await fetchClientPlannedAssignments(clientCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((a) => a.serviceType === 'Alltagsbegleitung')).toBe(true);
  });

  it('2. Klient:in sieht keine fremden Einsätze', async () => {
    const result = await fetchClientPlannedAssignments(clientCtx('client-001'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foreign = result.data.filter((a) => {
      const wf = getAssignmentWorkflow(TENANT, a.assignmentId);
      return wf?.clientId === 'client-002';
    });
    expect(foreign).toHaveLength(0);
  });

  it('3. Vertretung sieht nur autorisierte Klient:innendaten', async () => {
    const authorized = await fetchClientPlannedAssignments(familyCtx('client-001'));
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;
    expect(authorized.data.length).toBeGreaterThan(0);
    expect(
      authorized.data.every((a) => {
        const wf = getAssignmentWorkflow(TENANT, a.assignmentId);
        return wf?.clientId === 'client-001';
      }),
    ).toBe(true);

    const foreignInAuthorized = authorized.data.some((a) => {
      const wf = getAssignmentWorkflow(TENANT, a.assignmentId);
      return wf?.clientId === 'client-002';
    });
    expect(foreignInAuthorized).toBe(false);
  });

  it('4. Interne Notizen sind im Portal nicht sichtbar', async () => {
    const planned = await fetchClientPlannedAssignments(clientCtx());
    expect(planned.ok).toBe(true);
    if (!planned.ok || planned.data.length === 0) return;

    const wf = getAssignmentWorkflow(TENANT, planned.data[0]!.assignmentId);
    expect(wf?.internalNotes).toContain('Intern');
    const stripped = stripInternalAssignmentFields(wf!);
    expect('internalNotes' in stripped).toBe(false);
    expect('notesForEmployee' in stripped).toBe(false);

    const detail = getClientPortalAssignmentDetail(clientCtx(), wf!.id);
    expect(detail.ok).toBe(true);
    if (detail.ok && 'notes' in detail.data) {
      expect(detail.data.notes).toBe('Bitte klingeln.');
      expect(detail.data.notes).not.toContain('Intern');
    }

    const akte = await fetchClientDigitalFile(clientCtx());
    expect(akte.ok).toBe(true);
    if (akte.ok) {
      const serialized = JSON.stringify(akte.data);
      expect(serialized).not.toContain('Intern: Schlüssel');
    }
  });

  it('5. Absage erzeugt Anfrage ohne Einsatzänderung', async () => {
    const planned = await fetchClientPlannedAssignments(clientCtx());
    if (!planned.ok || planned.data.length === 0) return;
    const assignmentId = planned.data[0]!.assignmentId;
    const before = getAssignmentWorkflow(TENANT, assignmentId);
    const originalStart = before?.plannedStartAt;

    const request = await createClientVisitRequest({
      tenantId: TENANT,
      assignmentId,
      clientId: 'client-001',
      requestType: 'cancel',
      requestedByProfileId: 'profile-client-001',
      reason: 'Termin passt nicht',
      actorRoleKey: CLIENT_ROLE,
    });
    expect(request.ok).toBe(true);
    if (request.ok) expect(request.data.status).toBe('requested');

    const after = getAssignmentWorkflow(TENANT, assignmentId);
    expect(after?.plannedStartAt).toBe(originalStart);
    expect(after?.plannedEndAt).toBe(before?.plannedEndAt);
  });

  it('6. Verschiebung erzeugt Anfrage ohne Einsatzänderung', async () => {
    const planned = await fetchClientPlannedAssignments(clientCtx());
    if (!planned.ok || planned.data.length === 0) return;
    const assignmentId = planned.data[0]!.assignmentId;
    const before = getAssignmentWorkflow(TENANT, assignmentId);

    const request = await createClientVisitRequest({
      tenantId: TENANT,
      assignmentId,
      clientId: 'client-001',
      requestType: 'reschedule',
      requestedByProfileId: 'profile-client-001',
      reason: 'Bitte verschieben',
      proposedStartAt: '2026-07-05T09:00:00.000Z',
      proposedEndAt: '2026-07-05T11:00:00.000Z',
      actorRoleKey: CLIENT_ROLE,
    });
    expect(request.ok).toBe(true);

    const after = getAssignmentWorkflow(TENANT, assignmentId);
    expect(after?.plannedStartAt).toBe(before?.plannedStartAt);
    expect(after?.plannedEndAt).toBe(before?.plannedEndAt);
  });

  it('7. Nachricht an Verwaltung wird gespeichert', async () => {
    const sent = await sendClientPortalMessage({
      ctx: clientCtx(),
      recipient: 'administration',
      messageType: 'general',
      subject: 'Rückfrage',
      body: 'Bitte um Rückruf wegen Termin.',
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;

    const audit = getClientPortalAuditTrail(TENANT, 'client-001');
    expect(audit.some((e) => e.action === 'client_message_sent')).toBe(true);

    const dashboard = await fetchClientPortalDashboard(clientCtx());
    expect(dashboard.ok).toBe(true);
    if (dashboard.ok) expect(dashboard.data.openMessageCount).toBeGreaterThan(0);
  });

  it('8. Dokument nur sichtbar wenn freigegeben', () => {
    const ctx = clientCtx();
    expect(isDocumentReleasedForPortal(ctx, 'doc-003')).toBe(true);
    expect(isDocumentReleasedForPortal(ctx, 'doc-unreleased')).toBe(false);
    expect(isDocumentReleasedForPortal(ctx, 'doc-other-client')).toBe(false);
  });

  it('9. Signatur erzeugt Hash und Audit-Event', async () => {
    const signed = await signClientDocument({
      ctx: clientCtx(),
      documentId: 'doc-006',
      signerName: 'Helga Schneider',
      signerRole: 'client',
      deviceSession: 'session-test-001',
      capturedIp: '127.0.0.1',
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.data.signatureHash).toMatch(/^sha256:/);

    const audit = getClientDocumentSignatureAuditTrail(TENANT, 'client-001');
    expect(audit.some((e) => e.action === 'document_signed')).toBe(true);
  });

  it('10. Direkte Route ohne Portal-Berechtigung blockiert', () => {
    const blocked = checkRoleAccess('/portal/client', 'employee_portal', {
      tenantId: TENANT,
      userId: 'employee-001',
    });
    expect(blocked.shouldRedirect).toBe(true);
    if (blocked.shouldRedirect) expect(blocked.reason).toBe('wrong_role');

    const allowed = checkRoleAccess('/portal/client', CLIENT_ROLE, {
      tenantId: TENANT,
      userId: 'profile-client-001',
    });
    expect(allowed.shouldRedirect).toBe(false);
  });

  it('11. Cross-Tenant-Zugriff blockiert', () => {
    const tenantGuard = guardServiceTenant(OTHER_TENANT);
    expect(tenantGuard).not.toBeNull();

    const ctx = resolveClientPortalContext({
      tenantId: OTHER_TENANT,
      profileId: 'profile-client-001',
      roleKey: CLIENT_ROLE,
      clientId: 'client-001',
    });
    expect(ctx.ok).toBe(false);
  });

  it('12. Production Mode ohne Demo-Fallback', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const block = assertClientPortalProductionSafe(TENANT, true);
    expect(block).not.toBeNull();
    if (block) expect(block.error).toContain('Production Mode');
  });

  it('Dashboard enthält Kernbereiche', async () => {
    const dashboard = await fetchClientPortalDashboard(clientCtx());
    expect(dashboard.ok).toBe(true);
    if (!dashboard.ok) return;
    expect(dashboard.data.upcomingAssignments).toBeDefined();
    expect(dashboard.data.recentCompleted).toBeDefined();
    expect(dashboard.data.adminNotices.length).toBeGreaterThan(0);
  });

  it('Abgeschlossene Einsätze filtern korrekt', async () => {
    const created = createAssignmentWorkflow(
      {
        ...BASE_INPUT,
        title: 'Abgeschlossener Einsatz',
        plannedStartAt: '2026-06-01T09:00:00.000Z',
        plannedEndAt: '2026-06-01T11:00:00.000Z',
      },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const wf = getAssignmentWorkflow(TENANT, created.data.id);
    expect(wf).toBeDefined();
    if (!wf) return;
    wf.canonicalStatus = 'completed';
    wf.completedAt = '2026-06-01T11:00:00.000Z';
    wf.actualStartAt = '2026-06-01T09:00:00.000Z';
    wf.actualEndAt = '2026-06-01T11:00:00.000Z';

    const completed = await fetchClientCompletedAssignments(clientCtx());
    expect(completed.ok).toBe(true);
    if (completed.ok) {
      expect(completed.data.some((a) => a.assignmentId === created.data.id)).toBe(true);
    }
  });
});
