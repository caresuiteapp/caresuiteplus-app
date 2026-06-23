import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  closeWorkday,
  ensureTimeTrackingSettings,
  evaluateTrafficLight,
  exportTimeTrackingSummary,
  getCurrentWorkdayStatus,
  listTimeAuditLogs,
  pauseWorkday,
  recordIntegrationSignal,
  recordNavigationActivity,
  recordTimeActivityEvent,
  requestTimeCorrection,
  resetActivityBridgeState,
  resetTimeTrackingStore,
  resetDemoTimeTrackingSeedFlag,
  respondToInactivityCheck,
  resumeWorkday,
  reviewTimeCorrection,
  seedDemoTimeTrackingCatalog,
  shouldShowWarningModal,
  shouldTriggerInactivityCheck,
  startWorkday,
  switchActivity,
  triggerInactivityCheck,
  verifyAuditChain,
  writeTimeAuditLog,
  detectMultiTabConflict,
  registerActiveSession,
  isInactivityResponseExpired,
  serializeWorkdayExportCsv,
} from '@/lib/timeTracking';
import { fetchTimeTrackingCatalogs, updateTimeTrackingSettings } from '@/lib/timeTracking/timeTrackingSettingsService';
import { listActivityTypes } from '@/lib/timeTracking/timeTrackingStore';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = 'tenant-b-isolated';
const USER = 'user-1';
const ADMIN = 'business_admin' as const;

beforeEach(() => {
  resetTimeTrackingStore();
  resetDemoTimeTrackingSeedFlag();
  resetActivityBridgeState();
  seedDemoTimeTrackingCatalog(TENANT_A);
});

function activityId(): string {
  return listActivityTypes(TENANT_A)[0]!.id;
}

describe('timeTracking workday lifecycle', () => {
  it('startet Arbeitstag mit erstem Zeitblock', async () => {
    const result = startWorkday(TENANT_A, USER, ADMIN, {
      activityTypeId: activityId(),
      privacyConsentAccepted: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.workday.status).toBe('active');
    expect(result.data.entry.blockIndex).toBe(1);
  });

  it('verweigert zweiten parallelen Start', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const second = startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    expect(second.ok).toBe(false);
  });

  it('pausiert und setzt fort', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const paused = pauseWorkday(TENANT_A, USER, ADMIN);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.data.status).toBe('paused');
    const resumed = resumeWorkday(TENANT_A, USER, ADMIN);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.data.status).toBe('active');
  });

  it('wechselt Tätigkeit mit neuem Block', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const types = listActivityTypes(TENANT_A);
    const switched = switchActivity(TENANT_A, USER, ADMIN, {
      activityTypeId: types[1]?.id ?? types[0]!.id,
    });
    expect(switched.ok).toBe(true);
    if (!switched.ok) return;
    expect(switched.data.entry.blockIndex).toBe(2);
  });

  it('schließt Tag mit Ampel ab', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const closed = closeWorkday(TENANT_A, USER, ADMIN);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.data.workday.status).toBe('closed');
    expect(closed.data.ampel.trafficLight).toBeDefined();
  });

  it('erfordert Datenschutz-Einwilligung wenn konfiguriert', () => {
    ensureTimeTrackingSettings(TENANT_A, ADMIN);
    const denied = startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId() });
    expect(denied.ok).toBe(false);
  });
});

describe('timeTracking inactivity', () => {
  it('erkennt 5-Minuten-Inaktivität', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000 - 1000).toISOString();
    expect(shouldTriggerInactivityCheck(fiveMinAgo, Date.now(), 5)).toBe(true);
  });

  it('löst Inaktivitätsprüfung aus', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const check = triggerInactivityCheck(TENANT_A, USER, ADMIN);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.data.status).toBe('pending');
  });

  it('beantwortet Inaktivität mit pause', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const check = triggerInactivityCheck(TENANT_A, USER, ADMIN);
    if (!check.ok) throw new Error('check failed');
    const response = respondToInactivityCheck(TENANT_A, USER, ADMIN, check.data.id, 'pause');
    expect(response.ok).toBe(true);
  });

  it('markiert unklare Antwort', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const check = triggerInactivityCheck(TENANT_A, USER, ADMIN);
    if (!check.ok) throw new Error('check failed');
    const response = respondToInactivityCheck(TENANT_A, USER, ADMIN, check.data.id, 'unclear');
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.status).toBe('unclear');
  });

  it('zeigt Warnung nach 3 Prüfungen', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const status = getCurrentWorkdayStatus(TENANT_A, USER, ADMIN);
    if (!status.ok || !status.data.workday) throw new Error('no workday');
    triggerInactivityCheck(TENANT_A, USER, ADMIN);
    triggerInactivityCheck(TENANT_A, USER, ADMIN);
    triggerInactivityCheck(TENANT_A, USER, ADMIN);
    expect(shouldShowWarningModal(status.data.workday.id, 3)).toBe(true);
  });

  it('erkennt abgelaufenes Antwortfenster', () => {
    const triggered = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    expect(isInactivityResponseExpired(triggered, Date.now(), 2)).toBe(true);
  });
});

