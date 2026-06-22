import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { resetInternalTaskStore } from '@/lib/tasks/internalTaskStore';
import { sanitizeLogMessage, sanitizeLogMetadata } from '@/lib/operations/logSanitizer';
import {
  assertOperationsProductionSafety,
  buildOperationsMonitoringAccessContext,
  canViewOperationsMonitoring,
} from '@/lib/operations/operationsMonitoringAccess';
import {
  OPERATIONS_AVAILABILITY_DISCLAIMER,
  isOperationsMonitoringLiveReady,
} from '@/lib/operations/operationsModuleConfig';
import {
  buildOperationsMonitoringDashboard,
  createIncidentFromError,
  getOperationsAuditTrail,
  listBackupStatusRecords,
  listSystemErrorLogs,
  logSystemError,
  resetOperationsMonitoringStore,
  updateIncidentStatus,
} from '@/lib/operations/operationsMonitoringService';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = '00000000-0000-4000-8000-000000000099';

describe('Betrieb, Backup, Monitoring & Incident Management', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetOperationsMonitoringStore();
    resetInternalTaskStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetOperationsMonitoringStore();
    resetInternalTaskStore();
  });

  it('1. Mandanten-Admin darf Monitoring sehen — Portal-Rollen nicht', () => {
    const adminCtx = buildOperationsMonitoringAccessContext({
      tenantId: TENANT_A,
      roleKey: 'business_admin',
    });
    expect(canViewOperationsMonitoring(adminCtx).allowed).toBe(true);

    const managerCtx = buildOperationsMonitoringAccessContext({
      tenantId: TENANT_A,
      roleKey: 'business_manager',
    });
    expect(canViewOperationsMonitoring(managerCtx).allowed).toBe(false);

    const portalCtx = buildOperationsMonitoringAccessContext({
      tenantId: TENANT_A,
      roleKey: 'client_portal',
    });
    expect(canViewOperationsMonitoring(portalCtx).allowed).toBe(false);
  });

  it('2. Fehler wird protokolliert und ist im Audit-Trail sichtbar', () => {
    const result = logSystemError(
      {
        tenantId: TENANT_A,
        source: 'sync_worker',
        category: 'sync',
        severity: 'error',
        message: 'Sync batch failed for assignment batch-42',
        correlationId: 'corr-001',
      },
      'business_admin',
      'admin-1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const logs = listSystemErrorLogs(TENANT_A, 'business_admin', 'sync');
    expect(logs.ok).toBe(true);
    if (!logs.ok) return;
    expect(logs.data.some((row) => row.id === result.data.id)).toBe(true);

    const audit = getOperationsAuditTrail(TENANT_A);
    expect(audit.some((e) => e.action === 'error_logged' && e.entityId === result.data.id)).toBe(true);
  });

  it('3. Sensible Daten werden aus Logs entfernt', () => {
    const raw =
      'Auth failed Bearer sk_live_secret_123 password="geheim" api_key=abc123 test@example.com DE89370400440532013000';
    const sanitized = sanitizeLogMessage(raw);
    expect(sanitized).not.toContain('sk_live_secret_123');
    expect(sanitized).not.toContain('geheim');
    expect(sanitized).not.toContain('test@example.com');
    expect(sanitized).not.toContain('DE89370400440532013000');

    const meta = sanitizeLogMetadata({
      password: 'secret123',
      route: '/connect/sync',
    });
    expect(meta.password).toBe('[REDACTED]');
    expect(meta.route).toBe('/connect/sync');
  });

  it('4. Cross-Tenant-Isolation — Mandant B sieht keine Logs von Mandant A', () => {
    logSystemError(
      {
        tenantId: TENANT_A,
        source: 'connect',
        category: 'connect',
        severity: 'warning',
        message: 'Connect timeout',
      },
      'business_admin',
    );

    const tenantALogs = listSystemErrorLogs(TENANT_A, 'business_admin');
    expect(tenantALogs.ok).toBe(true);
    if (!tenantALogs.ok) return;
    expect(tenantALogs.data.length).toBe(1);
    expect(tenantALogs.data.every((row) => row.tenantId === TENANT_A)).toBe(true);

    const dashboardB = buildOperationsMonitoringDashboard(TENANT_B);
    expect(dashboardB.tenantId).toBe(TENANT_B);
    expect(dashboardB.openErrors).toBe(0);
  });

  it('5. Production Mode blockiert Demo-Fallback', () => {
    const ctx = buildOperationsMonitoringAccessContext({
      tenantId: TENANT_A,
      roleKey: 'business_admin',
      userId: 'admin-1',
    });
    ctx.environment = 'production';
    ctx.usesDemoFallback = true;

    const production = assertOperationsProductionSafety(ctx);
    expect(production.allowed).toBe(false);
    if (production.allowed) return;
    expect(production.reason).toContain('Demo-Fallback');
  });

  it('6. Backupstatus ist prepared — keine aktiven Backups', () => {
    const backups = listBackupStatusRecords(TENANT_A, 'business_admin');
    expect(backups.ok).toBe(true);
    if (!backups.ok) return;

    expect(backups.data.length).toBeGreaterThan(0);
    expect(backups.data.every((b) => b.preparedOnly)).toBe(true);
    expect(backups.data.every((b) => b.status === 'not_configured' || b.status === 'prepared')).toBe(
      true,
    );
    expect(backups.data.every((b) => b.lastBackupAt === null)).toBe(true);

    const audit = getOperationsAuditTrail(TENANT_A);
    expect(audit.some((e) => e.metadata.activeBackups === 'false')).toBe(true);
  });

  it('7. Incident aus Fehlerlog erzeugt interne Aufgabe (Prompt 69)', () => {
    const error = logSystemError(
      {
        tenantId: TENANT_A,
        source: 'edge_fn',
        category: 'edge_function',
        severity: 'critical',
        message: 'Edge function billing-export timeout',
      },
      'business_admin',
    );
    expect(error.ok).toBe(true);
    if (!error.ok) return;

    const incident = createIncidentFromError(
      { tenantId: TENANT_A, errorLogId: error.data.id },
      'business_admin',
    );
    expect(incident.ok).toBe(true);
    if (!incident.ok) return;

    expect(incident.data.internalTaskId).toBeTruthy();
    expect(incident.data.status).toBe('detected');
    expect(incident.data.postmortemRequired).toBe(true);

    const updated = updateIncidentStatus(
      { tenantId: TENANT_A, incidentId: incident.data.id, status: 'triaged' },
      'business_admin',
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.triagedAt).toBeTruthy();
  });

  it('8. Systemstatus ohne 24/7-Versprechen und Live-Readiness ehrlich', () => {
    expect(isOperationsMonitoringLiveReady()).toBe(false);

    const dashboard = buildOperationsMonitoringDashboard(TENANT_A);
    expect(dashboard.availabilityDisclaimer).toContain('Kein 24/7');
    expect(dashboard.availabilityDisclaimer).toBe(OPERATIONS_AVAILABILITY_DISCLAIMER);
    expect(dashboard.preparedAreasCount).toBeGreaterThan(0);
    expect(dashboard.areas.some((a) => a.areaKey === 'backup_status' && a.preparedOnly)).toBe(true);
  });
});
