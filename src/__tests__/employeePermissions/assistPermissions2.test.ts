import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARRIVED_MANUAL_WARNING,
  ARRIVED_WITHOUT_GPS_WARNING,
  markArrived,
} from '@/features/assistWorkflow/markArrived';
import { EMPLOYEE_CONSENT_BUNDLE_VERSION } from '@/features/employeePermissions/permissionConsentVersion';
import { needsPermissionOnboarding } from '@/features/employeePermissions/needsPermissionOnboarding';
import {
  PERMISSION_KINDS,
  resetLocationPermissionPromptGuardForTests,
  requestLocationPermissionOnce,
} from '@/features/employeePermissions';
import { getEmployeePermissionOverview } from '@/features/employeePermissions/getEmployeePermissionOverview';
import {
  grantEmployeePortalLocationConsent,
  peekEmployeePortalTrackingEntry,
  resetEmployeePortalVisitTrackingStore,
  setEmployeePortalGeofenceOverrideReason,
} from '@/lib/portal/employeePortalVisitTrackingService';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

vi.mock('@/lib/portal/employeePortalVisitTrackingPersistence', () => ({
  persistEmployeePortalStatusTransition: vi.fn(async () => ({
    ok: true,
    warnings: ['assist_geofence_events: Kein Zugriff'],
  })),
}));

vi.mock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
  transitionAssistExecutionStatus: vi.fn(async (ctx: AssistExecutionContext) => ({
    ok: true,
    data: { ...ctx, assignmentStatus: 'angekommen' as const },
  })),
}));

vi.mock('@/features/assistWorkflow/assistVisitExecutionStatePersistence', () => ({
  upsertAssistVisitExecutionState: vi.fn(async () => ({
    ok: true,
    data: { visitId: 'visit-1', currentStep: 'arrived' as const },
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

describe('ASSIST.PERMISSIONS.2 consent version', () => {
  it('uses canonical string bundle version', () => {
    expect(EMPLOYEE_CONSENT_BUNDLE_VERSION).toBe('2026-06-employee-portal-v1');
  });

  it('needsPermissionOnboarding returns boolean without throwing', async () => {
    const needed = await needsPermissionOnboarding(TENANT, EMPLOYEE);
    expect(typeof needed).toBe('boolean');
  });

  it('getEmployeePermissionOverview includes locationInternalConsentAt', async () => {
    const result = await getEmployeePermissionOverview(TENANT, EMPLOYEE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items.length).toBe(PERMISSION_KINDS.length);
      expect('locationInternalConsentAt' in result.data).toBe(true);
    }
  });
});

describe('ASSIST.PERMISSIONS.2 markArrived', () => {
  beforeEach(() => {
    resetEmployeePortalVisitTrackingStore();
    grantEmployeePortalLocationConsent(TENANT, ASSIGNMENT);
  });

  it('is idempotent when already arrived', async () => {
    const result = await markArrived({ ctx: minimalCtx('angekommen') });
    expect(result.ok).toBe(true);
  });

  it('allows arrival without GPS with warning', async () => {
    const result = await markArrived({
      ctx: minimalCtx(),
      arrivalMode: 'without_gps',
    });
    expect(result.ok).toBe(true);
    expect(result.arrivalWarning).toBe(ARRIVED_WITHOUT_GPS_WARNING);
    expect(peekEmployeePortalTrackingEntry(TENANT, ASSIGNMENT).arrivalProof).toBe('without_gps');
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
  });

  it('succeeds when ancillary persist writes warn (geofence/driving log)', async () => {
    const result = await markArrived({
      ctx: minimalCtx(),
      arrivalMode: 'without_gps',
    });
    expect(result.ok).toBe(true);
    expect(result.arrivalWarning).toBe(ARRIVED_WITHOUT_GPS_WARNING);
  });

  it('uses structured errors not generic Datenbankfehler in transition path', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/features/assistWorkflow/markArrived.ts'),
      'utf8',
    );
    expect(src).toContain('createAssistWorkflowError');
    expect(src).toContain('upsertAssistVisitExecutionState');
  });
});

describe('ASSIST.PERMISSIONS.2 onboarding hydration', () => {
  it('EmployeePermissionOnboarding reads Supabase on mount', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/portal/EmployeePermissionOnboarding.tsx'),
      'utf8',
    );
    expect(src).toContain('getEmployeeConsentBundle');
    expect(src).toContain('persistInternalLocationConsent');
  });

  it('requestLocationPermissionOnce remains idempotent', async () => {
    resetLocationPermissionPromptGuardForTests();
    const a = await requestLocationPermissionOnce(TENANT, EMPLOYEE);
    const b = await requestLocationPermissionOnce(TENANT, EMPLOYEE);
    expect(a).toBe(b);
  });
});
