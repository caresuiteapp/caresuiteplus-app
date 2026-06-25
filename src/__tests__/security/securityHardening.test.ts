import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';
import { upsertAssignmentWorkflowRecord, resetAssignmentWorkflowStore } from '@/lib/assist/assignmentWorkflowService';
import {
  buildWorkspaceAccessContext,
  canViewAssignment,
  canViewDocument,
} from '@/lib/permissions';
import {
  getClientDocumentSignatureAuditTrail,
  isDocumentReleasedForPortal,
  resetClientDocumentSignatureStore,
  signClientDocument,
} from '@/lib/portal/clientDocumentSignatureService';
import { buildClientPortalContext } from '@/lib/portal/clientMessagePortalService';
import { fetchEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionService';
import {
  getPreparedChannelTemplates,
  resolveCommunicationTemplateTenantId,
} from '@/lib/communication/channelService';
import { getTenantUsers } from '@/lib/auth/accessStore';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { resolveTenantIdForService } from '@/lib/tenant/tenantResolver';
import { assertLiveConfig } from '@/lib/services/mode';

const root = path.join(__dirname, '..', '..', '..');
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function readMigration(name: string): string {
  return readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
}

function walkSrcFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walkSrcFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('Security hardening', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetClientDocumentSignatureStore();
    resetAssignmentWorkflowStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetClientDocumentSignatureStore();
    resetAssignmentWorkflowStore();
  });

  describe('Cross-Tenant blockiert', () => {
    it('guardServiceTenant lehnt fremden Mandanten im Demo-Modus ab', () => {
      const block = guardServiceTenant(OTHER_TENANT);
      expect(block?.ok).toBe(false);
    });

    it('canViewAssignment blockiert tenant_mismatch', () => {
      const ctx = buildWorkspaceAccessContext({
        userId: 'admin-1',
        tenantId: DEMO_TENANT_ID,
        roleKey: 'business_admin',
      });
      const decision = canViewAssignment(ctx, {
        tenantId: OTHER_TENANT,
        employeeId: 'employee-001',
        clientId: 'client-001',
      });
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.code).toBe('tenant_mismatch');
    });

    it('listEmployeeAssignments filtert nur eigene Einsätze', async () => {
      const list = await fetchAssignmentList(DEMO_TENANT_ID, 'nurse');
      expect(list.ok).toBe(true);
      if (list.ok) {
        expect(list.data.every((entry) => entry.employeeId === 'employee-001')).toBe(true);
      }
    });
  });

  describe('Mitarbeiter-Fremdeinsatz blockiert', () => {
    it('fetchEmployeePortalAssignmentDetail verweigert fremden Einsatz', () => {
      const foreign = upsertAssignmentWorkflowRecord({
        id: 'asg-security-foreign',
        tenantId: DEMO_TENANT_ID,
        clientId: 'client-001',
        employeeId: 'employee-001',
        serviceType: 'Alltagsbegleitung',
        assignmentType: 'single',
        plannedStartAt: '2026-07-01T09:00:00.000Z',
        plannedEndAt: '2026-07-01T11:00:00.000Z',
        plannedDurationMinutes: 120,
        actualStartAt: null,
        actualEndAt: null,
        status: 'bestaetigt',
        canonicalStatus: 'confirmed',
        locationAddress: 'Test',
        notesForEmployee: '',
        internalNotes: '',
        clientVisibleNotes: '',
        billingRelevant: true,
        requiresSignature: false,
        requiresDocumentation: true,
        requiresRoute: false,
        createdBy: null,
        updatedBy: null,
        cancelledAt: null,
        completedAt: null,
        lockedAt: null,
        title: 'Fremder Einsatz',
        tasks: [],
        createdAt: '2026-06-01T08:00:00.000Z',
        updatedAt: '2026-06-01T08:00:00.000Z',
      });

      const detail = fetchEmployeePortalAssignmentDetail(
        DEMO_TENANT_ID,
        foreign.id,
        'employee-003',
        'employee_portal',
      );
      expect(detail.ok).toBe(false);
    });
  });

  describe('Klient:innen-Fremddatei blockiert', () => {
    it('signClientDocument verweigert fremdes Dokument', async () => {
      const ctx = buildClientPortalContext({
        tenantId: DEMO_TENANT_ID,
        profileId: 'profile-client-001',
        roleKey: 'client_portal',
        clientId: 'client-001',
      })!;

      const blocked = await signClientDocument({
        ctx,
        documentId: 'doc-other-client',
        signerName: 'Test Klient',
        signerRole: 'client',
        deviceSession: 'session-security-test',
      });
      expect(blocked.ok).toBe(false);

      expect(isDocumentReleasedForPortal(ctx, 'doc-other-client')).toBe(false);
    });
  });

  describe('Dokument-Fremdmandant blockiert', () => {
    it('canViewDocument verweigert Cross-Tenant', () => {
      const ctx = buildWorkspaceAccessContext({
        userId: 'admin-1',
        tenantId: DEMO_TENANT_ID,
        roleKey: 'business_admin',
      });
      const decision = canViewDocument(ctx, {
        tenantId: OTHER_TENANT,
        visibility: 'office',
        documentType: 'general',
      });
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.code).toBe('tenant_mismatch');
    });
  });

  describe('Audit nicht löschbar (Migrationen)', () => {
    const appendOnlyAuditTables = [
      'document_audit_events',
      'login_audit_events',
      'connect_audit_events',
      'permission_audit_events',
      'assignment_audit_events',
    ];

    it.each(appendOnlyAuditTables)('%s — kein DELETE-Grant für authenticated', (table) => {
      const migrations = readdirSync(path.join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql'));
      const combined = migrations.map((file) => readMigration(file)).join('\n');
      expect(combined).not.toMatch(
        new RegExp(`GRANT\\s+DELETE\\s+ON\\s+public\\.${table}\\s+TO\\s+authenticated`, 'i'),
      );
    });

    it('permission_audit_events — append-only Policies in 0055', () => {
      const sql = readMigration('0055_permission_audit_rls_hardening.sql');
      expect(sql).toContain('permission_audit_events_tenant_select');
      expect(sql).toContain('permission_audit_events_tenant_insert');
      expect(sql).toContain('GRANT SELECT, INSERT ON public.permission_audit_events TO authenticated');
      expect(sql).not.toMatch(/FOR DELETE/i);
    });

    it('Client-Portal-Audit-Trail wächst nur per append', async () => {
      const ctx = buildClientPortalContext({
        tenantId: DEMO_TENANT_ID,
        profileId: 'profile-client-001',
        roleKey: 'client_portal',
        clientId: 'client-001',
      })!;
      const before = getClientDocumentSignatureAuditTrail(DEMO_TENANT_ID, 'client-001').length;
      await signClientDocument({
        ctx,
        documentId: 'doc-006',
        signerName: 'Test Klient',
        signerRole: 'client',
        deviceSession: 'session-security-audit',
      });
      const after = getClientDocumentSignatureAuditTrail(DEMO_TENANT_ID, 'client-001').length;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('Service-Role nicht im Client-Bundle', () => {
    it('Supabase-Client nutzt nur Anon-Key', () => {
      const source = readSrc('src/lib/supabase/client.ts');
      expect(source).toContain('anonKey');
      expect(source).not.toMatch(/service_role|SERVICE_ROLE/i);
    });

    it('kein service_role in src/lib (ohne Secret-Guards)', () => {
      const files = walkSrcFiles(path.join(root, 'src/lib'));
      const dangerousPatterns = [
        /SUPABASE_SERVICE_ROLE_KEY/,
        /SERVICE_ROLE_KEY\s*[=:]/,
        /createClient\([^)]*service_role/i,
      ];
      const offenders = files.filter((file) => {
        if (/Guard\.ts$/.test(file)) return false;
        const content = readFileSync(file, 'utf8');
        return dangerousPatterns.some((pattern) => pattern.test(content));
      });
      expect(offenders).toEqual([]);
    });
  });

  describe('Production Mode ohne Demo-Fallback', () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
      vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('resolveTenantIdForService ohne Profil liefert Fehler', () => {
      const result = resolveTenantIdForService(null);
      expect(result.ok).toBe(false);
    });

    it('guardLiveDemoFeature blockiert Demo-only Features', () => {
      const block = guardLiveDemoFeature(DEMO_TENANT_ID, 'Testfeature');
      expect(block?.ok).toBe(false);
    });

    it('resolveCommunicationTemplateTenantId ohne Mandant liefert null', () => {
      expect(resolveCommunicationTemplateTenantId('')).toBeNull();
      expect(getPreparedChannelTemplates('')).toEqual([]);
    });

    it('accessStore mappt leeren Mandanten nicht auf Demo-Daten', () => {
      expect(getTenantUsers('')).toEqual([]);
    });

    it('assertLiveConfig bestätigt Live-Konfiguration ohne Demo-Umschaltung', () => {
      const config = assertLiveConfig();
      expect(config.ok).toBe(true);
    });
  });
});