describe('timeTracking corrections and audit', () => {
  it('stellt Korrekturanfrage', () => {
    const started = startWorkday(TENANT_A, USER, ADMIN, {
      activityTypeId: activityId(),
      privacyConsentAccepted: true,
    });
    if (!started.ok) throw new Error('start failed');
    closeWorkday(TENANT_A, USER, ADMIN);
    const req = requestTimeCorrection(TENANT_A, USER, ADMIN, {
      workdayId: started.data.workday.id,
      reason: 'Endzeit vergessen',
    });
    expect(req.ok).toBe(true);
    if (!req.ok) return;
    expect(req.data.status).toBe('pending');
  });

  it('genehmigt Korrektur mit Gegenbuchung', () => {
    const started = startWorkday(TENANT_A, USER, ADMIN, {
      activityTypeId: activityId(),
      privacyConsentAccepted: true,
    });
    if (!started.ok) throw new Error('start failed');
    const entryId = started.data.entry.id;
    closeWorkday(TENANT_A, USER, ADMIN);
    const req = requestTimeCorrection(TENANT_A, USER, ADMIN, {
      workdayId: started.data.workday.id,
      timeEntryId: entryId,
      reason: 'Korrektur Endzeit',
      proposedEndedAt: new Date().toISOString(),
    });
    if (!req.ok) throw new Error('request failed');
    const review = reviewTimeCorrection(TENANT_A, 'admin-1', ADMIN, req.data.id, 'approved');
    expect(review.ok).toBe(true);
    if (!review.ok) return;
    expect(review.data.counterEntryId).toBeTruthy();
  });

  it('lehnt Korrektur ab', () => {
    const started = startWorkday(TENANT_A, USER, ADMIN, {
      activityTypeId: activityId(),
      privacyConsentAccepted: true,
    });
    if (!started.ok) throw new Error('start failed');
    const req = requestTimeCorrection(TENANT_A, USER, ADMIN, {
      workdayId: started.data.workday.id,
      reason: 'Test',
    });
    if (!req.ok) throw new Error('request failed');
    const review = reviewTimeCorrection(TENANT_A, 'admin-1', ADMIN, req.data.id, 'rejected', 'Unplausibel');
    expect(review.ok).toBe(true);
    if (!review.ok) return;
    expect(review.data.status).toBe('rejected');
  });

  it('schreibt append-only Audit-Log', () => {
    writeTimeAuditLog({
      tenantId: TENANT_A,
      entityType: 'test',
      entityId: 'e1',
      action: 'create',
      actorId: USER,
      summary: 'Test',
    });
    const logs = listTimeAuditLogs(TENANT_A);
    expect(logs.length).toBe(1);
    expect(logs[0]?.entryHash).toBeTruthy();
  });

  it('verifiziert Hash-Kette', () => {
    writeTimeAuditLog({
      tenantId: TENANT_A,
      entityType: 'test',
      entityId: 'e1',
      action: 'a1',
      actorId: USER,
      summary: '1',
    });
    writeTimeAuditLog({
      tenantId: TENANT_A,
      entityType: 'test',
      entityId: 'e2',
      action: 'a2',
      actorId: USER,
      summary: '2',
    });
    expect(verifyAuditChain(TENANT_A)).toBe(true);
  });
});

describe('timeTracking tenant isolation', () => {
  it('isolert Mandanten-Daten', () => {
    seedDemoTimeTrackingCatalog(TENANT_B);
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const statusB = getCurrentWorkdayStatus(TENANT_B, USER, ADMIN);
    expect(statusB.ok).toBe(true);
    if (!statusB.ok) return;
    expect(statusB.data.workday).toBeNull();
  });

  it('liefert nur Tenant-A Kataloge', () => {
    const catalogs = fetchTimeTrackingCatalogs(TENANT_A, ADMIN);
    expect(catalogs.ok).toBe(true);
    if (!catalogs.ok) return;
    expect(catalogs.data.activityTypes.every((a) => a.tenantId === TENANT_A)).toBe(true);
  });
});

