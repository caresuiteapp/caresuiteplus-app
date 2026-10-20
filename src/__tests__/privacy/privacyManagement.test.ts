import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { resetInternalTaskStore } from '@/lib/tasks/internalTaskStore';
import {
  assertPrivacyProductionSafety,
  assertPrivacyTenantScope,
  buildPrivacyAccessContext,
  canExportPrivacyHealthData,
  evaluateRetentionBlock,
} from '@/lib/privacy/privacyManagementAccess';
import {
  capturePrivacyDataSubjectRequest,
  createProcessingActivity,
  fetchPrivacyComplianceDashboard,
  getPrivacyAuditTrail,
  preparePrivacyDataExport,
  preparePrivacyIdentityCheck,
  resetPrivacyManagementStore,
  reviewPrivacyDeletionRequest,
  submitPrivacyDeletionForReview,
} from '@/lib/privacy/privacyManagementService';
import { listPrivacyRetentionRules, seedDefaultPrivacyRetentionRules } from '@/lib/privacy/privacyManagementStore';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = 'tenant-other-999';
const ADMIN = 'business_admin' as const;
const DISPATCH = 'dispatch' as const;
const CAREGIVER = 'caregiver' as const;

beforeEach(() => {
  resetPrivacyManagementStore();
  resetInternalTaskStore();
  seedDefaultPrivacyRetentionRules(TENANT);
});

afterEach(() => {
  resetPrivacyManagementStore();
  resetInternalTaskStore();
});

