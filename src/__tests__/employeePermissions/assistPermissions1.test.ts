import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARRIVED_MANUAL_WARNING,
  ARRIVED_WITHOUT_GPS_WARNING,
  markArrived,
} from '@/features/assistWorkflow/markArrived';
import {
  getEmployeePermissionOverview,
  needsPermissionOnboarding,
  PERMISSION_KINDS,
  requestLocationPermissionOnce,
  resetLocationPermissionPromptGuardForTests,
  EMPLOYEE_PERMISSION_EXPLANATIONS,
} from '@/features/employeePermissions';
import {
  grantEmployeePortalLocationConsent,
  peekEmployeePortalTrackingEntry,
  resetEmployeePortalVisitTrackingStore,
  setEmployeePortalGeofenceOverrideReason,
} from '@/lib/portal/employeePortalVisitTrackingService';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

vi.mock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
  transitionAssistExecutionStatus: vi.fn(async (ctx: AssistExecutionContext) => ({
    ok: true,
    data: { ...ctx, assignmentStatus: 'angekommen' as const },
  })),
}));

const TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const EMPLOYEE = 'emp-test-1';
const ASSIGNMENT = 'asgn-test-1';

function minimalCtx(status: AssistExecutionContext['assignmentStatus'] = 'unterwegs'): AssistExecutionContext {
  return {
    tenantId: TENANT,
    assignmentId: ASSIGNMENT,
    employeeId: EMPLOYEE,
    profileId: EMPLOYEE,
    assignmentStatus: status,
    detail: {
      assignmentId: ASSIGNMENT,
      tenantId: TENANT,
      title: 'Test',
      clientId: 'c1',
      clientName: 'Test Client',
      locationAddress: 'Teststr. 1',
      plannedStartAt: '2026-06-29T09:00:00.000Z',
      plannedEndAt: '2026-06-29T10:00:00.000Z',
      actualStartAt: null,
      actualEndAt: null,
      status,
      canonicalStatus: 'on_the_way',
      notesForEmployee: '',
      accessHints: null,
      emergencyContact: null,
      tasks: [],
      statusHistory: [],
      pauseEvents: [],
      documentationStatus: 'none',
      signatureStatus: 'none',
      requiresSignature: false,
      requiresDocumentation: true,
      requiresRoute: true,
      canStartExecution: true,
      canOpenRoute: true,
      canCaptureGps: true,
      allowedTransitions: ['angekommen'],
      isLocked: false,
      enabledModules: [],
    },
    liveContext: null,
    visitTimes: null,
  };
}

describe('ASSIST.PERMISSIONS.1 employeePermissionCenter', () => {
  it('exports all permission kinds with explanations', () => {
    expect(PERMISSION_KINDS).toContain('location');
    expect(PERMISSION_KINDS).toContain('signature');
    expect(EMPLOYEE_PERMISSION_EXPLANATIONS.location.label).toBe('Standort');
  });

  it('needsPermissionOnboarding returns boolean', async () => {
    const needed = await needsPermissionOnboarding(TENANT, EMPLOYEE);
    expect(typeof needed).toBe('boolean');
  });

  it('getEmployeePermissionOverview returns items', async () => {
    const result = await getEmployeePermissionOverview(TENANT, EMPLOYEE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items.length).toBe(PERMISSION_KINDS.length);
    }
  });

  it('requestLocationPermissionOnce is idempotent per session', async () => {
    resetLocationPermissionPromptGuardForTests();
    const a = await requestLocationPermissionOnce(TENANT, EMPLOYEE);
    const b = await requestLocationPermissionOnce(TENANT, EMPLOYEE);
    expect(a).toBe(b);
  });
});

describe('ASSIST.PERMISSIONS.1 markArrived fallback', () => {
  beforeEach(() => {
    resetEmployeePortalVisitTrackingStore();
    grantEmployeePortalLocationConsent(TENANT, ASSIGNMENT);
  });

  it('allows arrival without GPS with warning', async () => {
    const result = await markArrived({
      ctx: minimalCtx(),
      arrivalMode: 'without_gps',
    });
    expect(result.ok).toBe(true);
    expect(result.arrivalWarning).toBe(ARRIVED_WITHOUT_GPS_WARNING);
    const entry = peekEmployeePortalTrackingEntry(TENANT, ASSIGNMENT);
    expect(entry.arrivalProof).toBe('without_gps');
  });

  it('allows manual arrival with geofence override', async () => {
    setEmployeePortalGeofenceOverrideReason(TENANT, ASSIGNMENT, 'Parkplatz gegenüber');
    const result = await markArrived({
      ctx: minimalCtx(),
      arrivalMode: 'manual',
      manualReason: 'Parkplatz gegenüber',
    });
    expect(result.ok).toBe(true);
    expect(result.arrivalWarning).toBe(ARRIVED_MANUAL_WARNING);
    expect(peekEmployeePortalTrackingEntry(TENANT, ASSIGNMENT).arrivalProof).toBe('manual');
  });

  it('records gps proof when snapshot provided', async () => {
    const result = await markArrived({
      ctx: minimalCtx(),
      gpsSnapshot: {
        latitude: 52.52,
        longitude: 13.405,
        accuracyMeters: 10,
        capturedAt: '2026-06-29T10:00:00.000Z',
      },
    });
    expect(result.ok).toBe(true);
    expect(result.arrivalWarning).toBeNull();
    expect(peekEmployeePortalTrackingEntry(TENANT, ASSIGNMENT).arrivalProof).toBe('gps');
  });
});

describe('ASSIST.PERMISSIONS.1 hook regression', () => {
  it('handleMarkArrived no longer blocks on consent+gps mismatch', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/hooks/useEmployeePortalVisitExecution.ts'),
      'utf8',
    );
    expect(src).not.toContain('if (!pos.ok && localConsent?.granted)');
    expect(src).toContain('requestLocationPermissionOnce');
  });
});