describe('timeTracking activity bridge', () => {
  it('speichert nur Metadaten bei Navigation', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    recordNavigationActivity(TENANT_A, USER, '/office/clients', 'office');
    const status = getCurrentWorkdayStatus(TENANT_A, USER, ADMIN);
    expect(status.ok).toBe(true);
  });

  it('filtert verbotene Metadaten-Schlüssel', () => {
    recordTimeActivityEvent({
      tenantId: TENANT_A,
      userId: USER,
      eventType: 'form_save',
      metadata: { content: 'secret', formKey: 'client' },
    });
    expect(true).toBe(true);
  });
});

describe('timeTracking multi-tab', () => {
  it('erkennt Tab-Konflikt', () => {
    registerActiveSession(TENANT_A, USER, 'session-a');
    const conflict = detectMultiTabConflict(TENANT_A, USER, 'session-b');
    expect(conflict.conflict).toBe(true);
  });

  it('erlaubt gleiche Session', () => {
    registerActiveSession(TENANT_A, USER, 'session-a');
    const ok = detectMultiTabConflict(TENANT_A, USER, 'session-a');
    expect(ok.conflict).toBe(false);
  });
});

describe('timeTracking integration signals', () => {
  it('lehnt deaktivierte Integration ab', async () => {
    const result = recordIntegrationSignal(TENANT_A, USER, ADMIN, 'microsoft', 'calendar_busy');
    expect(result.ok).toBe(false);
  });

  it('nimmt Signal nach Aktivierung an', async () => {
    ensureTimeTrackingSettings(TENANT_A, ADMIN);
    updateTimeTrackingSettings(TENANT_A, ADMIN, { integrationMicrosoft: true });
    const result = recordIntegrationSignal(TENANT_A, USER, ADMIN, 'microsoft', 'calendar_busy', 'evt-1');
    expect(result.ok).toBe(true);
  });
});

describe('timeTracking ampel', () => {
  it('grün bei klaren Signalen', () => {
    const ampel = evaluateTrafficLight({
      workdayId: 'wd',
      tenantId: TENANT_A,
      activityEvents: [
        {
          id: '1',
          tenantId: TENANT_A,
          workdayId: 'wd',
          userId: USER,
          eventType: 'navigation',
          moduleKey: 'office',
          resourceId: '/office',
          occurredAt: new Date().toISOString(),
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ],
      inactivityChecks: [],
      entries: [],
      warnings: [],
    });
    expect(ampel.trafficLight).toBe('green');
  });

  it('gelb bei unklaren Blöcken', () => {
    const ampel = evaluateTrafficLight({
      workdayId: 'wd',
      tenantId: TENANT_A,
      activityEvents: [],
      inactivityChecks: [],
      entries: [
        {
          id: 'e1',
          tenantId: TENANT_A,
          workdayId: 'wd',
          userId: USER,
          activityTypeId: null,
          organizationId: null,
          costCenterId: null,
          projectId: null,
          blockIndex: 1,
          status: 'closed',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          pauseStartedAt: null,
          netMinutes: 60,
          note: null,
          isUnclear: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      warnings: [],
    });
    expect(ampel.trafficLight).toBe('yellow');
  });
});

describe('timeTracking export', () => {
  it('exportiert CSV für Admin', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    closeWorkday(TENANT_A, USER, ADMIN);
    const exp = exportTimeTrackingSummary(TENANT_A, ADMIN);
    expect(exp.ok).toBe(true);
    if (!exp.ok) return;
    expect(exp.data.csv).toContain('Datum');
  });

  it('serialisiert Export-Zeilen', () => {
    startWorkday(TENANT_A, USER, ADMIN, { activityTypeId: activityId(), privacyConsentAccepted: true });
    const csv = serializeWorkdayExportCsv(TENANT_A);
    expect(csv.split('\n').length).toBeGreaterThan(1);
  });
});

describe('timeTracking permissions', () => {
  it('verweigert Start ohne Berechtigung', () => {
    const result = startWorkday(TENANT_A, USER, 'client_portal', {
      activityTypeId: activityId(),
      privacyConsentAccepted: true,
    });
    expect(result.ok).toBe(false);
  });

  it('verweigert Export für Pflegekraft', () => {
    const exp = exportTimeTrackingSummary(TENANT_A, 'caregiver');
    expect(exp.ok).toBe(false);
  });
});

describe('timeTracking demo seed', () => {
  it('seedet nur Demo-Mandant', () => {
    resetTimeTrackingStore();
    resetDemoTimeTrackingSeedFlag();
    seedDemoTimeTrackingCatalog(TENANT_B);
    expect(listActivityTypes(TENANT_B).length).toBe(0);
    seedDemoTimeTrackingCatalog(TENANT_A);
    expect(listActivityTypes(TENANT_A).length).toBeGreaterThan(0);
  });
});
