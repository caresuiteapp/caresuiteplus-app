import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildLiveLocationHeartbeatSnapshot,
} from '@/features/liveTracking/useEmployeeGpsTracking';
import {
  EMPLOYEE_LIVE_LOCATION_INTERVAL_MS,
  EMPLOYEE_ROUTE_DISTANCE_INTERVAL_METERS,
  EMPLOYEE_ROUTE_LOCATION_INTERVAL_MS,
} from '@/features/liveTracking/useSingleGeolocationWatch';
import {
  applyEmployeePortalTrackingForStatus,
  grantEmployeePortalLocationConsent,
  peekEmployeePortalTrackingEntry,
  resetEmployeePortalVisitTrackingStore,
} from '@/lib/portal/employeePortalVisitTrackingService';

describe('kontinuierliche Mitarbeitenden-Liveverfolgung', () => {
  it('sendet einen Verbindungs-Heartbeat, ohne eine alte GPS-Messung frisch zu datieren', () => {
    expect(EMPLOYEE_LIVE_LOCATION_INTERVAL_MS).toBe(20_000);

    const heartbeat = buildLiveLocationHeartbeatSnapshot(
      {
        latitude: 51.5,
        longitude: 7.4,
        accuracyMeters: 8,
        capturedAt: '2026-07-23T08:00:00.000Z',
      },
      '2026-07-23T08:00:30.000Z',
    );

    expect(heartbeat).toEqual({
      latitude: 51.5,
      longitude: 7.4,
      accuracyMeters: 8,
      capturedAt: '2026-07-23T08:00:00.000Z',
    });
  });

  it('nutzt im nativen Portal einen echten Expo-Standort-Stream', () => {
    expect(EMPLOYEE_ROUTE_LOCATION_INTERVAL_MS).toBe(10_000);
    expect(EMPLOYEE_ROUTE_DISTANCE_INTERVAL_METERS).toBe(5);
    const source = readFileSync(
      'src/features/liveTracking/useSingleGeolocationWatch.ts',
      'utf8',
    );

    expect(source).toContain('Location.watchPositionAsync');
    expect(source).toContain('timeInterval: EMPLOYEE_ROUTE_LOCATION_INTERVAL_MS');
    expect(source).toContain('distanceInterval: EMPLOYEE_ROUTE_DISTANCE_INTERVAL_METERS');
  });

  it('erzwingt im geöffneten Web-Portal ebenfalls eine dichte Routenerfassung', () => {
    const source = readFileSync(
      'src/features/liveTracking/useEmployeeGpsTracking.ts',
      'utf8',
    );

    expect(source).toContain("Platform.OS === 'web'");
    expect(source).toContain('routeSamplingTimerRef.current = setInterval');
    expect(source).toContain('EMPLOYEE_ROUTE_LOCATION_INTERVAL_MS');
  });

  it('hält Tracking bis zum erstellten Leistungsnachweis aktiv', () => {
    const hookSource = readFileSync(
      'src/hooks/useEmployeePortalVisitExecution.ts',
      'utf8',
    );
    const trackingSource = readFileSync(
      'src/lib/portal/employeePortalVisitTrackingPersistence.ts',
      'utf8',
    );

    expect(hookSource).toContain("'dokumentation_offen'");
    expect(hookSource).toContain("'unterschrift_offen'");
    expect(hookSource).toContain('Boolean(liveContext?.trackingSessionId)');
    expect(hookSource).not.toContain('Boolean(liveContext?.consentStatus.granted)');
    expect(hookSource).toContain('isTerminalStatus && ctx.liveContext');
    expect(trackingSource).not.toContain("toStatus === 'beendet' || toStatus === 'abgeschlossen'");
    expect(trackingSource).toContain(
      "toStatus === 'abgeschlossen' || toStatus === 'storniert' || toStatus === 'nicht_erschienen'",
    );
  });

  it('schaltet den Standort erst beim abgeschlossenen Workflow ab', () => {
    const tenantId = 'tenant-live-60';
    const assignmentId = 'assignment-live-60';
    resetEmployeePortalVisitTrackingStore();
    grantEmployeePortalLocationConsent(tenantId, assignmentId);

    applyEmployeePortalTrackingForStatus(tenantId, assignmentId, 'gestartet', 'beendet');
    expect(peekEmployeePortalTrackingEntry(tenantId, assignmentId).trackingActive).toBe(true);

    applyEmployeePortalTrackingForStatus(
      tenantId,
      assignmentId,
      'beendet',
      'dokumentation_offen',
    );
    expect(peekEmployeePortalTrackingEntry(tenantId, assignmentId).trackingActive).toBe(true);

    applyEmployeePortalTrackingForStatus(
      tenantId,
      assignmentId,
      'dokumentation_offen',
      'unterschrift_offen',
    );
    expect(peekEmployeePortalTrackingEntry(tenantId, assignmentId).trackingActive).toBe(true);

    applyEmployeePortalTrackingForStatus(
      tenantId,
      assignmentId,
      'unterschrift_offen',
      'abgeschlossen',
    );
    expect(peekEmployeePortalTrackingEntry(tenantId, assignmentId).trackingActive).toBe(false);
  });

  it('startet GPS ohne separaten CareSuite-Einwilligungsdialog bei Anfahrt oder Einsatz', () => {
    const hook = readFileSync(
      'src/hooks/useEmployeePortalVisitExecution.ts',
      'utf8',
    );
    const startEnRoute = readFileSync(
      'src/features/assistWorkflow/startEnRoute.ts',
      'utf8',
    );
    const startTracking = readFileSync(
      'src/features/liveTracking/startEmployeeLiveTracking.ts',
      'utf8',
    );
    const screen = readFileSync(
      'src/screens/portal/EmployeePortalVisitExecutionScreen.tsx',
      'utf8',
    );

    expect(hook).toContain('requestLocationPermissionOnce(tenantId, employeeId)');
    expect(hook).toContain('recordDriveStart: false');
    expect(hook).toContain('transitionToEnRoute: false');
    expect(startEnRoute).not.toContain("createAssistWorkflowError('AWF_CONSENT_REQUIRED'");
    expect(startTracking).not.toContain("createLiveTrackingError('LIVE_CONSENT_SAVE_FAILED'");
    expect(screen).not.toContain('Bitte zuerst Standort-Einwilligung bestätigen.');
    expect(screen).not.toContain('<EmployeePortalLocationConsentBanner');
  });
});
