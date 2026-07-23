import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildLiveLocationHeartbeatSnapshot,
} from '@/features/liveTracking/useEmployeeGpsTracking';
import {
  EMPLOYEE_LIVE_LOCATION_INTERVAL_MS,
} from '@/features/liveTracking/useSingleGeolocationWatch';

describe('kontinuierliche Mitarbeitenden-Liveverfolgung', () => {
  it('sendet während eines aktiven Einsatzes alle 30 Sekunden einen Heartbeat', () => {
    expect(EMPLOYEE_LIVE_LOCATION_INTERVAL_MS).toBe(30_000);

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
      capturedAt: '2026-07-23T08:00:30.000Z',
    });
  });

  it('nutzt im nativen Portal einen echten Expo-Standort-Stream', () => {
    const source = readFileSync(
      'src/features/liveTracking/useSingleGeolocationWatch.ts',
      'utf8',
    );

    expect(source).toContain('Location.watchPositionAsync');
    expect(source).toContain('timeInterval: EMPLOYEE_LIVE_LOCATION_INTERVAL_MS');
    expect(source).toContain('distanceInterval: 0');
  });

  it('hält Anfahrt, Ankunft, Leistung und Pause im selben Tracking-Lebenszyklus', () => {
    const source = readFileSync(
      'src/hooks/useEmployeePortalVisitExecution.ts',
      'utf8',
    );

    expect(source).toContain(
      "['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes",
    );
    expect(source).toContain('Boolean(liveContext?.trackingSessionId)');
    expect(source).not.toContain('Boolean(liveContext?.consentStatus.granted)');
    expect(source).not.toContain(
      "['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(effectiveStatus ?? '') &&\n      Boolean(liveContext?.trackingSessionActive)",
    );
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