describe('Datenschutz- und DSGVO-Management', () => {
  it('1 — Admin kann Verarbeitungstätigkeit anlegen', async () => {
    const result = await createProcessingActivity(
      {
        tenantId: TENANT,
        title: 'Klientenverwaltung',
        purpose: 'Pflegeorganisation',
        legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO',
        dataCategories: ['Stammdaten', 'Pflegedaten'],
      },
      ADMIN,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('Klientenverwaltung');
      expect(result.data.status).toBe('active');
    }

    const audit = getPrivacyAuditTrail(TENANT);
    expect(audit.some((e) => e.action === 'record_created')).toBe(true);
  });

  it('2 — Betroffenenanfrage erzeugt Audit-Trail und interne Aufgabe', async () => {
    const captured = await capturePrivacyDataSubjectRequest(
      {
        tenantId: TENANT,
        requestType: 'access',
        requesterName: 'Max Mustermann',
        requesterEmail: 'max@example.com',
      },
      ADMIN,
    );

    expect(captured.ok).toBe(true);
    if (captured.ok) {
      expect(captured.data.status).toBe('received');
      expect(captured.data.requestNumber).toMatch(/^DSR-/);
      expect(captured.data.internalTaskId).toBeTruthy();
      expect(captured.data.dueAt).toBeTruthy();
    }

    const audit = getPrivacyAuditTrail(TENANT);
    expect(audit.some((e) => e.action === 'request_captured')).toBe(true);
    expect(audit.some((e) => e.action === 'task_created')).toBe(true);

    const dashboard = await fetchPrivacyComplianceDashboard(TENANT, ADMIN);
    expect(dashboard.ok).toBe(true);
    if (dashboard.ok) {
      expect(dashboard.data.openRequestsCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('3 — Gesundheitsdaten-Export ohne view_sensitive blockiert', async () => {
    const captured = await capturePrivacyDataSubjectRequest(
      {
        tenantId: TENANT,
        requestType: 'export',
        requesterName: 'Anna Test',
        requesterEmail: 'anna@example.com',
        containsHealthData: true,
      },
      ADMIN,
    );
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;

    const exportDenied = await preparePrivacyDataExport(
      TENANT,
      captured.data.id,
      true,
      CAREGIVER,
    );
    expect(exportDenied.ok).toBe(false);
    if (!exportDenied.ok) {
      expect(exportDenied.error).toMatch(/Security|Berechtigung/i);
    }

    const caregiverCtx = buildPrivacyAccessContext({ tenantId: TENANT, roleKey: CAREGIVER });
    expect(canExportPrivacyHealthData(caregiverCtx).allowed).toBe(false);
    if (!canExportPrivacyHealthData(caregiverCtx).allowed) {
      expect(canExportPrivacyHealthData(caregiverCtx).reason).toMatch(/Gesundheitsdaten/i);
    }

    const dispatchCtx = buildPrivacyAccessContext({ tenantId: TENANT, roleKey: DISPATCH });
    expect(canExportPrivacyHealthData(dispatchCtx).allowed).toBe(true);

    const exportAllowed = await preparePrivacyDataExport(
      TENANT,
      captured.data.id,
      true,
      ADMIN,
    );
    expect(exportAllowed.ok).toBe(true);
    if (exportAllowed.ok) {
      expect(exportAllowed.data.exportPrepared).toBe(true);
      expect(exportAllowed.data.includesHealthData).toBe(true);
    }
  });

  it('4 — Löschung blockiert bei aktiver Aufbewahrungsfrist', async () => {
    const captured = await capturePrivacyDataSubjectRequest(
      {
        tenantId: TENANT,
        requestType: 'deletion',
        requesterName: 'Lösch Test',
        requesterEmail: 'loesch@example.com',
      },
      ADMIN,
    );
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;

    const entityCreatedAt = new Date().toISOString();
    const deletion = await submitPrivacyDeletionForReview(
      TENANT,
      captured.data.id,
      'client_care_record',
      'client-001',
      entityCreatedAt,
      ADMIN,
    );

    expect(deletion.ok).toBe(true);
    if (deletion.ok) {
      expect(deletion.data.retentionBlocked).toBe(true);
      expect(deletion.data.reviewStatus).toBe('blocked_retention');
    }

    const rules = listPrivacyRetentionRules(TENANT);
    const block = evaluateRetentionBlock('client_care_record', entityCreatedAt, rules);
    expect(block.blocked).toBe(true);

    const audit = getPrivacyAuditTrail(TENANT);
    expect(audit.some((e) => e.action === 'deletion_blocked_retention')).toBe(true);
  });

  it('5 — Mandantentrennung: fremder Mandant wird abgewiesen', async () => {
    const captured = await capturePrivacyDataSubjectRequest(
      {
        tenantId: TENANT,
        requestType: 'correction',
        requesterName: 'Tenant Test',
        requesterEmail: 'tenant@example.com',
      },
      ADMIN,
    );
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;

    const ctx = buildPrivacyAccessContext({ tenantId: OTHER_TENANT, roleKey: ADMIN });
    const scope = assertPrivacyTenantScope(ctx, captured.data.tenantId);
    expect(scope.allowed).toBe(false);

    const identity = await preparePrivacyIdentityCheck(
      OTHER_TENANT,
      captured.data.id,
      true,
      'Test',
      ADMIN,
    );
    expect(identity.ok).toBe(false);
  });

  it('6 — Production Mode blockiert Demo-Fallback', async () => {
    const ctx = buildPrivacyAccessContext({
      tenantId: TENANT,
      roleKey: ADMIN,
      usesDemoFallback: true,
      environment: 'production',
    });
    const production = assertPrivacyProductionSafety(ctx);
    expect(production.allowed).toBe(false);
    if (!production.allowed) {
      expect(production.reason).toMatch(/Production Mode/i);
    }

    const captured = await capturePrivacyDataSubjectRequest(
      {
        tenantId: TENANT,
        requestType: 'access',
        requesterName: 'Prod Test',
        requesterEmail: 'prod@example.com',
      },
      ADMIN,
    );
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;

    const identity = await preparePrivacyIdentityCheck(
      TENANT,
      captured.data.id,
      true,
      'Ausweis geprüft',
      ADMIN,
    );
    expect(identity.ok).toBe(true);
    if (identity.ok) {
      expect(identity.data.identityCheckPrepared).toBe(true);
      expect(identity.data.status).toBe('in_review');
    }

    const deletionCaptured = await capturePrivacyDataSubjectRequest(
      {
        tenantId: TENANT,
        requestType: 'deletion',
        requesterName: 'Review Test',
        requesterEmail: 'review@example.com',
      },
      ADMIN,
    );
    expect(deletionCaptured.ok).toBe(true);
    if (!deletionCaptured.ok) return;

    const recentCreated = new Date();
    recentCreated.setFullYear(recentCreated.getFullYear() - 20);
    const oldDeletion = await submitPrivacyDeletionForReview(
      TENANT,
      deletionCaptured.data.id,
      'applicant',
      'applicant-001',
      recentCreated.toISOString(),
      ADMIN,
    );
    expect(oldDeletion.ok).toBe(true);
    if (!oldDeletion.ok) return;
    expect(oldDeletion.data.retentionBlocked).toBe(false);

    const reviewed = await reviewPrivacyDeletionRequest(
      TENANT,
      oldDeletion.data.id,
      true,
      'Freigabe nach Prüfung',
      ADMIN,
    );
    expect(reviewed.ok).toBe(true);
    if (reviewed.ok) {
      expect(reviewed.data.reviewStatus).toBe('approved');
      expect(reviewed.data.executedAt).toBeNull();
    }
  });
});
