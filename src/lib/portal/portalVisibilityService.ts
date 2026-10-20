/**
 * Central portal visibility — Office/Akte settings drive both portals.
 */
import type { ServiceResult } from '@/types';
import type {
  ClientPortalVisibilityMatrix,
  EmployeePortalClientFieldKey,
  EmployeePortalImpactSummary,
  PortalFeatureVisibility,
  PortalSyncState,
} from '@/types/portalSystem';
import type { ClientPortalFeatureKey } from '@/types/clientCore';
import {
  canClientPortalSeeFeature,
  fetchClientPortalSettingsResolved,
} from '@/lib/client/clientPortalSettingsService';
import { PORTAL_BLOCKED_SNAPSHOT_KEYS } from '@/lib/assist/assistProofPdfPayload';
import { runService } from '@/lib/services/serviceRunner';

const FEATURE_LABELS: Record<ClientPortalFeatureKey, string> = {
  appointments: 'Einsätze',
  messages: 'Nachrichten',
  documents: 'Dokumente',
  proofs: 'Nachweise',
  budget: 'Budget',
  visit_tracking: 'Live-Tracking',
};

const CLIENT_PORTAL_FEATURES: ClientPortalFeatureKey[] = [
  'appointments',
  'messages',
  'documents',
  'proofs',
  'budget',
];

const EMPLOYEE_DEFAULT_ALLOWED: EmployeePortalClientFieldKey[] = [
  'displayName',
  'street',
  'zip',
  'city',
  'phone',
];

const EMPLOYEE_SENSITIVE_FIELDS: EmployeePortalClientFieldKey[] = [
  'accessHint',
  'emergencyContact',
];

const EMPLOYEE_BLOCKED_ALWAYS = [
  'budget',
  'budgetCents',
  'invoices',
  'invoice',
  'invoiceDraft',
  'invoice_draft',
  'billingCandidate',
  'billing_candidate',
  'billingCandidates',
  'blockingReasons',
  'blocking_reasons',
  'budgetMovements',
  'budget_movements',
  'payroll',
  'internalNotes',
  'officeNotes',
  'billingNotes',
  'fullClientRecord',
  'clientPortalSettings',
  'gpsRaw',
  'locationPoints',
];

/** Keys stripped from any client-portal payload. */
export function sanitizeClientPortalPayload<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  for (const key of Object.keys(next)) {
    if (PORTAL_BLOCKED_SNAPSHOT_KEYS.has(key)) delete next[key];
    if (key.toLowerCase().includes('internal')) delete next[key];
    if (key.toLowerCase().includes('billing')) delete next[key];
    if (key.toLowerCase().includes('candidate')) delete next[key];
    if (key.toLowerCase().includes('blocking')) delete next[key];
    if (key.toLowerCase().includes('draft')) delete next[key];
  }
  return next;
}

/** Keys stripped from any employee-portal payload. */
export function sanitizeEmployeePortalPayload<T extends Record<string, unknown>>(payload: T): T {
  const next = sanitizeClientPortalPayload(payload);
  for (const blocked of EMPLOYEE_BLOCKED_ALWAYS) {
    if (blocked in next) delete next[blocked];
  }
  return next;
}

export async function getPortalVisibilityMatrixForClient(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientPortalVisibilityMatrix>> {
  return runService(async () => {
    const settingsResult = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settingsResult.ok) return settingsResult;

    const settings = settingsResult.data;
    const features: PortalFeatureVisibility[] = CLIENT_PORTAL_FEATURES.map((featureKey) => ({
      featureKey,
      label: FEATURE_LABELS[featureKey],
      visible: canClientPortalSeeFeature(settings, featureKey),
      source:
        featureKey === 'visit_tracking'
          ? 'blocked'
          : settings.source === 'client'
            ? 'client'
            : 'tenant',
    }));

    return {
      ok: true,
      data: {
        tenantId,
        clientId,
        portalEnabled: settings.portalEnabled,
        features,
        blockedAlways: ['visit_tracking', 'gps', 'driving_log', 'internal_notes'],
      },
    };
  });
}

export function getEmployeePortalImpactSummary(): EmployeePortalImpactSummary {
  return {
    allowedClientFields: [...EMPLOYEE_DEFAULT_ALLOWED, ...EMPLOYEE_SENSITIVE_FIELDS],
    blockedClientFields: [...EMPLOYEE_BLOCKED_ALWAYS],
    showsBudget: false,
    showsInvoices: false,
    showsFullClientRecord: false,
    gpsTrackingEmployeePortalOnly: true,
  };
}

export function getAllowedClientFieldsForEmployeeVisit(options?: {
  showAddress?: boolean;
  showPhone?: boolean;
  showAccessHints?: boolean;
  showEmergencyContact?: boolean;
}): EmployeePortalClientFieldKey[] {
  const fields: EmployeePortalClientFieldKey[] = ['displayName'];
  if (options?.showAddress !== false) {
    fields.push('street', 'zip', 'city');
  }
  if (options?.showPhone !== false) fields.push('phone');
  if (options?.showAccessHints) fields.push('accessHint');
  if (options?.showEmergencyContact) fields.push('emergencyContact');
  return fields;
}

export function canEmployeePortalSeeClientField(
  field: EmployeePortalClientFieldKey,
  allowed: EmployeePortalClientFieldKey[],
): boolean {
  return allowed.includes(field);
}

/** Derive sync chain state from proof/visit metadata (Office control center). */
export function getPortalSyncStateForVisit(input: {
  visitId: string;
  assignmentId?: string | null;
  employeePortalStatus?: string | null;
  assistProofStatus?: string | null;
  officeReleaseStatus?: string | null;
  portalVisible?: boolean;
  pdfStoragePath?: string | null;
  signatureComplete?: boolean;
}): PortalSyncState {
  const released =
    input.portalVisible === true &&
    (input.officeReleaseStatus === 'released' || input.officeReleaseStatus === 'approved');

  return {
    visitId: input.visitId,
    assignmentId: input.assignmentId ?? null,
    employeePortalStatus: input.employeePortalStatus ?? 'unknown',
    assistProofStatus: input.assistProofStatus ?? null,
    officeReleaseStatus: input.officeReleaseStatus ?? null,
    clientPortalVisible: released,
    pdfAvailable: Boolean(input.pdfStoragePath),
    signatureComplete: input.signatureComplete === true,
  };
}
